function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function buildParagraphMap(paragraphs) {
    const map = new Map();
    for (const paragraph of paragraphs) {
        map.set(paragraph.id.toLowerCase(), paragraph);
    }
    return map;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function sliceParagraph(paragraph, paragraphAnnotations) {
    const sorted = [...paragraphAnnotations].sort((a, b) => a.char_start - b.char_start);
    if (sorted.length === 0) {
        return `<p data-paragraph-id="${paragraph.id}">${escapeHtml(paragraph.text)}</p>`;
    }
    let cursor = 0;
    const parts = [];
    for (const item of sorted) {
        const start = clamp(item.char_start, cursor, paragraph.text.length);
        const end = clamp(item.char_end, start, paragraph.text.length);
        if (start > cursor) {
            parts.push(escapeHtml(paragraph.text.slice(cursor, start)));
        }
        const slice = paragraph.text.slice(start, end);
        parts.push(`<span class="hl hl-${item.severity}" data-id="${item.id}">${escapeHtml(slice)}</span>`);
        cursor = end;
    }
    if (cursor < paragraph.text.length) {
        parts.push(escapeHtml(paragraph.text.slice(cursor)));
    }
    const pins = sorted
        .map((item) => `<button type="button" class="annotation-pin pin-${item.severity}" data-id="${item.id}" title="Annotation ${item.id}">${item.id}</button>`)
        .join("");
    return `<p data-paragraph-id="${paragraph.id}">${parts.join("")}${pins}</p>`;
}
export function renderEssayMarkup(paragraphs, annotations) {
    const paragraphMap = buildParagraphMap(paragraphs);
    const grouped = new Map();
    for (const item of annotations) {
        const key = item.paragraph_id.toLowerCase();
        if (!paragraphMap.has(key))
            continue;
        const list = grouped.get(key) ?? [];
        list.push(item);
        grouped.set(key, list);
    }
    return paragraphs
        .map((paragraph) => sliceParagraph(paragraph, grouped.get(paragraph.id.toLowerCase()) ?? []))
        .join("");
}
