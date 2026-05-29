import type { Annotation, Paragraph } from "../../shared/schema.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildParagraphMap(paragraphs: Paragraph[]): Map<string, Paragraph> {
  const map = new Map<string, Paragraph>();
  for (const paragraph of paragraphs) {
    map.set(paragraph.id.toLowerCase(), paragraph);
  }
  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sliceParagraph(
  paragraph: Paragraph,
  paragraphAnnotations: Annotation[],
): string {
  const sorted = [...paragraphAnnotations].sort(
    (a, b) => a.char_start - b.char_start,
  );
  if (sorted.length === 0) {
    return `<p data-paragraph-id="${paragraph.id}">${escapeHtml(paragraph.text)}</p>`;
  }

  let cursor = 0;
  const parts: string[] = [];

  for (const item of sorted) {
    const start = clamp(item.char_start, cursor, paragraph.text.length);
    const end = clamp(item.char_end, start, paragraph.text.length);
    if (start > cursor) {
      parts.push(escapeHtml(paragraph.text.slice(cursor, start)));
    }
    const slice = paragraph.text.slice(start, end);
    parts.push(
      `<span class="hl hl-${item.severity}" data-id="${item.id}">${escapeHtml(slice)}</span>`,
    );
    cursor = end;
  }

  if (cursor < paragraph.text.length) {
    parts.push(escapeHtml(paragraph.text.slice(cursor)));
  }

  const pins = sorted
    .map(
      (item) =>
        `<button type="button" class="annotation-pin pin-${item.severity}" data-id="${item.id}" title="Annotation ${item.id}">${item.id}</button>`,
    )
    .join("");

  return `<p data-paragraph-id="${paragraph.id}">${parts.join("")}${pins}</p>`;
}

export function renderEssayMarkup(
  paragraphs: Paragraph[],
  annotations: Annotation[],
): string {
  const paragraphMap = buildParagraphMap(paragraphs);
  const grouped = new Map<string, Annotation[]>();
  for (const item of annotations) {
    const key = item.paragraph_id.toLowerCase();
    if (!paragraphMap.has(key)) continue;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  return paragraphs
    .map((paragraph) => sliceParagraph(paragraph, grouped.get(paragraph.id.toLowerCase()) ?? []))
    .join("");
}
