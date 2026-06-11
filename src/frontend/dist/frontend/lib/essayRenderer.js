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
function buildHighlightSegments(paragraphText, paragraphAnnotations) {
    if (paragraphAnnotations.length === 0) {
        return [];
    }
    const boundaries = new Set([0, paragraphText.length]);
    for (const item of paragraphAnnotations) {
        boundaries.add(clamp(item.char_start, 0, paragraphText.length));
        boundaries.add(clamp(item.char_end, 0, paragraphText.length));
    }
    const points = [...boundaries].sort((a, b) => a - b);
    const segments = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index] ?? 0;
        const end = points[index + 1] ?? paragraphText.length;
        if (start >= end) {
            continue;
        }
        const ids = paragraphAnnotations
            .filter((item) => item.char_start < end && item.char_end > start)
            .map((item) => item.id);
        segments.push({ start, end, ids });
    }
    return segments;
}
function sliceParagraph(paragraph, paragraphAnnotations) {
    const sorted = [...paragraphAnnotations].sort((a, b) => a.char_start - b.char_start || a.id - b.id);
    if (sorted.length === 0) {
        return `<p data-paragraph-id="${paragraph.id}">${escapeHtml(paragraph.text)}</p>`;
    }
    const segments = buildHighlightSegments(paragraph.text, sorted);
    const parts = segments.map((segment) => {
        const slice = paragraph.text.slice(segment.start, segment.end);
        if (segment.ids.length === 0) {
            return escapeHtml(slice);
        }
        const primary = sorted.find((item) => item.id === segment.ids[0]) ?? sorted[0];
        const severityClass = primary ? ` hl-${primary.severity}` : "";
        return `<span class="hl${severityClass}" data-id="${primary?.id ?? segment.ids[0]}" data-ids="${segment.ids.join(",")}">${escapeHtml(slice)}</span>`;
    });
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
