export const STORAGE_KEYS = {
  submittedEssayText: "submittedEssayText",
  latestFeedback: "latestFeedback",
} as const;

export const FUNCTION_LABELS = {
  content: "Content",
  interpersonal: "Interpersonal",
  organization: "Organization",
} as const;

export const LEVEL_LABELS = {
  text: "Text Level",
  section: "Section Level",
  clause_word: "Clause & Word Level",
} as const;

export const SEVERITY_LABELS = {
  low: "Low Priority",
  medium: "Medium Priority",
  high: "High Priority",
} as const;

export const SERIOUSNESS_LABELS = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  "Extra high": "Extra high",
} as const;

export const STUDENT_PRIORITY_LABELS = {
  "Minor polish": "Minor polish",
  "Useful improvement": "Useful improvement",
  "Important revision": "Important revision",
  "Must revise first": "Must revise first",
} as const;
