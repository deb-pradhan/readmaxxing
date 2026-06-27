/**
 * Document source taxonomy — single source of truth for source-type
 * labels and chip → sourceType matching (Phase D P1 D.3).
 *
 * Previously the library page hard-coded two lists:
 *   - filter chip labels: ["All", "Pasted", "URL", "PDF", "EPUB"]
 *   - sourceType values:  "pdf" | "docx" | "md" | "epub" | "txt" | "url" | "paste"
 * and the comparison was `sourceType.toLowerCase() === filter.toLowerCase()` —
 * `"paste"` ≠ `"pasted"` so the Pasted chip was always empty. This module
 * fixes that and keeps one mapping consumed by the page (chips) and by
 * ImportDropzone / API consumers (label rendering).
 */

export type DocumentSourceType =
  | "pdf"
  | "docx"
  | "md"
  | "epub"
  | "txt"
  | "url"
  | "paste";

/**
 * Canonical user-facing label per source type. Pasted → "Pasted" so the
 * chip text matches the data type (`paste`) via this map rather than
 * string comparison. (Audit + Phase D D.3 fix.)
 */
export const DOCUMENT_SOURCE_LABELS: Record<DocumentSourceType, string> = {
  pdf: "PDF",
  docx: "DOCX",
  md: "Markdown",
  epub: "EPUB",
  txt: "Text",
  url: "URL",
  paste: "Pasted",
};

/**
 * Reverse map — chip label → source type. Filter chips use these labels,
 * so the reverse lookup is what filters docs by chip selection.
 */
export const DOCUMENT_SOURCE_BY_LABEL: Record<string, DocumentSourceType> =
  Object.fromEntries(
    Object.entries(DOCUMENT_SOURCE_LABELS).map(([k, v]) => [v, k as DocumentSourceType]),
  );

/**
 * Filter chip definitions used by the library page. The labels come from
 * DOCUMENT_SOURCE_LABELS so the chip text always matches a source type
 * (no more empty "Pasted" filter).
 */
export const LIBRARY_FILTERS = [
  { label: "All", match: null as DocumentSourceType | null },
  {
    label: DOCUMENT_SOURCE_LABELS.paste,
    match: "paste" as DocumentSourceType,
  },
  {
    label: DOCUMENT_SOURCE_LABELS.url,
    match: "url" as DocumentSourceType,
  },
  {
    label: DOCUMENT_SOURCE_LABELS.pdf,
    match: "pdf" as DocumentSourceType,
  },
  {
    label: DOCUMENT_SOURCE_LABELS.epub,
    match: "epub" as DocumentSourceType,
  },
] as const;

export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

/** Apply a library filter to a list of docs. */
export function applyLibraryFilter<
  T extends { sourceType: DocumentSourceType },
>(docs: T[], filter: LibraryFilter): T[] {
  if (filter.match === null) return docs;
  return docs.filter((d) => d.sourceType === filter.match);
}