/**
 * TTSRouter — picks a provider per request.
 *
 * Selection precedence (per v1 plan §"TTS provider layer"):
 *   1. Explicit voiceId → provider mapping (highest priority).
 *   2. Voice is marquee → prefer the provider the marquee voice lives on.
 *   3. Free-tier users → cheapest cloud + local fallback.
 *   4. Premium users → highest quality cloud provider.
 *   5. Latency budget respected (skip providers with degraded p95).
 */

import type {
  SynthesizeOptions,
  SynthesizeStream,
  TTSProvider,
  Voice,
} from "./provider";

export interface RouterPolicy {
  /** Hard cap on per-request cost in USD cents. */
  maxCentsPerRequest?: number;
  /** Whether the user has paid for premium tier features. */
  premium: boolean;
  /** Latency budget in ms — providers exceeding it are skipped. */
  latencyBudgetMs?: number;
  /** When true, prefer local model over cloud (offline mode). */
  preferLocal?: boolean;
}

export interface TTSRouterOptions {
  providers: TTSProvider[];
  /** Initial voice catalog; `getVoices` is merged lazily. */
  initialVoices?: Voice[];
}

export class TTSRouter {
  private readonly providers = new Map<string, TTSProvider>();
  private voicesById = new Map<string, Voice>();
  private catalog: Voice[] = [];

  constructor(opts: TTSRouterOptions) {
    for (const p of opts.providers) {
      this.providers.set(p.id, p);
    }
    for (const v of opts.initialVoices ?? []) {
      this.voicesById.set(v.id, v);
    }
  }

  /** Register a provider at runtime (e.g. after auth reveals premium). */
  registerProvider(provider: TTSProvider): void {
    this.providers.set(provider.id, provider);
  }

  /** Refresh the voice catalog from all registered providers. */
  async refreshCatalog(): Promise<Voice[]> {
    const lists = await Promise.all(
      Array.from(this.providers.values()).map((p) => p.getVoices()),
    );
    this.catalog = lists.flat();
    this.voicesById = new Map(this.catalog.map((v) => [v.id, v]));
    return this.catalog;
  }

  listVoices(): Voice[] {
    return this.catalog;
  }

  /** Find a voice by id across all providers. */
  resolveVoice(voiceId: string): Voice | undefined {
    return this.voicesById.get(voiceId);
  }

  /**
   * Synthesize a request by routing to the appropriate provider.
   * Throws if no provider can serve the request (e.g. voice not found).
   */
  synthesize(opts: SynthesizeOptions, policy: RouterPolicy): SynthesizeStream {
    const voice = this.voicesById.get(opts.voiceId);
    if (!voice) {
      throw new Error(`Unknown voice id: ${opts.voiceId}`);
    }
    const provider = this.providers.get(voice.provider);
    if (!provider) {
      throw new Error(
        `Provider "${voice.provider}" for voice "${opts.voiceId}" is not registered`,
      );
    }
    if (!policy.premium && voice.free === false) {
      throw new Error(`Voice "${opts.voiceId}" requires premium`);
    }
    return provider.streamSynthesize({ ...opts, tier: policy.premium ? "premium" : "free" });
  }
}