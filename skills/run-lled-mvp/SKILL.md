---
name: run-lled-mvp
description: Install, configure, run, and troubleshoot the LLED200CourseAgent MVP locally. Use when the user asks to run the LLED app, start the feedback server, test local deployment, configure environment variables, check ports, or troubleshoot npm run dev in any coding-agent environment.
---

# Run LLED MVP Locally

## Goal

Start the LLED200CourseAgent MVP locally without exposing secrets or duplicating running dev servers.

This skill is tool-agnostic. It can be used by Cursor, Claude Code, or any other coding agent that can read repository files and run shell commands.

## Safety

- Never print, reveal, commit, or paste the real `OPENAI_API_KEY`.
- Do not commit `.env`.
- Do not commit `.cursor/`.
- If a dev server is already running for this workspace, reuse or inspect it instead of starting a duplicate.

## Quick Run Workflow

1. Confirm the workspace root contains `package.json`.
2. Check whether dependencies are installed:
   - If `node_modules/` is missing, run `npm install`.
3. Check environment setup:
   - `.env.example` should exist.
   - `.env` should exist locally.
   - If `.env` is missing, copy `.env.example` to `.env` and ask the user to add their real `OPENAI_API_KEY`.
4. Check the port:
   - Default port is `3101`.
   - If `3101` is busy, ask the user whether to change `PORT` in `.env`.
5. Start the app:
   ```powershell
   npm run dev
   ```
6. Verify the app:
   - Wait for `Server running on http://localhost:3101`.
   - Open or tell the user to open `http://localhost:3101`.

## Useful Commands

Install dependencies:

```powershell
npm install
```

Create `.env` from the example:

```powershell
Copy-Item .env.example .env
```

Run the dev server:

```powershell
npm run dev
```

Run type checking:

```powershell
npm run typecheck
```

Compile the frontend bundle manually:

```powershell
npx tsc -p tsconfig.frontend.json
```

Check whether port `3101` is in use on Windows:

```powershell
netstat -ano | Select-String ":3101"
```

## Expected Environment Variables

`.env` should contain:

```env
OPENAI_API_KEY=sk-your-real-key
OPENAI_MODEL=gpt-5.4-mini
PORT=3101
```

## Troubleshooting

### Port already in use

If `3101` is already occupied:

1. Ask the user whether to stop the other process or use a different port.
2. If using a different port, update `PORT` in `.env`.
3. Restart `npm run dev`.

### Missing OpenAI key

If the backend reports `Missing OPENAI_API_KEY`, ask the user to edit `.env` and add a valid key. Do not ask them to paste the key into chat.

### Frontend changes not visible

Run:

```powershell
npx tsc -p tsconfig.frontend.json
```

Then refresh the browser.

### TypeScript errors

Run:

```powershell
npm run typecheck
```

Fix reported errors before retrying the local run.
