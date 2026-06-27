"use client";

/**
 * ImportDropzone — visible input surface for adding content to ReadMaxxing.
 *
 * Per UI-UX.md §6, this is the "Add a document" zero-friction surface.
 * It supports four input modes, all visible from a single screen:
 *   1. Drag-drop a file (PDF, DOCX, EPUB, MD, TXT, or scanned image)
 *   2. Click "Choose a file" to use the native file picker
 *   3. Type or paste text into the textarea — explicit field, no focus trap
 *   4. Paste an image (Cmd/Ctrl+V from a screenshot) — handled by the textarea
 *      onPaste if the cursor is inside, or by the dropzone otherwise
 *   5. Fetch from a URL — server-side fetch + readability extraction
 *
 * On submit, the document navigates to /reader/[docId]. UI-UX.md §6 says
 * this should "import immediately" without an account gate.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, cn } from "@readmaxxing/ui";

type SupportedType = "pdf" | "docx" | "epub" | "md" | "txt" | "image" | "scanned-pdf" | "url";

const ACCEPTED = ".pdf,.docx,.epub,.md,.txt,.markdown,.png,.jpg,.jpeg,.tiff,.tif,.webp";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "tiff", "tif", "webp"]);

const TEXT_PLACEHOLDER =
  "Paste an article, chapter, notes, or anything you want to listen to.";

const URL_PLACEHOLDER = "Paste a link to a webpage or article…";

export interface ImportDropzoneProps {
  /** Override the POST endpoint for tests. */
  endpoint?: string;
  /** Override the OCR endpoint for tests. */
  ocrEndpoint?: string;
  onImported?: (payload: { id: string; title: string }) => void;
  className?: string;
}

interface ImportResponse {
  id: string;
  title: string;
  status: "queued" | "parsed";
  message?: string;
}

interface OcrImportResponse {
  documentId: string;
  title: string;
  pageCount: number;
  medianConfidence: number;
  lowConfidence: boolean;
  status: "parsed";
  message?: string;
}

type Mode = "file" | "text" | "url";

