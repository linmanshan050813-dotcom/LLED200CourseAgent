export type FunctionDimension = "content" | "interpersonal" | "organization";
export type LinguisticLevel = "text" | "section" | "clause_word";
export type Severity = "low" | "medium" | "high";

export type RubricCategory =
  | "Content"
  | "Organization: Whole text"
  | "Organization: Paragraph level"
  | "Organization: Clause level"
  | "Presentation";

export type FeedbackSeriousness = "Low" | "Medium" | "High" | "Extra high";

export type StudentPriority =
  | "Minor polish"
  | "Useful improvement"
  | "Important revision"
  | "Must revise first";

export interface SeriousnessMetadata {
  rubric_category?: RubricCategory;
  seriousness: FeedbackSeriousness;
  reason: string;
  student_priority: StudentPriority;
}

export interface Paragraph {
  id: string;
  text: string;
}

export interface Citation {
  type: "rubric" | "course_material";
  label: string;
  url: string | null;
}

export interface Evidence {
  quote: string;
  reason: string;
}

export interface Annotation {
  id: number;
  paragraph_id: string;
  char_start: number;
  char_end: number;
  function: FunctionDimension;
  level: LinguisticLevel;
  issue_type: string;
  severity: Severity;
  evidence: Evidence;
  feedback: string;
  revision_guidance: string;
  citations: Citation[];
  rubric_category?: RubricCategory;
  seriousness?: FeedbackSeriousness;
  reason?: string;
  student_priority?: StudentPriority;
}

/** Annotation after seriousness evaluation (API response shape). */
export type EvaluatedAnnotation = Annotation & SeriousnessMetadata;

export interface OverallFeedback {
  summary: string;
  priority_issues: string[];
  next_steps: string[];
  reflection_questions: string[];
}

export interface FeedbackResponse {
  submission_id: string | null;
  created_at: string | null;
  essay: { paragraphs: Paragraph[] };
  annotations: Annotation[];
  overall_feedback: OverallFeedback;
}
