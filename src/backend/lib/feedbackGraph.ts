import { Annotation as GraphAnnotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { getCourseMaterialLabel } from "../../shared/courseMaterials.js";
import {
  FIXED_LANGUAGE_POINT_COUNT,
  FIXED_LANGUAGE_POINT_IDS,
  FIXED_LANGUAGE_POINTS,
  formatFixedLanguagePointsForPrompt,
  getFixedLanguagePoint,
  matchFixedLanguagePointId,
  type FixedLanguagePointId,
} from "../../shared/fixedLanguagePoints.js";
import type {
  Annotation,
  FeedbackResponse,
  Paragraph,
} from "../../shared/schema.js";
import { formatParagraphsForPrompt, parseEssay } from "./essayParser.js";
import {
  annotationJsonSchema,
  callOpenAiForFeedback,
  callOpenAiForJson,
} from "./openaiClient.js";
import { buildPromptMessages, type PromptMessage } from "./promptBuilder.js";
import { validateFeedbackResponse } from "./schemaValidator.js";
import {
  evaluateFeedbackSeriousness,
  sortAnnotationsBySeriousness,
} from "./seriousnessEvaluator.js";

const FIXED_POINTS_PROMPT_BLOCK = `
FIXED LANGUAGE POINTS (MANDATORY — EVERY SUBMISSION):
You MUST return exactly ${FIXED_LANGUAGE_POINT_COUNT} annotations: one for EACH fixed language point below.
Do NOT freely choose only the most obvious issues. Check every fixed point even when the draft is strong overall.
If a point is handled well, return a strength (Strong/Good). If it is weak, return a weakness (Weak/Missing). If it is adequate but improvable, return average (Adequate/Room to improve).

${formatFixedLanguagePointsForPrompt()}

Each annotation MUST include language_point_id set to the matching id above.
Each annotation's function and level MUST match the required values for that language point.
issue_type MUST start with Strong/Good, Weak/Missing, or Adequate/Room to improve, then the required issue_type label.

STUDENT-FACING LANGUAGE (MANDATORY):
- Write exclusively in English. Do NOT use Chinese or any other language.
- Use LLED 200 course terms when they fit (Theme/New, nominalization, general-to-specific, topic sentence, cohesion, etc.).
- Follow the term + plain English explanation pattern: name the concept, then explain it in this specific quote.
- feedback is 1-2 short sentences; for strengths use revision_guidance exactly: Keep this pattern in your revision.
- Use "you/your". Do not stack multiple terms in one sentence. Do not use terms without an English gloss.
- citations MUST be an empty array []. Course materials are attached server-side.

ANNOTATION ANCHORING (MANDATORY):
- evidence.quote MUST be copied verbatim from the paragraph text (exact substring).
- char_start and char_end MUST match that exact quote in the paragraph (0-based, end exclusive).
- Do NOT guess offsets; locate the quote first, then set char_start/char_end to its position.
`;

const fixedPointAnnotationJsonSchema = {
  ...annotationJsonSchema,
  required: [...annotationJsonSchema.required, "language_point_id"],
  properties: {
    ...annotationJsonSchema.properties,
    language_point_id: { enum: [...FIXED_LANGUAGE_POINT_IDS] },
  },
} as const;

const fixedLanguagePointsFeedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["annotations", "overall_feedback"],
  properties: {
    annotations: {
      type: "array",
      items: fixedPointAnnotationJsonSchema,
    },
    overall_feedback: {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "priority_issues",
        "next_steps",
        "reflection_questions",
      ],
      properties: {
        summary: { type: "string" },
        priority_issues: { type: "array", items: { type: "string" } },
        next_steps: { type: "array", items: { type: "string" } },
        reflection_questions: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

const citationSchema = z.object({
  type: z.enum(["rubric", "course_material"]),
  label: z.string(),
  url: z.string().nullable(),
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
  evidence: z.object({
    quote: z.string(),
    reason: z.string(),
  }),
  feedback: z.string(),
  revision_guidance: z.string(),
  citations: z.array(citationSchema),
  language_point_id: z.enum(FIXED_LANGUAGE_POINT_IDS).optional(),
});

const fixedLanguagePointsFeedbackSchema = z.object({
  annotations: z.array(annotationSchema),
  overall_feedback: z.object({
    summary: z.string(),
    priority_issues: z.array(z.string()),
    next_steps: z.array(z.string()),
    reflection_questions: z.array(z.string()),
  }),
});

type FixedLanguagePointsFeedback = z.infer<
  typeof fixedLanguagePointsFeedbackSchema
>;

const FeedbackGraphState = GraphAnnotation.Root({
  essayText: GraphAnnotation<string>(),
  paragraphs: GraphAnnotation<Paragraph[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  messages: GraphAnnotation<PromptMessage[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  feedback: GraphAnnotation<FeedbackResponse | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  validationError: GraphAnnotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  repairAttempts: GraphAnnotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
});

type FeedbackGraphStateType = typeof FeedbackGraphState.State;
type FeedbackGraphUpdate = typeof FeedbackGraphState.Update;

async function prepareDescriptiveReportContext(
  state: FeedbackGraphStateType,
): Promise<FeedbackGraphUpdate> {
  const paragraphs = parseEssay(state.essayText);
  const messages = await buildPromptMessages(paragraphs);
  return { paragraphs, messages };
}

function buildFixedLanguagePointsMessages(
  baseMessages: PromptMessage[],
): PromptMessage[] {
  const [systemMessage, userMessage] = baseMessages;
  if (!systemMessage || !userMessage) {
    throw new Error("Feedback graph was invoked without prepared prompt messages.");
  }

  return [
    {
      role: "system",
      content: `${systemMessage.content}

LANGGRAPH FIXED LANGUAGE POINTS OVERRIDE:
${FIXED_POINTS_PROMPT_BLOCK}

Return ONLY this object:
- annotations: exactly ${FIXED_LANGUAGE_POINT_COUNT} items, one per fixed language point
- overall_feedback: summary, priority_issues, next_steps, reflection_questions

overall_feedback.summary should briefly note strengths and priorities across the fixed language points.
Do NOT return submission_id, created_at, or essay in this node.`,
    },
    {
      role: "user",
      content: userMessage.content,
    },
  ];
}

function resolveLanguagePointId(
  item: z.infer<typeof annotationSchema>,
): FixedLanguagePointId | null {
  if (item.language_point_id) {
    return item.language_point_id;
  }
  const fromIssueType = matchFixedLanguagePointId(item.issue_type);
  if (fromIssueType) return fromIssueType;
  return matchFixedLanguagePointId(
    `${item.feedback} ${item.evidence.reason} ${item.revision_guidance}`,
  );
}

function normalizeFixedPointAnnotation(
  item: z.infer<typeof annotationSchema>,
  pointId: FixedLanguagePointId,
  id: number,
): Annotation {
  const point = getFixedLanguagePoint(pointId);
  const qualityPrefixMatch = item.issue_type.match(
    /^(Strong|Good|Effective|Clear|Weak|Missing|Poor|Broken|Unclear|Insufficient|Adequate|Average|Room to improve|Mixed|Moderate)\b/i,
  );
  const qualityPrefix = qualityPrefixMatch?.[0] ?? "Adequate";
  const issueType = `${qualityPrefix} ${point.issueTypeLabel}`;

  return {
    id,
    paragraph_id: item.paragraph_id,
    char_start: item.char_start,
    char_end: item.char_end,
    function: point.function,
    level: point.level,
    issue_type: issueType,
    severity: item.severity,
    evidence: item.evidence,
    feedback: item.feedback,
    revision_guidance: item.revision_guidance,
    citations: [],
  };
}

function selectFixedLanguagePointAnnotations(
  candidates: Array<z.infer<typeof annotationSchema>>,
): Annotation[] {
  const byPoint = new Map<FixedLanguagePointId, z.infer<typeof annotationSchema>>();

  for (const item of candidates) {
    const pointId = resolveLanguagePointId(item);
    if (!pointId || byPoint.has(pointId)) continue;
    byPoint.set(pointId, item);
  }

  // Fallback: assign remaining candidates to any still-missing fixed points.
  const used = new Set(byPoint.values());
  const unused = candidates.filter((item) => !used.has(item));

  for (const point of FIXED_LANGUAGE_POINTS) {
    if (byPoint.has(point.id)) continue;
    const fallback = unused.shift();
    if (fallback) {
      byPoint.set(point.id, fallback);
    }
  }

  return FIXED_LANGUAGE_POINTS.flatMap((point, index) => {
    const item = byPoint.get(point.id);
    if (!item) return [];
    return [normalizeFixedPointAnnotation(item, point.id, index + 1)];
  });
}

function takeNonEmpty(items: string[], limit: number): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

async function generateFixedLanguagePointsFeedback(
  state: FeedbackGraphStateType,
): Promise<FeedbackGraphUpdate> {
  const raw = await callOpenAiForJson(
    buildFixedLanguagePointsMessages(state.messages),
    "fixed_language_points_feedback",
    fixedLanguagePointsFeedbackJsonSchema,
  );
  const parsed = fixedLanguagePointsFeedbackSchema.parse(raw);
  const annotations = selectFixedLanguagePointAnnotations(parsed.annotations);

  if (annotations.length < FIXED_LANGUAGE_POINT_COUNT) {
    throw new Error(
      `Fixed language-point coverage incomplete: expected ${FIXED_LANGUAGE_POINT_COUNT}, got ${annotations.length}.`,
    );
  }

  const feedback: FeedbackResponse = {
    submission_id: null,
    created_at: null,
    essay: { paragraphs: state.paragraphs },
    annotations,
    overall_feedback: {
      summary: parsed.overall_feedback.summary,
      priority_issues: takeNonEmpty(parsed.overall_feedback.priority_issues, 4),
      next_steps: takeNonEmpty(parsed.overall_feedback.next_steps, 4),
      reflection_questions: takeNonEmpty(
        parsed.overall_feedback.reflection_questions,
        4,
      ),
    },
  };

  return { feedback };
}

function validateMergedFeedback(state: FeedbackGraphStateType): FeedbackGraphUpdate {
  if (!state.feedback) {
    throw new Error("No merged feedback available for validation.");
  }

  try {
    return {
      feedback: validateFeedbackResponse(state.feedback, state.paragraphs),
      validationError: null,
    };
  } catch (error) {
    if (state.repairAttempts > 0) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Feedback validation failed.";
    return { validationError: message };
  }
}

function routeAfterValidation(state: FeedbackGraphStateType): string {
  return state.validationError ? "repair_feedback" : "evaluate_seriousness";
}

function evaluateSeriousness(state: FeedbackGraphStateType): FeedbackGraphUpdate {
  if (!state.feedback) {
    throw new Error("No validated feedback available for seriousness evaluation.");
  }

  const evaluated = sortAnnotationsBySeriousness(
    evaluateFeedbackSeriousness(state.feedback.annotations, state.essayText),
  ).map((item, index) => ({ ...item, id: index + 1 }));

  return {
    feedback: {
      ...state.feedback,
      annotations: evaluated,
    },
  };
}

async function repairFeedbackOnce(
  state: FeedbackGraphStateType,
): Promise<FeedbackGraphUpdate> {
  if (!state.feedback || !state.validationError) {
    return { validationError: null };
  }

  const raw = await callOpenAiForFeedback([
    {
      role: "system",
      content:
        "You repair invalid LLED 200 feedback JSON. Return only valid JSON matching the required schema. Do not add markdown or explanations. Keep exactly one annotation for each fixed language point: General-to-specific organization, Topic sentences, Theme–new information order, Nominalization, and Sentence connection and conjunction use.",
    },
    {
      role: "user",
      content: `Validation error:
${state.validationError}

Paragraphs:
${formatParagraphsForPrompt(state.paragraphs)}

Invalid feedback JSON:
${JSON.stringify(state.feedback)}`,
    },
  ]);

  const repaired = raw as FeedbackResponse;
  const annotations = selectFixedLanguagePointAnnotations(
    repaired.annotations.map((item) => ({
      ...item,
      language_point_id: matchFixedLanguagePointId(item.issue_type) ?? undefined,
    })),
  );

  return {
    feedback: {
      ...repaired,
      annotations:
        annotations.length === FIXED_LANGUAGE_POINT_COUNT
          ? annotations
          : repaired.annotations.slice(0, FIXED_LANGUAGE_POINT_COUNT),
      essay: { paragraphs: state.paragraphs },
      submission_id: null,
      created_at: null,
    },
    validationError: null,
    repairAttempts: state.repairAttempts + 1,
  };
}

function attachCourseMaterials(state: FeedbackGraphStateType): FeedbackGraphUpdate {
  if (!state.feedback) {
    throw new Error("No validated feedback available for course materials.");
  }

  const feedback: FeedbackResponse = {
    ...state.feedback,
    annotations: state.feedback.annotations.map((item) => ({
      ...item,
      citations: [
        {
          type: "course_material" as const,
          label: getCourseMaterialLabel(item.function, item.level),
          url: null,
        },
      ],
    })),
  };

  return { feedback };
}

function returnFeedback(state: FeedbackGraphStateType): FeedbackGraphUpdate {
  if (!state.feedback) {
    throw new Error("Feedback graph completed without a feedback response.");
  }
  return { feedback: state.feedback };
}

const feedbackGraph = new StateGraph(FeedbackGraphState)
  .addNode("prepare_context", prepareDescriptiveReportContext)
  .addNode("fixed_language_points_feedback", generateFixedLanguagePointsFeedback)
  .addNode("validate_feedback", validateMergedFeedback)
  .addNode("repair_feedback", repairFeedbackOnce)
  .addNode("evaluate_seriousness", evaluateSeriousness)
  .addNode("attach_course_materials", attachCourseMaterials)
  .addNode("return_feedback", returnFeedback)
  .addEdge(START, "prepare_context")
  .addEdge("prepare_context", "fixed_language_points_feedback")
  .addEdge("fixed_language_points_feedback", "validate_feedback")
  .addConditionalEdges("validate_feedback", routeAfterValidation, [
    "repair_feedback",
    "evaluate_seriousness",
  ])
  .addEdge("repair_feedback", "validate_feedback")
  .addEdge("evaluate_seriousness", "attach_course_materials")
  .addEdge("attach_course_materials", "return_feedback")
  .addEdge("return_feedback", END)
  .compile();

export async function runFeedbackGraph(essayText: string): Promise<FeedbackResponse> {
  const result = await feedbackGraph.invoke({ essayText });
  if (!result.feedback) {
    throw new Error("Feedback graph did not return feedback.");
  }
  return result.feedback;
}
