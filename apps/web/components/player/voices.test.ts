/**
 * Voice catalog resolution — `id → name` lookup (Phase E E.2).
 *
 * The reader page used to pass `voiceLabel = voiceId` straight to
 * PlayerBar, which surfaced raw ElevenLabs slugs
 * (`Xb7hH8MSUJpSbSDYk0k2`) in the chrome (audit D finding). This
 * test pins the contract that the resolver always returns a human
 * name for known ids and `null` (not the raw id) for unknowns.
 */

import { describe, expect, it } from "vitest";
import { resolveVoiceName, resolveVoice, listKnownVoices } from "@readmaxxing/tts";

describe("voice catalog (Phase E — E.2)", () => {
  it("resolves the ElevenLabs default voice id to its display name", () => {
    expect(resolveVoiceName("Xb7hH8MSUJpSbSDYk0k2")).toBe("Alice");
  });

  it("resolves a few known ElevenLabs premade ids", () => {
    expect(resolveVoiceName("JBFqnCBsd6RMkjVDRZzb")).toBe("George");
    expect(resolveVoiceName("EXAVITQu4vr4xnSDxMaL")).toBe("Sarah");
    expect(resolveVoiceName("pFZP5JQG7iQjIQuC4Bku")).toBe("Lily");
  });

  it("returns null for unknown voice ids (callers fallback gracefully)", () => {
    expect(resolveVoiceName("not_a_real_voice_id")).toBeNull();
    expect(resolveVoiceName("")).toBeNull();
    expect(resolveVoiceName(null)).toBeNull();
    expect(resolveVoiceName(undefined)).toBeNull();
  });

  it("resolveVoice returns the full Voice object for known ids", () => {
    const v = resolveVoice("Xb7hH8MSUJpSbSDYk0k2");
    expect(v).not.toBeNull();
    expect(v?.id).toBe("Xb7hH8MSUJpSbSDYk0k2");
    expect(v?.name).toBe("Alice");
    expect(v?.provider).toBe("elevenlabs");
  });

  it("listKnownVoices returns a non-empty array of Voice objects", () => {
    const all = listKnownVoices();
    expect(all.length).toBeGreaterThan(0);
    for (const v of all) {
      expect(typeof v.id).toBe("string");
      expect(typeof v.name).toBe("string");
      // No raw id should equal its name (catalog discipline).
      expect(v.id === v.name).toBe(false);
    }
  });
});