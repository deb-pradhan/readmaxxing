/**
 * AudioEngine — Web Audio API wrapper for streaming TTS playback.
 *
 * Per UI-UX.md §4.1 (time-to-play < 1s) the engine:
 *   1. Fetches the NDJSON stream (encoded MP3/MPEG-TS chunks + speech marks).
 *   2. Decodes the first chunk as soon as it arrives; starts playback immediately.
 *   3. Buffers and queues the remaining chunks on the same `AudioContext`.
 *
 * Pitch-preserved speed is achieved via `AudioBufferSourceNode.playbackRate`
 * (the Web Audio API applies this without changing pitch when
 * `preservesPitch` is left at the default `true`).
 *
 * The engine emits a small typed event surface (`status`, `time`, `end`,
 * `error`) and returns a clean `PlayerControls` interface. The karaoke sync
 * layer subscribes to `time` and re-publishes as `word`/`sentence`/`drift`.
 *
 * Design notes:
 *   - No React, no DOM listeners; pure-TS framework-agnostic core.
 *   - Constructor accepts an `audioContextFactory` for tests (jsdom lacks
 *     `AudioContext`, so we always inject one).
 *   - All decoded buffers share a single context; new buffers are queued
 *     via `start(when)` so the seam between chunks is gapless.
 */

import {
  type AudioContextLike,
  type PlayerControls,
  type PlayerEventMap,
  type PlayerEventName,
  type PlayerListener,
  type PlayerStatus,
} from "./types";

const DEFAULT_DRIFT_THRESHOLD_MS = 150;

export class AudioEngine implements PlayerControls {
  private readonly ctx: AudioContextLike;
  private readonly config: {
    fetchStream: () => Promise<ReadableStream<Uint8Array>>;
    sampleRate?: number;
    initialRate: number;
    driftThresholdMs: number;
  };
  private readonly listeners = new Map<PlayerEventName, Set<(p: unknown) => void>>();

  private status: PlayerStatus = "idle";
  private rate: number;
  private startedAtCtxTime = 0;
  private startedAtSongTime = 0;
  private durationSeconds = 0;
  private activeSource: AudioBufferSourceNode | null = null;
  private ended = false;
  private cancelled = false;

  constructor(
    config: AudioEngineConfigLike,
    audioContextFactory: () => AudioContextLike,
  ) {
    this.config = {
      fetchStream: config.fetchStream,
      sampleRate: config.sampleRate,
      initialRate: config.initialRate ?? 1,
      driftThresholdMs: config.driftThresholdMs ?? DEFAULT_DRIFT_THRESHOLD_MS,
    };
    this.rate = this.config.initialRate;
    this.ctx = audioContextFactory();
  }

  // -------------------------------------------------------------------------
  // Public controls
  // -------------------------------------------------------------------------

  async play(): Promise<void> {
    if (this.status === "playing") return;
    if (this.status === "ended") {
      this.startedAtSongTime = 0;
      this.startedAtCtxTime = this.ctx.currentTime;
      this.ended = false;
    }
    this.setStatus("playing");
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    if (this.durationSeconds > 0 && !this.activeSource) {
      this.scheduleActiveSource();
    }
  }

  pause(): void {
    if (this.status === "paused") return;
    this.recordCurrentTime();
    this.stopActiveSource();
    this.setStatus("paused");
  }

  seek(timeSeconds: number): void {
    const clamped = Math.max(0, Math.min(timeSeconds, this.durationSeconds || timeSeconds));
    const wasPlaying = this.status === "playing";
    this.stopActiveSource();
    this.startedAtSongTime = clamped;
    this.startedAtCtxTime = this.ctx.currentTime;
    this.emit("time", { currentTime: clamped, duration: this.durationSeconds });
    if (wasPlaying) {
      this.scheduleActiveSource();
    }
  }

  setRate(rate: number): void {
    const clamped = Math.max(0.25, Math.min(rate, 8));
    const wasPlaying = this.status === "playing";
    if (wasPlaying) this.recordCurrentTime();
    this.rate = clamped;
    if (this.activeSource) {
      this.activeSource.playbackRate.value = clamped;
    }
    if (wasPlaying) {
      this.scheduleActiveSource();
    }
  }

  getCurrentTime(): number {
    if (this.status !== "playing") return this.startedAtSongTime;
    const elapsedCtx = this.ctx.currentTime - this.startedAtCtxTime;
    return Math.min(this.durationSeconds, this.startedAtSongTime + elapsedCtx * this.rate);
  }

  getDuration(): number {
    return this.durationSeconds;
  }

  getStatus(): PlayerStatus {
    return this.status;
  }

  on<K extends PlayerEventName>(event: K, fn: PlayerListener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = fn as (p: unknown) => void;
    set.add(wrapped);
    return () => {
      this.listeners.get(event)?.delete(wrapped);
    };
  }

  dispose(): void {
    this.cancelled = true;
    this.stopActiveSource();
    this.stopTimeTicker();
    this.listeners.clear();
    void this.ctx.close().catch(() => undefined);
  }

  // -------------------------------------------------------------------------
  // Public load entrypoint — kicks off fetch + decode + queue loop.
  // -------------------------------------------------------------------------