export function ImportDropzone({
  endpoint = "/api/import",
  ocrEndpoint = "/api/import/ocr",
  onImported,
  className,
}: ImportDropzoneProps): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("file");
  const [isDragging, setIsDragging] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "extracting" | "importing" | "ocr-scanning" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = React.useState<{ processed: number; total: number } | null>(null);

  // Form state
  const [textValue, setTextValue] = React.useState("");
  const [urlValue, setUrlValue] = React.useState("");
  const [textTitle, setTextTitle] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const urlInputRef = React.useRef<HTMLInputElement | null>(null);

  const isBusy = status === "extracting" || status === "importing" || status === "ocr-scanning";

  async function extractText(file: File): Promise<{ text: string; title: string; sourceType: SupportedType }> {
    const name = file.name;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "txt" || ext === "md" || ext === "markdown") {
      const text = await file.text();
      return { text, title: name.replace(/\.[^.]+$/, ""), sourceType: ext === "md" || ext === "markdown" ? "md" : "txt" };
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return {
        text: result.value,
        title: name.replace(/\.[^.]+$/, ""),
        sourceType: "docx",
      };
    }
    if (ext === "pdf") {
      const text = await extractPdf(file);
      return { text, title: name.replace(/\.[^.]+$/, ""), sourceType: "pdf" };
    }
    if (ext === "epub") {
      const text = await file.text();
      return { text, title: name.replace(/\.[^.]+$/, ""), sourceType: "epub" };
    }
    if (IMAGE_EXTENSIONS.has(ext)) {
      return { text: "", title: name.replace(/\.[^.]+$/, ""), sourceType: "image" };
    }
    throw new Error(`Unsupported file type: .${ext}`);
  }

  async function submit(
    payload: Record<string, unknown>,
  ): Promise<ImportResponse> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({ message: res.statusText }))) as {
        message?: string;
      };
      throw new Error(data.message ?? `Import failed (${res.status})`);
    }
    return (await res.json()) as ImportResponse;
  }

  async function submitOcr(file: File, title: string): Promise<OcrImportResponse> {
    setStatus("ocr-scanning");
    setOcrProgress({ processed: 0, total: 1 });
    let processed = 0;
    const ticker = window.setInterval(() => {
      processed = Math.min(processed + 1, 1);
      setOcrProgress((p) => (p ? { processed, total: p.total } : null));
    }, 500);

    try {
      const form = new FormData();
      form.append(file.name.endsWith(".pdf") ? "pdf" : "image", file, file.name);
      form.append("title", title);
      const res = await fetch(ocrEndpoint, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(data.message ?? data.error ?? `OCR failed (${res.status})`);
      }
      const data = (await res.json()) as OcrImportResponse;
      setOcrProgress({ processed: data.pageCount, total: data.pageCount });
      return data;
    } finally {
      window.clearInterval(ticker);
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    setInfo(null);
    for (const file of list) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      try {
        if (IMAGE_EXTENSIONS.has(ext)) {
          const title = file.name.replace(/\.[^.]+$/, "");
          const out = await submitOcr(file, title);
          if (!out?.documentId) throw new Error("OCR returned no document id");
          onImported?.({ id: out.documentId, title: out.title });
          router.push(`/reader/${out.documentId}`);
          setStatus("idle");
          setOcrProgress(null);
          setInfo(null);
          return;
        }
        setStatus("extracting");
        const { text, title, sourceType } = await extractText(file);
        setStatus("importing");
        setInfo(`Importing ${title}…`);
        const out = await submit({ text, title, sourceType });
        if (!out?.id) throw new Error("Server returned no document id");
        onImported?.({ id: out.id, title: out.title });
        router.push(`/reader/${out.id}`);
        setInfo(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't import that file.");
        setStatus("error");
        return;
      }
    }
    setStatus("idle");
    setInfo(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textValue.trim()) return;
    setStatus("importing");
    setInfo("Importing…");
    setError(null);
    try {
      const title = textTitle.trim() || deriveTextTitle(textValue);
      const out = await submit({ text: textValue, title, sourceType: "txt" });
      if (!out?.id) throw new Error("Server returned no document id");
      setTextValue("");
      setTextTitle("");
      onImported?.({ id: out.id, title: out.title });
      router.push(`/reader/${out.id}`);
      setInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that text.");
      setStatus("error");
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!urlValue.trim()) return;
    setStatus("importing");
    setInfo("Importing…");
    setError(null);
    try {
      const out = await submit({
        type: "url",
        url: urlValue.trim(),
        title: textTitle.trim() || undefined,
        sourceType: "url",
      });
      if (!out?.id) throw new Error("Server returned no document id");
      setUrlValue("");
      setTextTitle("");
      onImported?.({ id: out.id, title: out.title });
      router.push(`/reader/${out.id}`);
      setInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't fetch that URL.");
      setStatus("error");
    }
  }

  /**
   * Paste handling at the dropzone level (when focus is *not* inside the
   * textarea). Catches pasted text and pasted images from screenshots.
   */
  async function handleZonePaste(e: React.ClipboardEvent<HTMLDivElement>): Promise<void> {
    // If the user pasted into the textarea, let the textarea handle it.
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

    const items = e.clipboardData?.items;
    if (items && items.length > 0) {
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          e.preventDefault();
          const raw = item.getAsFile();
          if (raw) {
            const renamed = new File(
              [raw],
              `pasted-${Date.now()}.${item.type.split("/")[1] ?? "png"}`,
              { type: raw.type },
            );
            await handleFiles([renamed]);
          }
          return;
        }
      }
    }

    const text = e.clipboardData?.getData("text/plain");
    if (!text || text.trim().length === 0) return;
    e.preventDefault();
    setMode("text");
    setTextValue(text);
    // Auto-submit if the textarea was empty before this paste.
    setStatus("importing");
    setInfo("Importing…");
    setError(null);
    try {
      const title = deriveTextTitle(text);
      const out = await submit({ text, title, sourceType: "txt" });
      if (!out?.id) throw new Error("Server returned no document id");
      setTextValue("");
      onImported?.({ id: out.id, title: out.title });
      router.push(`/reader/${out.id}`);
      setInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that text.");
      setStatus("error");
    }
  }

  /**
   * Paste handling *inside the textarea*. If the paste contains an image
   * (e.g. a screenshot), send it to the OCR endpoint; otherwise let the
   * textarea receive the text normally.
   */
  async function handleTextareaPaste(e: React.ClipboardEvent<HTMLTextAreaElement>): Promise<void> {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        e.preventDefault();
        const raw = item.getAsFile();
        if (raw) {
          const renamed = new File(
            [raw],
            `pasted-${Date.now()}.${item.type.split("/")[1] ?? "png"}`,
            { type: raw.type },
          );
          await handleFiles([renamed]);
        }
        return;
      }
    }
    // Plain text — let the textarea handle it normally.
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) void handleFiles([file]);
    // Reset so picking the same file again re-triggers onChange
    e.target.value = "";
  }

  const inputClass =
    "h-12 w-full rounded-md border border-border bg-card px-4 text-base text-ink placeholder:text-ink-faint transition-colors focus-visible:outline-none focus-visible:border-coral-bg focus-visible:shadow-focus";
  const labelClass = "text-sm font-medium text-ink";

  return (
    <Card padding="none" className={cn("flex w-full flex-col gap-4 p-4 sm:p-5", className)}>
      {/* Mode tabs — segmented control for which input mode is active */}
      <div
        role="tablist"
        aria-label="Import mode"
        className="flex w-full items-center gap-1 rounded-full bg-card-muted p-1 text-sm sm:w-fit"
      >
        {(["file", "text", "url"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={cn(
              "flex-1 rounded-full px-4 py-1.5 font-medium transition-colors duration-fast ease-out sm:flex-none",
              "focus-visible:outline-none focus-visible:shadow-focus",
              mode === m
                ? "bg-card text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {m === "file" ? "File" : m === "text" ? "Text" : "URL"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onPaste={handleZonePaste}
          tabIndex={0}
          role="region"
          aria-label="Drop a file or paste a screenshot to import"
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center sm:py-12",
            "transition-colors duration-base ease-out focus-visible:outline-none focus-visible:shadow-focus",
            isDragging
              ? "border-coral-bg bg-coral-soft"
              : "border-border bg-canvas",
            status === "error" ? "border-danger" : "",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              isDragging ? "bg-white/60 text-coral-text" : "bg-card-muted text-ink-muted",
            )}
          >
            <UploadIcon />
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold text-ink">
              {isDragging ? "Drop to import" : "Drop a file or paste a screenshot"}
            </p>
            <p className="text-sm text-ink-muted">
              PDF, DOCX, EPUB, Markdown, TXT — or an image to scan
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              loading={status === "extracting" || status === "importing"}
            >
              {status === "extracting" ? "Extracting…" : status === "importing" ? "Importing…" : "Choose file"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => imageInputRef.current?.click()}
              loading={status === "ocr-scanning"}
            >
              {status === "ocr-scanning" ? "Scanning…" : "Scan an image"}
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.tiff,.tif,.webp"
              className="sr-only"
              onChange={handleImageFile}
            />
          </div>
        </div>
      ) : null}

      {mode === "text" ? (
        <form onSubmit={handleTextSubmit} className="flex w-full flex-col gap-3">
          <label htmlFor="import-text-title" className={labelClass}>
            Title <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="import-text-title"
            type="text"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Uses the first sentence if left blank"
            className={inputClass}
          />
          <label htmlFor="import-text-body" className={labelClass}>
            Paste or type text
          </label>
          <textarea
            id="import-text-body"
            ref={textAreaRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onPaste={handleTextareaPaste}
            placeholder={TEXT_PLACEHOLDER}
            rows={7}
            className="w-full rounded-md border border-border bg-card px-4 py-3 text-base text-ink placeholder:text-ink-faint transition-colors focus-visible:outline-none focus-visible:border-coral-bg focus-visible:shadow-focus"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="md" disabled={!textValue.trim()} loading={status === "importing"}>
              {status === "importing" ? "Importing…" : "Import text"}
            </Button>
            <p className="tabular text-xs text-ink-muted">
              {textValue.length.toLocaleString()} characters · ~{Math.max(1, Math.round(textValue.split(/\s+/).filter(Boolean).length / 220))} min
            </p>
          </div>
        </form>
      ) : null}

      {mode === "url" ? (
        <form onSubmit={handleUrlSubmit} className="flex w-full flex-col gap-3">
          <label htmlFor="import-url-title" className={labelClass}>
            Title <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="import-url-title"
            type="text"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Uses the page title if left blank"
            className={inputClass}
          />
          <label htmlFor="import-url-body" className={labelClass}>
            URL
          </label>
          <input
            id="import-url-body"
            ref={urlInputRef}
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder={URL_PLACEHOLDER}
            className={inputClass}
          />
          <div>
            <Button type="submit" variant="primary" size="md" disabled={!urlValue.trim()} loading={status === "importing"}>
              {status === "importing" ? "Fetching…" : "Fetch & import"}
            </Button>
          </div>
        </form>
      ) : null}

      {/* Status / progress / error row — shared across modes */}
      {(status === "ocr-scanning" && ocrProgress) || info || error ? (
        <div className="flex flex-col gap-1">
          {status === "ocr-scanning" && ocrProgress ? (
            <p className="tabular text-xs text-ink-muted" aria-live="polite">
              Scanning {ocrProgress.processed} / {ocrProgress.total} page
              {ocrProgress.total === 1 ? "" : "s"}…
            </p>
          ) : null}
          {info ? <p className="tabular text-xs text-ink-muted">{info}</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function UploadIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Derive a document title from the first non-empty line of pasted text. */
function deriveTextTitle(text: string): string {
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  if (!firstLine) return "Pasted text";
  const truncated = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
  return truncated;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .filter(Boolean)
      .join(" ");
    pages.push(pageText);
  }
  return pages.join("\n\n");
}