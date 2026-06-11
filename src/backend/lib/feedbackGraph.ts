import { Annotation as GraphAnnotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { getCourseMaterialLabel } from "../../shared/courseMaterials.js";
import type {
  Annotation,
  FeedbackResponse,
  FunctionDimension,
  Paragraph,
  Severity,
} from "../../shared/schema.js";
import { formatParagraphsForPrompt, parseEssay } from "./essayParser.js";
import { callOpenAiForFeedback, callOpenAiForJson, annotationJsonSchema } from "./openaiClient.js";
import { buildPromptMessages, type PromptMessage } from "./promptBuilder.js";
import { validateFeedbackResponse } from "./schemaValidator.js";
import {
  evaluateFeedbackSeriousness,
  sortAnnotationsBySeriousness,
} from "./seriousnessEvaluator.js";

const FUNCTION_PROMPTS: Record<FunctionDimension, string> = {
  content:
    "Focus only on the Content Function. Evaluate knowledge building, definitions, concepts, process types, nominalization, and logical content development. Every annotation you return MUST have function set to content.",
  interpersonal:
    "Focus only on the Interpersonal Function. Evaluate academic stance, reliability of claims, source use, hedging/boosting, reporting verbs, tone, citation conventions, and formal academic vocabulary. Every annotation you return MUST have function set to interpersonal.",
  organization:
    "Focus only on the Organizational Function. Evaluate text structure, paragraph flow, transitions, cohesion, Theme/New ordering, clause structure, and punctuation for readability. Every annotation you return MUST have function set to organization.",
};

const ACCESSIBLE_COURSE_LANGUAGE_OVERRIDE = `
STUDENT-FACING LANGUAGE (MANDATORY):
- Write exclusively in English. Do NOT use Chinese or any other language.
- Use LLED 200 course terms when they fit (Theme/New, nominalization, relational/material process, hedging, boosting, definition pattern, cohesion, interpersonal positioning, etc.).
- Follow the term + plain English explanation pattern: name the concept, then explain it in this specific quote.
- issue_type may use a course label; feedback is 1-2 short sentences; revision_guidance is 1 short sentence.
- Use "you/your". Do not stack multiple terms in one sentence. Do not use terms without an English gloss.
- citations MUST be an empty array []. Course materials are attached server-side.

ANNOTATION ANCHORING (MANDATORY):
- evidence.quote MUST be copied verbatim from the paragraph text (exact substring).
- char_start and char_end MUST match that exact quote in the paragraph (0-based, end exclusive).
- Do NOT guess offsets; locate the quote first, then set char_start/char_end to its position.
`;

const SEVERITY_RANK: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const dimensionFeedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "annotations",
    "summary",
    "priority_issues",
    "next_steps",
    "reflection_questions",
  ],
  properties: {
    annotations: { type: "array", items: annotationJsonSchema },
    summary: { type: "string" },
    priority_issues: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    reflection_questions: { type: "array", items: { type: "string" } },
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
});

const dimensionFeedbackSchema = z.object({
  annotations: z.array(annotationSchema),
  summary: z.string(),
  priority_issues: z.array(z.string()),
  next_steps: z.array(z.string()),
  reflection_questions: z.array(z.string()),
});

