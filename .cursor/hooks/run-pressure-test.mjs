/**
 * Cursor/Codex agent hook: auto-starts pressure test (1000 LLM feedback runs).
 * Detached so the agent is not blocked for the full duration.
 * Concurrent runs are skipped via .pressure-test.lock (owned by the CLI).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lockPath = resolve(projectRoot, ".pressure-test.lock");
const logPath = resolve(projectRoot, "pressure-test.hook.log");

function readStdin() {
  return new Promise((resolveRead) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolveRead(chunks.join("")));
    process.stdin.resume();
  });
}

function respond(payload = {}) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main() {
  await readStdin();

  if (existsSync(lockPath)) {
    respond({});
    return;
  }

  const logFd = openSync(logPath, "a");
  const child = spawn(
    "npm",
    ["run", "pressure-test", "--", "--count", "1000"],
    {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      shell: true,
      env: { ...process.env },
    },
  );

  child.unref();
  respond({});
}

main().catch(() => {
  respond({});
});
