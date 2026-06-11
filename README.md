# LLED200CourseAgent

An MVP web app for generating structured formative feedback on LLED 200 Descriptive Report drafts.

The app accepts pasted text or uploaded files, sends the essay to an OpenAI-backed feedback pipeline, validates the structured response, and renders paragraph-level annotations with suggested course materials.

## Features

- Paste or upload essay drafts (`.txt`, `.md`, `.doc`, `.docx`, `.pdf`)
- Extract text from uploaded documents
- Generate structured feedback aligned with the Academic Writing Matrix
- Categorize annotations by function and level:
  - Content
  - Interpersonal
  - Organization
  - Text / Section / Clause & Word
- Validate feedback against a strict JSON schema
- Attach suggested course material references
- Render highlights, sidebar cards, filters, summary, and learning-resource prompts in the browser

## Requirements

- Node.js 20 or newer
- npm
- An OpenAI API key

## Local Setup

Clone the repository and install dependencies:

```powershell
git clone https://github.com/linmanshan050813-dotcom/LLED200CourseAgent.git
cd LLED200CourseAgent
npm install
```

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set your real API key:

```env
OPENAI_API_KEY=sk-your-real-key
OPENAI_MODEL=gpt-5.4-mini
PORT=3101
```

Do not commit `.env`. It is intentionally ignored by git.

## Run Locally

Start the development server:

```powershell
npm run dev
```

Open the app in a browser:

```text
http://localhost:3101
```

If port `3101` is already in use, change `PORT` in `.env` and restart `npm run dev`.

## Development Commands

Run TypeScript checks:

```powershell
npm run typecheck
```

Compile the frontend bundle manually:

```powershell
npx tsc -p tsconfig.frontend.json
```

The `npm run dev` command already runs the frontend TypeScript watcher and the backend server watcher together.

## Environment Variables

| Variable | Required | Description |
|---|---:|---|
| `OPENAI_API_KEY` | Yes | API key used by the backend to call OpenAI |
| `OPENAI_MODEL` | No | Model name. Defaults to the value in the code if omitted |
| `PORT` | No | Local server port. Defaults to `3101` |

## Project Structure

```text
src/backend/
  server.ts                 Express server and API routes
  lib/feedbackGraph.ts      LangGraph feedback workflow
  lib/seriousnessEvaluator.ts  Rubric-aligned feedback seriousness evaluator
  lib/prompts/prompt.md     Main Descriptive Report feedback prompt

src/frontend/
  index.html                Browser entry page
  app.ts                    Frontend app logic
  lib/                      Rendering and interaction helpers

src/shared/
  schema.ts                 Shared feedback response types
  courseMaterials.ts        Course material mapping

docs/
  functional-test-guide.md
  rubric-course-material-mapping-draft.md
  assignment-feedback-graph-rag.md
  assignment-feedback-graph-langgraph-generated.md
```

## Cursor Skill

This repository includes a project skill at:

```text
.cursor/skills/run-lled-mvp/SKILL.md
```

In Cursor, ask the agent to use the `run-lled-mvp` skill when you want it to install dependencies, verify `.env`, start the local server, or troubleshoot the local run.

Example request:

```text
Use the run-lled-mvp skill to start this project locally.
```

## Notes

- `.env` is ignored so real keys are not committed.
- `.cursor/rules/` is ignored so local Cursor rules are not committed.
- `.cursor/skills/` is intentionally kept shareable so other Cursor users can run the project with the provided skill.
- Feedback generation currently uses a LangGraph workflow with focused feedback branches and schema validation. This can call the model multiple times per submission.
