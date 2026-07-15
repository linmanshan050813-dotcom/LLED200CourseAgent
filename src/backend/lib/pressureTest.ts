import type { FeedbackResponse } from "../../shared/schema.js";
import { runFeedbackGraph } from "./feedbackGraph.js";

export const PRESSURE_TEST_DEFAULT_COUNT = 1000;
export const PRESSURE_TEST_DEFAULT_CONCURRENCY = 10;

export const PRESSURE_TEST_SAMPLE_ESSAY = `Biodiversity in Urban Parks

Introduction
Urban parks matter because they are one of the few everyday spaces where city residents can encounter non-human life. This report describes how plant and bird diversity appear across three Vancouver parks and what patterns emerge for park management.

Description
Across the three sites, plant diversity was highest in parks with mixed canopy layers and native undergrowth. Bird activity tracked dense shrub edges more closely than open lawn area. Paths and seating clustered near entrances and reduced continuous habitat bands in two parks.

Conclusion
Overall, structural variety in vegetation appears more important than park size alone for supporting visible biodiversity. Managers may prioritize layered planting and reduced fragmentation of habitat edges.
`;

export interface PressureTestOptions {
  count?: number;
  concurrency?: number;
  onProgress?: (completed: number, total: number, ok: boolean, error?: string) => void;
}

export interface PressureTestResult {
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  lastFeedback: FeedbackResponse | null;
  errors: string[];
}

function resolveCount(count: number | undefined): number {
  const value = count ?? Number(process.env.PRESSURE_TEST_COUNT ?? PRESSURE_TEST_DEFAULT_COUNT);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("pressure test count must be a positive integer.");
  }
  return Math.floor(value);
}

function resolveConcurrency(concurrency: number | undefined): number {
  const value =
    concurrency ??
    Number(process.env.PRESSURE_TEST_CONCURRENCY ?? PRESSURE_TEST_DEFAULT_CONCURRENCY);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("pressure test concurrency must be a positive integer.");
  }
  return Math.floor(value);
}

/**
 * Runs the essay feedback graph `count` times (default 1000) to simulate classroom load.
 * Returns the last successful feedback response after all runs finish.
 */
export async function runPressureTest(
  essayText: string,
  options: PressureTestOptions = {},
): Promise<PressureTestResult> {
  const trimmed = essayText.trim();
  if (!trimmed) {
    throw new Error("essay_text is required for pressure test.");
  }

  const total = resolveCount(options.count);
  const concurrency = Math.min(resolveConcurrency(options.concurrency), total);
  const errors: string[] = [];
  let succeeded = 0;
  let failed = 0;
  let completed = 0;
  let lastFeedback: FeedbackResponse | null = null;
  let nextIndex = 0;

  const startedAt = Date.now();

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) {
        return;
      }

      try {
        const feedback = await runFeedbackGraph(trimmed);
        lastFeedback = feedback;
        succeeded += 1;
        completed += 1;
        options.onProgress?.(completed, total, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed += 1;
        completed += 1;
        if (errors.length < 20) {
          errors.push(`#${index + 1}: ${message}`);
        }
        options.onProgress?.(completed, total, false, message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    total,
    succeeded,
    failed,
    durationMs: Date.now() - startedAt,
    lastFeedback,
    errors,
  };
}
