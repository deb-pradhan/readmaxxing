/**
 * Local TTS adapter — stub for sherpa-onnx / Piper / Kokoro models running
 * in the Python worker.
 *
 * Phase 2 wiring:
 *   - The Next.js BFF proxies `/api/tts` requests to `services/worker-python`.
 *   - The worker holds the local model and streams synthesis + word timestamps
 *     back over a chunked HTTP response.
 *   - This adapter implements the same `TTSProvider` interface but speaks to
 *     the BFF proxy instead of a cloud SDK.
 *
 * Throws "not configured" until Phase 2.
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  TTSProvider,
  Voice,
} from "../provider";

const STATIC_VOICES: Voice[] = [
  { id: "local_amy", name: "Amy (Piper)", provider: "local", language: "en-US", label: "On-device", free: true, isMarquee: false },
  { id: "local_lessac", name: "Lessac (Piper)", provider: "local", language: "en-US", label: "On-device", free: true, isMarquee: false },
];

export class LocalTtsAdapter implements TTSProvider {
  readonly id = "local" as const;

  async getVoices(): Promise<Voice[]> {
    return STATIC_VOICES;
  }

  streamSynthesize(_opts: SynthesizeOptions): SynthesizeStream {
    throw new Error("LocalTtsAdapter: local TTS not configured (wired in Phase 2).");
  }
}