type DimensionFeedback = z.infer<typeof dimensionFeedbackSchema>;

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
  contentFeedback: GraphAnnotation<DimensionFeedback | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  interpersonalFeedback: GraphAnnotation<DimensionFeedback | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  organizationFeedback: GraphAnnotation<DimensionFeedback | null>({
    reducer: (_left, right) => right,
    default: () => null,
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

function buildDimensionMessages(
  baseMessages: PromptMessage[],
  dimension: FunctionDimension,
): PromptMessage[] {
  const [systemMessage, userMessage] = baseMessages;
  if (!systemMessage || !userMessage) {
    throw new Error("Feedback graph was invoked without prepared prompt messages.");
  }

  return [
    {
      role: "system",
      content: `${systemMessage.content}

LANGGRAPH DIMENSION NODE OVERRIDE:
${FUNCTION_PROMPTS[dimension]}
${ACCESSIBLE_COURSE_LANGUAGE_OVERRIDE}
Return ONLY the dimension feedback object required by the active JSON schema:
- annotations
- summary
- priority_issues
- next_steps
- reflection_questions

Do NOT return the full top-level FeedbackResponse in this node.
Return at most 4 annotations for this function.`,
    },
    {
      role: "user",
      content: userMessage.content,
    },
  ];
}

async function generateDimensionFeedback(
  state: FeedbackGraphStateType,
  dimension: FunctionDimension,
): Promise<DimensionFeedback> {
  const raw = await callOpenAiForJson(
    buildDimensionMessages(state.messages, dimension),
    `${dimension}_feedback`,
    dimensionFeedbackJsonSchema,
  );
  const parsed = dimensionFeedbackSchema.parse(raw);

  return {
    ...parsed,
    annotations: parsed.annotations
      .filter((item) => item.function === dimension)
      .slice(0, 4) as Annotation[],
  };
}

async function generateContentFeedback(
  state: FeedbackGraphStateType,
): Promise<FeedbackGraphUpdate> {
  return { contentFeedback: await generateDimensionFeedback(state, "content") };
}

async function generateInterpersonalFeedback(
  state: FeedbackGraphStateType,
): Promise<FeedbackGraphUpdate> {
  return {
    interpersonalFeedback: await generateDimensionFeedback(state, "interpersonal"),
  };
}

async function generateOrganizationFeedback(
  state: FeedbackGraphStateType,
): Promise<FeedbackGraphUpdate> {
  return {
    organizationFeedback: await generateDimensionFeedback(state, "organization"),
  };
}

function requireDimensionFeedback(
  value: DimensionFeedback | null,
  label: FunctionDimension,
): DimensionFeedback {
  if (!value) {
    throw new Error(`Missing ${label} feedback from LangGraph branch.`);
  }
  return value;
}

function takeNonEmpty(items: string[], limit: number): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

function mergeFeedbackAnnotations(state: FeedbackGraphStateType): FeedbackGraphUpdate {
  const content = requireDimensionFeedback(state.contentFeedback, "content");
  const interpersonal = requireDimensionFeedback(
    state.interpersonalFeedback,
    "interpersonal",
  );
  const organization = requireDimensionFeedback(
    state.organizationFeedback,
    "organization",
  );
  const dimensionFeedback = [content, interpersonal, organization];
  const annotations = dimensionFeedback
    .flatMap((item) => item.annotations)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 12)
    .map((item, index) => ({ ...item, id: index + 1 }));

  const feedback: FeedbackResponse = {
    submission_id: null,
    created_at: null,
    essay: { paragraphs: state.paragraphs },
    annotations,
    overall_feedback: {
      summary: dimensionFeedback.map((item) => item.summary).join(" "),
      priority_issues: takeNonEmpty(
        dimensionFeedback.flatMap((item) => item.priority_issues),
        4,
      ),
      next_steps: takeNonEmpty(
        dimensionFeedback.flatMap((item) => item.next_steps),
        4,
      ),
      reflection_questions: takeNonEmpty(
        dimensionFeedback.flatMap((item) => item.reflection_questions),
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
        "You repair invalid LLED 200 feedback JSON. Return only valid JSON matching the required schema. Do not add markdown or explanations.",
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

  return {
    feedback: raw as FeedbackResponse,
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
  .addNode("content_feedback", generateContentFeedback)
  .addNode("interpersonal_feedback", generateInterpersonalFeedback)
  .addNode("organization_feedback", generateOrganizationFeedback)
  .addNode("merge_feedback", mergeFeedbackAnnotations)
  .addNode("validate_feedback", validateMergedFeedback)
  .addNode("repair_feedback", repairFeedbackOnce)
  .addNode("evaluate_seriousness", evaluateSeriousness)
  .addNode("attach_course_materials", attachCourseMaterials)
  .addNode("return_feedback", returnFeedback)
  .addEdge(START, "prepare_context")
  .addEdge("prepare_context", "content_feedback")
  .addEdge("prepare_context", "interpersonal_feedback")
  .addEdge("prepare_context", "organization_feedback")
  .addEdge(
    ["content_feedback", "interpersonal_feedback", "organization_feedback"],
    "merge_feedback",
  )
  .addEdge("merge_feedback", "validate_feedback")
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
