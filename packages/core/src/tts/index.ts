/**
 * @readmaxxing/core/tts — TTS provider types + utilities re-exported
 * from the separate `@readmaxxing/tts` package. Consumers can choose:
 *
 *   import { TTSProvider, TTSRouter, ElevenLabsAdapter } from "@readmaxxing/core/tts";
 *
 * The split package (`packages/tts`) remains the implementation home; this
 * barrel exists so call-sites can use a single import path if they prefer.
 */

export * from "@readmaxxing/tts";