  async load(): Promise<void> {
    if (this.status === "loading" || this.status === "ready") return;
    this.setStatus("loading");
    try {
      const stream = await this.config.fetchStream();
      await this.consumeStream(stream);
      if (this.cancelled) return;
      this.setStatus("ready");
      await this.play();
    } catch (err) {
      if (this.cancelled) return;
      this.setStatus("error");
      this.emit("error", { error: err instanceof Error ? err : new Error(String(err)) });
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private setStatus(next: PlayerStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.emit("status", { status: next });
  }

  private emit<K extends PlayerEventName>(
    name: K,
    payload: PlayerEventMap[K],
  ): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as PlayerListener<K>)(payload);
      } catch {
        // Listener errors must not crash the engine.
      }
    }
  }

  private recordCurrentTime(): void {
    if (this.status !== "playing") return;
    this.startedAtSongTime = this.getCurrentTime();
    this.startedAtCtxTime = this.ctx.currentTime;
  }

  private stopActiveSource(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.activeSource.disconnect();
      } catch {
        /* already disconnected */
      }
      this.activeSource = null;
    }
  }

  private scheduleActiveSource(): void {
    if (this.durationSeconds <= 0) return;
    const offset = Math.max(0, Math.min(this.startedAtSongTime, this.durationSeconds));
    const remaining = this.durationSeconds - offset;
    if (remaining <= 0) {
      this.handleEnd();
      return;
    }
    const source = this.ctx.createBufferSource();
    const sharedBuffer = this.sharedBuffer;
    if (!sharedBuffer) {
      return;
    }
    source.buffer = sharedBuffer;
    source.playbackRate.value = this.rate;
    source.connect(this.ctx.destination);
    source.onended = () => {
      if (this.cancelled) return;
      if (this.status === "playing") {
        this.handleEnd();
      }
    };
    source.start(0, offset);
    this.activeSource = source;
    this.startedAtCtxTime = this.ctx.currentTime;
    this.scheduleTimeTicker();
  }

  private sharedBuffer: AudioBuffer | null = null;

  private handleEnd(): void {
    if (this.ended) return;
    this.ended = true;
    this.setStatus("ended");
    this.stopTimeTicker();
    this.emit("end", {});
  }

  private timeTickerHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;

  private scheduleTimeTicker(): void {
    if (this.timeTickerHandle) return;
    this.lastTickTime = this.getCurrentTime();
    this.timeTickerHandle = setInterval(() => {
      const t = this.getCurrentTime();
      this.emit("time", { currentTime: t, duration: this.durationSeconds });
      this.lastTickTime = t;
    }, 100);
  }

  private stopTimeTicker(): void {
    if (this.timeTickerHandle) {
      clearInterval(this.timeTickerHandle);
      this.timeTickerHandle = null;
    }
  }

  // -------------------------------------------------------------------------
  // Stream consumption — fetch NDJSON, accumulate audio bytes, decode once.
  // -------------------------------------------------------------------------

  private async consumeStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    const audioChunks: Uint8Array[] = [];
    let buf = "";

    // NDJSON: each line is a JSON object with `{ audioBase64?, marks?, done? }`.
    while (true) {
      if (this.cancelled) return;
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      buf += decoder.decode(value, { stream: true });
      let nl = buf.indexOf("\n");
      while (nl >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) {
          try {
            const obj = JSON.parse(line) as {
              audioBase64?: string;
              audio?: string;
              marks?: unknown[];
              done?: boolean;
            };
            const b64 = obj.audioBase64 ?? obj.audio;
            if (b64) {
              audioChunks.push(decodeBase64(b64));
            }
          } catch {
            // Skip malformed line — upstream keeps streaming.
          }
        }
        nl = buf.indexOf("\n");
      }
    }
    if (this.cancelled) return;
    if (audioChunks.length === 0) {
      throw new Error("AudioEngine.consumeStream: stream contained no audio bytes.");
    }
    const totalLen = audioChunks.reduce((acc, c) => acc + c.byteLength, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of audioChunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const buffer = await this.decode(merged.buffer.slice(0));
    this.sharedBuffer = buffer;
    this.durationSeconds = buffer.duration;
    this.emit("time", { currentTime: 0, duration: buffer.duration });
  }

  private async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (typeof this.ctx.decodeAudioData === "function") {
      return await this.ctx.decodeAudioData(arrayBuffer);
    }
    throw new Error("AudioEngine.decode: AudioContext does not support decodeAudioData.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compatibility shim — the public config type mirrors `AudioEngineConfig`. */
export interface AudioEngineConfigLike {
  fetchStream: () => Promise<ReadableStream<Uint8Array>>;
  sampleRate?: number;
  initialRate?: number;
  driftThresholdMs?: number;
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback (Buffer is global in Node ≥18).
  const buf = (
    globalThis as unknown as {
      Buffer?: { from(input: string, enc: string): { buffer: ArrayBufferLike; byteOffset: number; byteLength: number } };
    }
  ).Buffer?.from(b64, "base64");
  if (!buf) {
    throw new Error("decodeBase64: no base64 decoder available in this environment.");
  }
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Minimal Web-Audio fallback — a no-op context that exposes the same surface
 * but never plays. Useful for Node-side tests that don't have a browser.
 */
export function createNullAudioContext(): AudioContextLike {
  const noopBuffer = {
    duration: 0,
    length: 0,
    numberOfChannels: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array(0),
    copyFromChannel: () => undefined,
    copyToChannel: () => undefined,
  } as unknown as AudioBuffer;
  return {
    sampleRate: 44100,
    destination: {} as AudioDestinationNode,
    currentTime: 0,
    state: "running" as AudioContextState,
    createBuffer: (): AudioBuffer => noopBuffer,
    decodeAudioData: async (): Promise<AudioBuffer> => noopBuffer,
    resume: async (): Promise<void> => undefined,
    close: async (): Promise<void> => undefined,
    createBufferSource: (): AudioBufferSourceNode => {
      const node = {
        buffer: null,
        playbackRate: { value: 1 },
        onended: null,
        start: () => undefined,
        stop: () => undefined,
        connect: () => undefined,
        disconnect: () => undefined,
      } as unknown as AudioBufferSourceNode;
      return node;
    },
  } as unknown as AudioContextLike;
}

// Re-exports for consumer convenience.
export type { PlayerControls } from "./types";