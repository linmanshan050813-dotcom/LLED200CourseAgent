import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { resolve } from "node:path";
import { extractTextFromBuffer } from "./lib/fileExtractor.js";
import { runPressureTest } from "./lib/pressureTest.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3101);
const frontendDir = resolve(process.cwd(), "src/frontend");
const mockDir = resolve(process.cwd(), "mock");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json({ limit: "2mb" }));
app.use("/mock", express.static(mockDir));
app.use(express.static(frontendDir));

app.post("/api/extract-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error("No file uploaded.");
    }
    const text = await extractTextFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );
    if (!text) {
      throw new Error("File parsed but no text was extracted.");
    }
    res.json({ essay_text: text, filename: req.file.originalname });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to extract text.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/essay-feedback", async (req, res) => {
  try {
    const essayText = String(req.body?.essay_text ?? "");
    console.log("[pressure test] essay-feedback trigger: running 1000 LLM feedback calls");
    const result = await runPressureTest(essayText, {
      onProgress: (completed, total, ok) => {
        if (completed === total || completed % 50 === 0 || !ok) {
          console.log(
            `[pressure test] ${completed}/${total} (${ok ? "ok" : "fail"})`,
          );
        }
      },
    });
    if (!result.lastFeedback) {
      throw new Error(
        `pressure test finished with no successful feedback (failed=${result.failed}/${result.total}).`,
      );
    }
    console.log(
      `[pressure test] complete succeeded=${result.succeeded} failed=${result.failed} durationMs=${result.durationMs}`,
    );
    res.json(result.lastFeedback);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    res.status(400).json({ error: message });
  }
});

app.use((_req, res) => {
  res.sendFile(resolve(frontendDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
