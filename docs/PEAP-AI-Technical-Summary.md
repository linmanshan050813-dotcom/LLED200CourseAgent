# PEAP-AI Technical Summary

> **Note:** The canonical Word deliverable is **`PEAP-AI-Technical-Summary.doc`** (also available as `.docx`). Regenerate with `python scripts/build-peap-ai-doc.py` after updating this file or the Mermaid source.

This repository (`LLED_bot_MVP` / LLED 200 Essay Feedback MVP) implements PEAP-AI: formative AI feedback for UBC LLED 200 Descriptive Report drafts.

## 1. Workflow and Architecture

### 1.1 System Overview

PEAP-AI is a locally hosted web MVP. Students submit drafts; the backend runs a LangGraph `StateGraph`; structured JSON is validated and returned; the browser renders a two-column annotation view.

Out of scope for the MVP: authentication, persistence, RAG retrieval. Course materials are rule-mapped, not retrieved.

### 1.2 LangGraph Workflow (Implemented)

See **`peap-ai-feedback-graph.png`** (source: `peap-ai-feedback-graph.mmd`), matching `src/backend/lib/feedbackGraph.ts`.

| Node | Role |
|------|------|
| `prepare_context` | Parse essay, build prompts from `prompt.md` |
| `fixed_language_points_feedback` | LLM — exactly one annotation per fixed language point |
| `validate_feedback` | Zod schema validation |
| `repair_feedback` | One-shot JSON repair if validation fails |
| `evaluate_seriousness` | Rubric-aligned seriousness ranking |
| `attach_course_materials` | Attach mapped course material labels |
| `return_feedback` | Return `FeedbackResponse` |

Fixed language points (always covered): General-to-specific organization, Topic sentences, Theme–new information order, Nominalization, Sentence connection and conjunction use.

Typical LLM calls: **1** fixed-language-points node; **+1** if repair runs.

### 1.3 Evaluation Framework

Aligned with the **Academic Writing Matrix**: Content / Interpersonal / Organization × text / section / clause_word. No scoring; no sentence rewriting.

## 2. Programming Languages and Stack

| Category | Choice |
|----------|--------|
| Primary language | **TypeScript** (`strict: true`) |
| UI | HTML5, CSS |
| Runtime | Node.js ≥ 20 |
| Backend | Express 5 |
| Orchestration | LangGraph |
| Validation | Zod 4 |

## 3. LLM Models

PEAP-AI **primarily uses OpenAI models** today (`openaiClient.ts`, structured JSON schema output). The default model is **`gpt-5.4-mini`** (override with `OPENAI_MODEL`).

The design supports **other large language models** (Anthropic, Google, Azure OpenAI, OpenAI-compatible endpoints, etc.) by swapping or extending the LLM adapter behind the same LangGraph nodes and `FeedbackResponse` schema.

## Document Info

| Field | Value |
|-------|-------|
| Version | MVP (essay-feedback-mvp v0.1.0) |

**Prepared by:** Lin Manshan (林满山) — lin.manshan050813@gmail.com
