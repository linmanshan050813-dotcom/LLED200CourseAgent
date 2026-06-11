import {
  FUNCTION_LABELS,
  LEVEL_LABELS,
  SERIOUSNESS_LABELS,
  STUDENT_PRIORITY_LABELS,
} from "../../shared/constants.js";
import { getCourseMaterialLabel } from "../../shared/courseMaterials.js";
import type { Annotation, Citation, OverallFeedback } from "../../shared/schema.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCitations(_citations: Citation[]): string {
  return "";
}

function getCourseMaterial(item: Annotation): Citation {
  const courseMaterial = item.citations.find(
    (citation) => citation.type === "course_material",
  );

  return (
    courseMaterial ?? {
      type: "course_material",
      label: getCourseMaterialLabel(item.function, item.level),
      url: null,
    }
  );
}

function renderLearningModule(item: Annotation): string {
  const material = getCourseMaterial(item);
  const label = escapeHtml(material.label);
  const materialLink =
    material.url && material.url.length > 0
      ? `<a class="learning-module__link" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">${label}</a>`
      : `<span class="learning-module__file">${label}</span>`;

  return `
  <aside class="learning-module" aria-label="Suggested course material">
    <div class="learning-module__eyebrow">Suggested course material</div>
    <div class="learning-module__body">
      Review this lesson before revising:
      ${materialLink}
    </div>
  </aside>`;
}

function seriousnessClass(seriousness: string | undefined): string {
  switch (seriousness) {
    case "Extra high":
      return "seriousness-extra-high";
    case "High":
      return "seriousness-high";
    case "Medium":
      return "seriousness-medium";
    case "Low":
      return "seriousness-low";
    default:
      return "seriousness-medium";
  }
}

export function renderSidebarCards(annotations: Annotation[]): string {
  if (annotations.length === 0) {
    return `<div class="feedback-card feedback-card--empty"><div class="feedback-card__text">No feedback in the current filter.</div></div>`;
  }

  return annotations
    .map((item) => {
      const fnLabel = FUNCTION_LABELS[item.function];
      const levelLabel = LEVEL_LABELS[item.level];
      const seriousnessLabel = item.seriousness
        ? SERIOUSNESS_LABELS[item.seriousness]
        : null;
      const priorityLabel = item.student_priority
        ? STUDENT_PRIORITY_LABELS[item.student_priority]
        : null;
      const seriousnessMeta =
        item.seriousness && item.student_priority
          ? `<div class="feedback-card__seriousness ${seriousnessClass(item.seriousness)}">
      <span class="feedback-card__tag tag-seriousness">${escapeHtml(seriousnessLabel ?? item.seriousness)}</span>
      <span class="feedback-card__tag tag-priority">${escapeHtml(priorityLabel ?? item.student_priority)}</span>
    </div>`
          : "";

      return `
<article class="feedback-card feedback-card--severity-${item.severity}" data-id="${item.id}" data-function="${item.function}" data-level="${item.level}"${item.seriousness ? ` data-seriousness="${item.seriousness}"` : ""}>
  <header class="feedback-card__header">
    <span class="feedback-card__pin pin-${item.severity}">${item.id}</span>
    <span class="feedback-card__tag tag-function tag-${item.function}">${fnLabel}</span>
    <span class="feedback-card__tag tag-level">${levelLabel}</span>
  </header>
  ${seriousnessMeta}
  <div class="feedback-card__issue">${escapeHtml(item.issue_type)}</div>
  ${
    item.evidence?.quote
      ? `<blockquote class="feedback-card__quote">${escapeHtml(item.evidence.quote)}</blockquote>`
      : ""
  }
  ${
    item.evidence?.reason
      ? `<p class="feedback-card__reason"><strong>Why it matters:</strong> ${escapeHtml(item.evidence.reason)}</p>`
      : ""
  }
  <p class="feedback-card__text"><strong>Feedback:</strong> ${escapeHtml(item.feedback)}</p>
  <p class="feedback-card__guidance"><strong>Revision guidance:</strong> ${escapeHtml(item.revision_guidance)}</p>
  ${renderLearningModule(item)}
  ${renderCitations(item.citations)}
</article>`;
    })
    .join("");
}

function renderList(title: string, items: string[]): string {
  if (items.length === 0) return "";
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="summary-section"><h4>${title}</h4><ul>${lis}</ul></section>`;
}

export function renderSummary(overall: OverallFeedback): string {
  const summary = overall.summary
    ? `<section class="summary-section"><h4>Overall Summary</h4><p>${escapeHtml(overall.summary)}</p></section>`
    : "";

  return `
    <div class="summary-card">
      ${summary}
      ${renderList("Priority Issues", overall.priority_issues)}
      ${renderList("Next Steps", overall.next_steps)}
      ${renderList("Reflection Questions", overall.reflection_questions)}
    </div>
  `;
}
