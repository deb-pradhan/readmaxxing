import { Card, CardHeader } from "@readmaxxing/ui";
import { buildSegmentTree } from "@readmaxxing/core";
import { SPEED_PRESETS } from "@readmaxxing/config";

/**
 * Home — landing + a tiny smoke test that proves the segment-tree builder
 * and the package exports are wired correctly.
 *
 * Phase 2 replaces this with the real onboarding + library surfaces per
 * UI-UX.md §6.
 */
export default function HomePage(): React.JSX.Element {
  // Smoke test: round-trip a small passage through the segment tree.
  const tree = buildSegmentTree(
    "Hello world. This is a test. Dr. Smith met Mr. Jones at 5 p.m.",
    { documentId: "smoke-test" },
  );
  const firstSentence = tree.paragraphs[0]?.sentences[0]?.text ?? "(none)";

  return (
    <main className="mx-auto max-w-reading px-4 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          Phase 1 · Foundations
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-snug">
          ReadMaxxing
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          A Speechify-class voice AI reading app. The content is the hero.
        </p>
      </header>

      <Card padding="lg">
        <CardHeader
          title="Foundations check"
          description="Everything below should be live in Phase 1."
        />
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Segment tree word count</dt>
            <dd className="tabular text-lg font-semibold">{tree.wordCount}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Estimated read time</dt>
            <dd className="tabular text-lg font-semibold">
              {tree.estimatedReadTimeSeconds}s
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">First sentence (smoke test)</dt>
            <dd className="font-serif text-base">{firstSentence}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">Speed presets</dt>
            <dd className="tabular text-base">
              {SPEED_PRESETS.join("× · ")}
              {SPEED_PRESETS.at(-1)}
              {"×"}
            </dd>
          </div>
        </dl>
      </Card>

      <p className="mt-8 text-xs text-ink-faint">
        Next: Phase 2 — Reader Core (import pipeline, streaming player,
        karaoke, library, cross-device sync).
      </p>
    </main>
  );
}