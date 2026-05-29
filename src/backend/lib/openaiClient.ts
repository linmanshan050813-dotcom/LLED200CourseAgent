import OpenAI from "openai";
import type { PromptMessage } from "./promptBuilder.js";

type JsonSchema = Record<string, unknown>;

export const citationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "label", "url"],
  properties: {
    type: { enum: ["rubric", "course_material"] },
    label: { type: "string" },
    url: { type: ["string", "null"] },
  },
} as const;

export const evidenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["quote", "reason"],
  properties: {
    quote: { type: "string" },
    reason: { type: "string" },
  },
} as const;

export const annotationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "paragraph_id",
    "char_start",
    "char_end",
    "function",
    "level",
    "issue_type",
    "severity",
    "evidence",
    "feedback",
    "revision_guidance",
    "citations",
  ],
  properties: {
    id: { type: "integer" },
    paragraph_id: { type: "string" },
    char_start: { type: "integer", minimum: 0 },
    char_end: { type: "integer", minimum: 0 },
    function: { enum: ["content", "interpersonal", "organization"] },
    level: { enum: ["text", "section", "clause_word"] },
    issue_type: { type: "string" },
    severity: { enum: ["low", "medium", "high"] },
    evidence: evidenceJsonSchema,
    feedback: { type: "string" },
    revision_guidance: { type: "string" },
    citations: { type: "array", items: citationJsonSchema },
  },
} as const;

export const overallFeedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "priority_issues", "next_steps", "reflection_questions"],
  properties: {
    summary: { type: "string" },
    priority_issues: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    reflection_questions: { type: "array", items: { type: "string" } },
  },
} as const;

export const paragraphJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
  },
} as const;

export const feedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "submission_id",
    "created_at",
    "essay",
    "annotations",
    "overall_feedback",
  ],
  properties: {
    submission_id: { type: ["string", "null"] },
    created_at: { type: ["string", "null"] },
    essay: {
      type: "object",
      additionalProperties: false,
      required: ["paragraphs"],
      properties: {
        paragraphs: { type: "array", items: paragraphJsonSchema },
      },
    },
    annotations: { type: "array", items: annotationJsonSchema },
    overall_feedback: overallFeedbackJsonSchema,
  },
} as const;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function callOpenAiForJson(
  messages: PromptMessage[],
  schemaName: string,
  schema: JsonSchema,
): Promise<unknown> {
  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  return JSON.parse(raw) as unknown;
}

export async function callOpenAiForFeedback(messages: PromptMessage[]): Promise<unknown> {
  return callOpenAiForJson(messages, "feedback", feedbackJsonSchema);
}
