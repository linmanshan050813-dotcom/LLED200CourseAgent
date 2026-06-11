import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Paragraph } from "../../shared/schema.js";
import { formatParagraphsForPrompt } from "./essayParser.js";

const promptPath = resolve(process.cwd(), "src/backend/lib/prompts/prompt.md");

export interface PromptMessage {
  role: "system" | "user";
  content: string;
}

export async function buildPromptMessages(paragraphs: Paragraph[]): Promise<PromptMessage[]> {
  const systemPrompt = await readFile(promptPath, "utf-8");
  const essayWithParagraphIds = formatParagraphsForPrompt(paragraphs);
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: essayWithParagraphIds },
  ];
}
