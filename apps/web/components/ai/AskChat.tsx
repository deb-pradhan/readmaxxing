"use client";

/**
 * AskChat — chat interface for "ask the document" (UI-UX.md §7).
 *
 * - Quick chips ("Explain like I'm 5", "Give me an example", "Summarize from
 *   here") reduce prompt-writing effort.
 * - Grounded answers with cited paragraph links.
 * - Streams the answer as it arrives (the `stream()` function from
 *   `@readmaxxing/ai` is consumed in the BFF).
 * - Typing indicator with honest latency: "Reading the document…" then
 *   "Thinking… 3s elapsed" (per UI-UX.md §7 — no indeterminate spinners).
 *
 * Audit C4 (Phase C P0): the server returns the assistant's full text as a
 * `prose` field with `[cite:p:s]` placeholders still in place. The chat
 * tokenizer walks that string and emits `<CitationPill>` instances for each
 * match — never raw `[cite:0:2]` text reaches the user.
 */

import * as React from "react";
import { cn, CitationPill, scrollBehavior } from "@readmaxxing/ui";
import { LatencyEstimator } from "./LatencyEstimator";

export interface AskCitation {
  paragraphIndex: number;
  sentenceIndex: number;
}

export interface AskResponse {
  answer: string;
  /** Audit C4: precomputed prose with `[cite:p:s]` placeholders intact. */
  prose: string;
  citations: AskCitation[];
  model: string;
}

export interface AskChatProps {
  documentId: string;
  /** When the user picks a citation, jump to that paragraph. */
  onJumpToParagraph?: (paragraphIndex: number) => void;
  className?: string;
  fetchImpl?: typeof fetch;
  /**
   * Override the quick chips (e.g. for "talk with the hosts" where the
   * prompts target the episode script rather than a document).
   */
  quickChips?: Array<{ label: string; question: string }>;
  /** Override the POST endpoint. Defaults to /api/ai/ask. */
  endpoint?: string;
  /** Override the JSON body sent to the endpoint. */
  buildBody?: (question: string) => Record<string, unknown>;
  /**
   * When set, the parent can push a question (e.g. from a voice transcript)
   * and the AskChat will submit it as if the user typed it. The callback is
   * invoked once the question is queued so callers can clear their input.
   */
  externalSubmit?: { current: (question: string) => void };
}

