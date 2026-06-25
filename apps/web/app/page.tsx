"use client";

/**
 * Homepage — zero-friction first play (UI-UX.md §6).
 *
 * Single textarea, voice picker, Play button. Posting `/api/documents`
 * returns an id; we `router.push(/reader/[docId])` on success.
 *
 * Phase 1 ships a sample doc inline at the bottom of the textarea as a
 * one-tap "Try a sample" link (Zeigarnik effect — UI-UX.md §6).
 *
 * The ContinueShelf is `next/dynamic`-imported so the initial homepage
 * bundle stays under the 150 KB gzip budget (UI-UX.md §10).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button, VoicePicker, Card, type VoicePickerVoice } from "@readmaxxing/ui";

const ContinueShelf = dynamic(
  () => import("@/components/library/ContinueShelf").then((m) => m.ContinueShelf),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-card-muted" /> },
);

const SAMPLE = `The best interface is the one you stop noticing.

ReadMaxxing turns any text into lifelike audio and follows along with you, sentence by sentence, word by word. Paste an article, drop a chapter, point it at a webpage — and you're listening in under five seconds. No accounts first, no menus to learn, no nonsense.

This paragraph is here so the sample reader has something to highlight. Try the karaoke: notice how the current sentence tints softly behind the active word. Now press Space. The voice keeps reading; the words keep pace. Hold the right arrow to skip thirty seconds. Tap a word to jump there. Press F to dim everything except the line you're on.

That's the whole idea — the interface gets out of your way and lets the words lead.`;

const VOICES: VoicePickerVoice[] = [
  { id: "eleven_rachel", name: "Rachel", label: "Calm, narrator", isMarquee: true },
  { id: "eleven_drew", name: "Drew", label: "Warm, friendly" },
  { id: "eleven_bella", name: "Bella", label: "Bright, conversational" },
  { id: "eleven_antoni", name: "Antoni", label: "Bright, warm" },
  { id: "eleven_josh", name: "Josh", label: "Deep, narrative" },
  { id: "eleven_elli", name: "Elli", label: "Young, casual" },
];

export default function HomePage(): React.JSX.Element {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [voiceId, setVoiceId] = React.useState<string>(VOICES[0]!.id);
  const [title, setTitle] = React.useState("Pasted text");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handlePlay() {
    const body = text.trim() || SAMPLE;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title || "Pasted text",
          text: body,
          sourceType: "paste",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `Request failed (${res.status})`);
      }
      const payload = (await res.json()) as { id: string };
      router.push(`/reader/${payload.id}?voice=${encodeURIComponent(voiceId)}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          ReadMaxxing
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">
          Paste anything. Start listening.
        </h1>
        <p className="mt-3 max-w-prose text-base text-ink-muted">
          Lifelike text-to-speech with karaoke-style highlighting. Resume
          to the exact word on any device.
        </p>
      </header>

      <Card padding="lg" className="mb-8">
        <label
          htmlFor="title"
          className="mb-1 block text-xs uppercase tracking-widest text-ink-muted"
        >
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          className="mb-4 h-11 w-full rounded-md border border-border bg-canvas px-3 font-serif text-md focus-visible:shadow-focus"
          placeholder="Pasted text"
        />
        <label
          htmlFor="text"
          className="mb-1 block text-xs uppercase tracking-widest text-ink-muted"
        >
          Paste anything — an article, a chapter, your notes.
        </label>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder={SAMPLE}
          rows={10}
          className="mb-4 w-full resize-y rounded-md border border-border bg-canvas p-3 font-serif text-base leading-relaxed focus-visible:shadow-focus"
        />
        <div className="mb-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setText(SAMPLE);
              setTitle("Sample — the best interface");
            }}
            className="text-accent hover:underline focus-visible:shadow-focus"
          >
            Try a sample →
          </button>
          <span className="tabular text-ink-muted">{text.trim().length} chars</span>
        </div>

        <h2 className="mb-3 font-serif text-lg font-semibold">Pick a voice</h2>
        <VoicePicker
          voices={VOICES}
          value={voiceId}
          onChange={setVoiceId}
          sampleText="The best interface is the one you stop noticing."
        />

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            The voice catalog is curated for English narration. More voices land in Phase 2.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handlePlay}
            loading={loading}
            aria-label="Play"
          >
            {loading ? "Preparing…" : "Play"}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </Card>

      <section aria-label="Continue listening" className="mt-12">
        <h2 className="mb-4 font-serif text-2xl font-semibold">Continue listening</h2>
        <ContinueShelf />
      </section>
    </main>
  );
}