import { z } from "zod";
import { normalizeAnnotationOffsets } from "./annotationNormalizer.js";
import type { FeedbackResponse, Paragraph } from "../../shared/schema.js";

const citationSchema = z.object({
  type: z.enum(["rubric", "course_material"]),
  label: z.string(),
  url: z.string().nullable(),
});

const evidenceSchema = z.object({
  quote: z.string(),
  reason: z.string(),
});

const seriousnessMetadataSchema = z.object({
  rubric_category: z.enum([
    "Content",
    "Organization: Whole text",
    "Organization: Paragraph level",
    "Organization: Clause level",
    "Presentation",
  ]).optional(),
  seriousness: z.enum(["Low", "Medium", "High", "Extra high"]),
  reason: z.string(),
  student_priority: z.enum([
    "Minor polish",
    "Useful improvement",
    "Important revision",
    "Must revise first",
  ]),
});

const annotationSchema = z.object({
  id: z.number().int(),
  paragraph_id: z.string(),
  char_start: z.number().int().nonnegative(),
  char_end: z.number().int().nonnegative(),
  function: z.enum(["content", "interpersonal", "organization"]),
  level: z.enum(["text", "section", "clause_word"]),
  issue_type: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  evidence: evidenceSchema,
  feedback: z.string(),
  revision_guidance: z.string(),
  citations: z.array(citationSchema),
  rubric_category: seriousnessMetadataSchema.shape.rubric_category.optional(),
  seriousness: seriousnessMetadataSchema.shape.seriousness.optional(),
  reason: z.string().optional(),
  student_priority: seriousnessMetadataSchema.shape.student_priority.optional(),
});

const overallFeedbackSchema = z.object({
  summary: z.string(),
  priority_issues: z.array(z.string()),
  next_steps: z.array(z.string()),
  reflection_questions: z.array(z.string()),
});

const feedbackSchema = z.object({
  submission_id: z.string().nullable(),
  created_at: z.string().nullable(),
  essay: z.object({
    paragraphs: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
      }),
    ),
  }),
  annotations: z.array(annotationSchema),
  overall_feedback: overallFeedbackSchema,
});

function normalizeFeedback(feedback: FeedbackResponse, paragraphs: Paragraph[]): FeedbackResponse {
  const paragraphById = new Map(
    paragraphs.map((item) => [item.id.toLowerCase(), item.text] as const),
  );

  const safeAnnotations = normalizeAnnotationOffsets(
    feedback.annotations.map((item) => ({
      ...item,
      paragraph_id: item.paragraph_id.toLowerCase(),
    })),
    paragraphById,
  );

  return {
    ...feedback,
    submission_id: null,
    created_at: null,
    essay: { paragraphs },
    annotations: safeAnnotations,
  };
}

export function validateFeedbackResponse(raw: unknown, paragraphs: Paragraph[]): FeedbackResponse {
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Feedback schema validation failed: ${parsed.error.message}`);
  }
  return normalizeFeedback(parsed.data as FeedbackResponse, paragraphs);
}