const DEFAULT_QUICK_CHIPS: Array<{ label: string; question: string }> = [
  { label: "Explain like I'm 5", question: "Explain the document so a 5-year-old could follow it." },
  { label: "Give me an example", question: "Give me one concrete example of a key idea in this document." },
  { label: "Summarize from here", question: "Summarize the rest of the document starting from where I stopped." },
  { label: "Key takeaway", question: "What is the single most important takeaway from this document?" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  /**
   * Server-rendered prose with `[cite:p:s]` placeholders preserved verbatim.
   * The renderer tokenizes this string into plain text + CitationPills.
   */
  prose: string;
  citations?: AskCitation[];
  streaming?: boolean;
}

/**
 * Tokenize a prose string with `[cite:p:s]` placeholders into an array of
 * ReactNodes — alternating plain text and `<CitationPill>` instances. Matches
 * `CITE_RE` in `@readmaxxing/ai` exactly so server + client agree.
 */
export function tokenizeProse(
  prose: string,
  onJumpToParagraph?: (p: number) => void,
): React.ReactNode[] {
  if (!prose) return [];
  const out: React.ReactNode[] = [];
  const re = /\[cite:(\d+):(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(prose)) !== null) {
    if (match.index > last) {
      out.push(<React.Fragment key={`t-${key}`}>{prose.slice(last, match.index)}</React.Fragment>);
      key++;
    }
    const paragraphIndex = Number(match[1]);
    const sentenceIndex = Number(match[2]);
    out.push(
      <CitationPill
        key={`c-${key}`}
        paragraphIndex={paragraphIndex}
        sentenceIndex={sentenceIndex}
        onClick={onJumpToParagraph ? () => onJumpToParagraph(paragraphIndex) : undefined}
      />,
    );
    key++;
    last = match.index + match[0].length;
  }
  if (last < prose.length) {
    out.push(<React.Fragment key={`t-${key}`}>{prose.slice(last)}</React.Fragment>);
  }
  return out;
}

export function AskChat({
  documentId,
  onJumpToParagraph,
  className,
  fetchImpl,
  quickChips,
  endpoint = "/api/ai/ask",
  buildBody,
  externalSubmit,
}: AskChatProps): React.JSX.Element {
  const f = fetchImpl ?? ((...args) => fetch(...args));
  const chips = quickChips ?? DEFAULT_QUICK_CHIPS;
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState<{ startMs: number; question: string } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
  }, [messages, pending]);

  // Allow the parent to inject a question (e.g. from a voice transcript)
  // via a stable ref so we don't re-bind on every render.
  React.useEffect(() => {
    if (!externalSubmit) return;
    externalSubmit.current = (question: string) => {
      void ask(question);
    };
  });

  async function ask(question: string): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed) return;
    const startMs = Date.now();
    const userMessage: Message = {
      id: `${startMs}-u`,
      role: "user",
      prose: trimmed,
    };
    const assistantId = `${startMs}-a`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", prose: "", streaming: true },
    ]);
    setInput("");
    setPending({ startMs, question: trimmed });

    try {
      const body = buildBody
        ? buildBody(trimmed)
        : { documentId, question: trimmed, stream: true };
      const res = await f(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        throw new Error(`ask_failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulated = "";
      let citations: AskCitation[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line) as {
              delta?: string;
              done?: boolean;
              citations?: AskCitation[];
              prose?: string;
              error?: string;
              message?: string;
            };
            if (msg.delta) {
              accumulated += msg.delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, prose: accumulated } : m)),
              );
            }
            if (msg.done) {
              citations = msg.citations ?? [];
              // Prefer the server-rendered prose when provided; fall back to
              // the accumulated stream otherwise. This is the audit-C4
              // contract: the server's precomputed prose is canonical.
              const finalProse = typeof msg.prose === "string" ? msg.prose : accumulated;
              if (msg.error) {
                accumulated = msg.message ?? "Couldn't reach the assistant — retry in a moment.";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, prose: accumulated, streaming: false } : m,
                  ),
                );
              } else {
                accumulated = finalProse;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, prose: finalProse, citations, streaming: false } : m,
                  ),
                );
              }
            }
          } catch {
            /* ignore malformed line */
          }
        }
      }
    } catch (err) {
      const fallback = "Couldn't reach the assistant — retry in a moment.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, prose: fallback, streaming: false } : m,
        ),
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-label="Ask the document"
      className={cn(
        "flex h-full flex-col rounded-lg border border-border-subtle bg-card shadow-sm",
        className,
      )}
    >
      <header className="border-b border-border-subtle px-5 py-3">
        <h2 className="text-lg font-semibold">Ask the document</h2>
        <p className="text-xs text-ink-muted">Answers cite the source paragraphs.</p>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && !pending ? (
          <EmptyState />
        ) : null}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} onJumpToParagraph={onJumpToParagraph} />
        ))}
        {pending ? (
          <div className="flex items-start gap-2 text-ink-muted">
            <span aria-hidden className="mt-1.5 h-2 w-2 animate-pulse rounded-full bg-coral-bg" />
            <LatencyEstimator
              startMs={pending.startMs}
              message="Usually takes 3-10 seconds…"
            />
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) void ask(input);
        }}
        className="border-t border-border-subtle px-5 py-3"
      >
        <ul className="mb-2 flex flex-wrap gap-1" aria-label="Quick prompts">
          {chips.map((chip) => (
            <li key={chip.label}>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => ask(chip.question)}
                className="rounded-full border border-border-subtle px-3 py-1 text-xs text-ink-muted transition-colors duration-fast ease-out hover:bg-card-muted disabled:opacity-40"
              >
                {chip.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <label htmlFor="ask-chat-input" className="sr-only">
            Ask a question
          </label>
          <input
            id="ask-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this document…"
            disabled={Boolean(pending)}
            className="flex-1 rounded-md border border-border-subtle bg-canvas px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-focus"
          />
          <button
            type="submit"
            disabled={Boolean(pending) || input.trim().length === 0}
            className="rounded-md bg-coral-bg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>
    </section>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="grid h-full place-items-center text-center text-ink-muted">
      <div>
        <p className="text-sm">Ask a question — answers cite the source.</p>
        <p className="mt-1 text-xs">Try a quick chip above to get started.</p>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onJumpToParagraph,
}: {
  message: Message;
  onJumpToParagraph?: (p: number) => void;
}): React.JSX.Element {
  const isUser = message.role === "user";
  // Tokenize the prose once per render. User messages are plain text — no
  // citations — so the tokenizer returns the same string as a single text
  // fragment, which is the correct behavior.
  const nodes = tokenizeProse(message.prose, onJumpToParagraph);
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser ? "bg-coral-bg text-white" : "bg-card-muted text-ink",
        )}
      >
        {message.prose ? (
          <p className="whitespace-pre-wrap">{nodes}</p>
        ) : (
          <p className="italic text-ink-muted">Thinking…</p>
        )}
        {!isUser && message.citations && message.citations.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1">
            {message.citations.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onJumpToParagraph?.(c.paragraphIndex)}
                  className="rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-medium text-coral-text hover:bg-coral-bg hover:text-white"
                >
                  ↗ ¶{c.paragraphIndex + 1}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
