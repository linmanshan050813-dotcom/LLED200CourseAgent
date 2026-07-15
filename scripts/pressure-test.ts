import dotenv from "dotenv";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PRESSURE_TEST_DEFAULT_CONCURRENCY,
  PRESSURE_TEST_DEFAULT_COUNT,
  PRESSURE_TEST_SAMPLE_ESSAY,
  runPressureTest,
} from "../src/backend/lib/pressureTest.js";

dotenv.config();

const lockPath = resolve(process.cwd(), ".pressure-test.lock");

function acquireLock(): void {
  if (existsSync(lockPath)) {
    throw new Error("pressure test already running (.pressure-test.lock exists).");
  }
  writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, "utf8");
}

function releaseLock(): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

function printUsage(): void {
  console.log(`pressure test — classroom load simulation

Usage:
  npm run pressure-test -- [options]

Options:
  --count <n>         Number of LLM feedback runs (default: ${PRESSURE_TEST_DEFAULT_COUNT})
  --concurrency <n>   Parallel runs (default: ${PRESSURE_TEST_DEFAULT_CONCURRENCY})
  --file <path>       Essay text file (default: built-in sample essay)
  --essay <text>      Inline essay text
  -h, --help          Show help
`);
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

async function resolveEssayText(args: string[]): Promise<string> {
  const inline = readArg(args, "--essay");
  if (inline) {
    return inline;
  }

  const filePath = readArg(args, "--file");
  if (filePath) {
    return readFile(resolve(process.cwd(), filePath), "utf-8");
  }

  return PRESSURE_TEST_SAMPLE_ESSAY;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    printUsage();
    return;
  }

  acquireLock();

  try {
    const countRaw = readArg(args, "--count");
    const concurrencyRaw = readArg(args, "--concurrency");
    const count = countRaw ? Number(countRaw) : undefined;
    const concurrency = concurrencyRaw ? Number(concurrencyRaw) : undefined;
    const essayText = await resolveEssayText(args);

    console.log(
      `[pressure test] starting count=${count ?? PRESSURE_TEST_DEFAULT_COUNT} concurrency=${concurrency ?? PRESSURE_TEST_DEFAULT_CONCURRENCY}`,
    );

    const result = await runPressureTest(essayText, {
      count,
      concurrency,
      onProgress: (completed, total, ok) => {
        const status = ok ? "ok" : "fail";
        if (completed === total || completed % 10 === 0 || !ok) {
          console.log(`[pressure test] ${completed}/${total} (${status})`);
        }
      },
    });

    console.log(
      `[pressure test] done succeeded=${result.succeeded} failed=${result.failed} durationMs=${result.durationMs}`,
    );

    if (result.errors.length > 0) {
      console.log("[pressure test] sample errors:");
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }

    if (!result.lastFeedback) {
      throw new Error("pressure test finished with no successful feedback response.");
    }

    console.log("[pressure test] last feedback result:");
    console.log(JSON.stringify(result.lastFeedback, null, 2));
  } finally {
    releaseLock();
  }
}

main().catch((error) => {
  releaseLock();
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pressure test] failed: ${message}`);
  process.exitCode = 1;
});
