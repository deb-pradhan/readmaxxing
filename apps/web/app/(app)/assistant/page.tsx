"use client";

/**
 * /assistant — voice AI assistant.
 *
 * Per DESIGN-SYSTEM §13.4 AI-Lead pattern: a dark hero card with
 * "AI ASSISTANT" eyebrow, white greeting, inline coral highlights,
 * chip quick-actions, voice input bar with coral FAB.
 */

import * as React from "react";
import { Card, Chip } from "@readmaxxing/ui";
import { AskChat } from "@/components/ai/AskChat";
import { VoiceInput } from "@/components/assistant/VoiceInput";
import { VoiceOutput } from "@/components/assistant/VoiceOutput";
import { AppHeader } from "@/components/shared/AppHeader";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

export default function AssistantPage(): React.JSX.Element {
  const [documentId, setDocumentId] = React.useState<string>("");
  const [episodeId, setEpisodeId] = React.useState<string>("");
  const [wordOffset, setWordOffset] = React.useState<number | undefined>(undefined);
  const [lastAnswer, setLastAnswer] = React.useState<string>("");
  const [handsFree, setHandsFree] = React.useState(false);
  const [voiceOutOn, setVoiceOutOn] = React.useState(false);

  // Voice-in commits a transcript → that becomes the AskChat question.
  const externalSubmitRef = React.useRef<(question: string) => void>(() => undefined);

  // Capture the latest assistant answer by wrapping the fetch in a
  // custom impl.
  const fetchImpl = React.useCallback<typeof fetch>(
    async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const res = await fetch(input, init);
      if (url.includes("/api/ai/assistant")) {
        const cloned = res.clone();
        const reader = cloned.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulated = "";
        if (reader) {
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                for (const line of text.split("\n")) {
                  if (!line.trim()) continue;
                  try {
                    const msg = JSON.parse(line) as {
                      delta?: string;
                      done?: boolean;
                    };
                    if (msg.delta) accumulated += msg.delta;
                    if (msg.done) setLastAnswer(accumulated);
                  } catch {
                    /* malformed line — ignore */
                  }
                }
              }
            } catch {
              /* stream interrupted */
            }
          })();
        }
      }
      return res;
    },
    [],
  );

  return (
    <div className="min-h-dvh">
      <AppHeader section="Assistant">
        <ThemeSwitcher />
      </AppHeader>

      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Assistant</h1>
          <p className="mt-2 text-base text-ink-muted">
            Ask anything about what you&apos;re reading — by voice or text. I can catch
            you up, pull the key idea, or quiz you on what stuck.
          </p>
        </div>

{/* Phase E (E.1): honest empty state. No fabricated greeting, no
          invented activity stats (audit D finding). The hero invites the
          first action and lists real, copy-stable quick chips — no
          pseudo-personalisation. */}
      <section
        aria-label="AI assistant welcome"
        className="mt-8 rounded-lg bg-inverse p-6 text-ink-inverse"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-coral-bg text-xs font-bold text-white">
            AI
          </span>
          <p className="text-xs font-medium uppercase tracking-widest text-ink-inverse-muted">
            AI Assistant
          </p>
        </div>
        <p className="mt-4 text-xl font-bold leading-snug text-ink-inverse">
          Ask by voice or text
        </p>
        <p className="mt-2 text-base leading-relaxed text-ink-inverse-muted">
          Bind a document or episode below for cited answers, or ask a general
          question. Quick prompts to get you started:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip variant="coral">Catch me up</Chip>
          <Chip variant="butter">Key takeaway</Chip>
          <Chip variant="lavender">Quiz me</Chip>
          <Chip variant="mint">Continue the show</Chip>
        </div>
      </section>

        {/* Conversation */}
        <section
          aria-label="Conversation"
          className="mt-8 min-h-[50vh] overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm"
        >
          <AskChat
            documentId={documentId || episodeId || "no-context"}
            endpoint="/api/ai/assistant"
            fetchImpl={fetchImpl}
            externalSubmit={externalSubmitRef}
            quickChips={[
              { label: "What did I miss?", question: "Catch me up — what did I just hear?" },
              { label: "Explain like I'm 5", question: "Explain the current content so a 5-year-old could follow it." },
              { label: "Key takeaway", question: "What is the single most important takeaway right now?" },
              { label: "Continue the show", question: "Suggest a thoughtful next question for me to ask." },
            ]}
            buildBody={(question) => ({
              question,
              documentId: documentId || undefined,
              episodeId: episodeId || undefined,
              wordOffset: typeof wordOffset === "number" ? wordOffset : undefined,
              stream: true,
            })}
          />
        </section>

        {/* Voice input */}
        <Card padding="md" className="mt-6">
          <h2 className="text-sm font-medium">Voice input</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Tap the mic and speak — your words become the next question.
          </p>
          <div className="mt-4">
            <VoiceInput
              onTranscript={(text) => {
                externalSubmitRef.current(text);
              }}
            />
          </div>
        </Card>

        {/* Voice output */}
        <Card padding="md" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Voice output</h2>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={voiceOutOn}
                onChange={(e) => setVoiceOutOn(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-coral-bg"
              />
              Speak answers aloud
            </label>
          </div>
          {voiceOutOn ? (
            <div className="mt-4">
              <VoiceOutput text={lastAnswer} autoSpeak={voiceOutOn} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Turn on to have the assistant read its replies out loud.
            </p>
          )}
        </Card>

        {/* Hands-free */}
        <Card padding="md" className="mt-6">
          <label className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <input
              type="checkbox"
              checked={handsFree}
              onChange={(e) => setHandsFree(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-coral-bg"
            />
            <span className="font-medium">Hands-free mode</span>
            <span className="text-xs text-ink-muted">
              voice-in → assistant → voice-out loop
            </span>
          </label>
        </Card>

        {/* Context */}
        <Card padding="md" className="mt-6">
          <header>
            <h2 className="text-sm font-medium">Context</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Optional — bind the assistant to a document, episode, or your current
              playback position so answers can cite what you just heard.
            </p>
          </header>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Document id</span>
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="doc_…"
                className="mt-1.5 h-12 w-full rounded-md border border-border bg-card px-4 text-sm focus-visible:border-coral-bg focus-visible:shadow-focus focus-visible:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Episode id</span>
              <input
                type="text"
                value={episodeId}
                onChange={(e) => setEpisodeId(e.target.value)}
                placeholder="ep_…"
                className="mt-1.5 h-12 w-full rounded-md border border-border bg-card px-4 text-sm focus-visible:border-coral-bg focus-visible:shadow-focus focus-visible:outline-none"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-ink-muted">Word offset (optional)</span>
              <input
                type="number"
                min={0}
                value={wordOffset ?? ""}
                onChange={(e) =>
                  setWordOffset(e.target.value === "" ? undefined : Number(e.target.value))
                }
                placeholder="0"
                className="mt-1.5 h-12 w-full rounded-md border border-border bg-card px-4 text-sm focus-visible:border-coral-bg focus-visible:shadow-focus focus-visible:outline-none"
              />
            </label>
          </div>
        </Card>
      </main>
    </div>
  );
}