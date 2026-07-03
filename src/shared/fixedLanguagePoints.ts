import type { FunctionDimension, LinguisticLevel } from "./schema.js";

export const FIXED_LANGUAGE_POINT_IDS = [
  "general_to_specific",
  "topic_sentences",
  "theme_new_information_order",
  "nominalization",
  "sentence_connection",
] as const;

export type FixedLanguagePointId = (typeof FIXED_LANGUAGE_POINT_IDS)[number];

export interface FixedLanguagePoint {
  id: FixedLanguagePointId;
  name: string;
  issueTypeLabel: string;
  function: FunctionDimension;
  level: LinguisticLevel;
  checklist: string[];
  matchPatterns: RegExp[];
}

/**
 * Fixed language points checked on every assignment submission.
 * Tutor feedback must cover all of these, regardless of overall draft quality.
 */
export const FIXED_LANGUAGE_POINTS: readonly FixedLanguagePoint[] = [
  {
    id: "general_to_specific",
    name: "General-to-specific organization",
    issueTypeLabel: "General-to-specific organization",
    function: "organization",
    level: "text",
    checklist: [
      "Does content move from general information to more specific information?",
      "Is paragraph structure reasonable for a general-to-specific progression?",
    ],
    matchPatterns: [
      /general[- ]to[- ]specific/i,
      /general.?specific/i,
      /general to specific organization/i,
    ],
  },
  {
    id: "topic_sentences",
    name: "Topic sentences",
    issueTypeLabel: "Topic sentences",
    function: "organization",
    level: "section",
    checklist: [
      "Does each paragraph have a clear topic sentence?",
      "Does the topic sentence accurately preview the paragraph content?",
    ],
    matchPatterns: [/topic sentence/i],
  },
  {
    id: "theme_new_information_order",
    name: "Theme–new information order",
    issueTypeLabel: "Theme–new information order",
    function: "organization",
    level: "clause_word",
    checklist: [
      "Is known information placed at the start of the sentence (Theme)?",
      "Is new information placed later in the sentence (New)?",
      "Is information flow coherent between sentences?",
    ],
    matchPatterns: [
      /theme[-–— ]?new/i,
      /theme\/new/i,
      /theme.?new information/i,
      /known information/i,
    ],
  },
  {
    id: "nominalization",
    name: "Nominalization",
    issueTypeLabel: "Nominalization",
    function: "content",
    level: "clause_word",
    checklist: [
      "Is nominalization used to recap known information?",
      "Is nominalization used to preview or summarize following content?",
      "Does the use of nominalization fit academic writing style?",
    ],
    matchPatterns: [/nominali[sz]ation/i],
  },
  {
    id: "sentence_connection",
    name: "Sentence connection and conjunction use",
    issueTypeLabel: "Sentence connection and conjunction use",
    function: "organization",
    level: "clause_word",
    checklist: [
      "Are coordinating conjunctions (and, but, so) overused to join independent clauses?",
      "Are conjunctive adverbs (therefore, moreover, etc.) overused?",
      "Could Theme–new information order create more natural cohesion instead?",
    ],
    matchPatterns: [
      /sentence connection/i,
      /conjunction use/i,
      /conjunctive adverb/i,
      /\b(and|but|so)\b.*\b(connect|join|link)/i,
    ],
  },
] as const;

export const FIXED_LANGUAGE_POINT_COUNT = FIXED_LANGUAGE_POINTS.length;

export function getFixedLanguagePoint(
  id: FixedLanguagePointId,
): FixedLanguagePoint {
  const point = FIXED_LANGUAGE_POINTS.find((item) => item.id === id);
  if (!point) {
    throw new Error(`Unknown fixed language point: ${id}`);
  }
  return point;
}

export function formatFixedLanguagePointsForPrompt(): string {
  return FIXED_LANGUAGE_POINTS.map((point, index) => {
    const checks = point.checklist.map((item) => `   - ${item}`).join("\n");
    return `${index + 1}. language_point_id: "${point.id}"
   Name: ${point.name}
   Required function: ${point.function}
   Required level: ${point.level}
   issue_type MUST use this label after the quality prefix: "${point.issueTypeLabel}"
   Check ALL of the following:
${checks}`;
  }).join("\n\n");
}

export function matchFixedLanguagePointId(
  text: string,
): FixedLanguagePointId | null {
  for (const point of FIXED_LANGUAGE_POINTS) {
    if (point.matchPatterns.some((pattern) => pattern.test(text))) {
      return point.id;
    }
  }
  return null;
}
