---
description: Diff .env.example against actual usage in code
allowed-tools: Read(./elysia-server/**), Read(./frontend/**), Bash(grep:*), Bash(rg:*)
---

Audit environment variable hygiene. Produce a single report.

## Server (`elysia-server/`)

1. Read `elysia-server/.env.example` — list every key and whether it's
   marked `[REQUIRED]` or `[OPTIONAL]`.
2. Read `elysia-server/src/config.ts` — list every key declared in the
   Zod schema.
3. `rg -n 'process\.env\.' elysia-server/src/` to find any direct
   `process.env.*` access outside `config.ts` — those are **violations**
   (env must be read through `config.ts`).
4. Compare. Report:
   - Keys in code but not in `.env.example` → undocumented.
   - Keys in `.env.example` but not in `config.ts` → dead.
   - `[REQUIRED]` keys without a `z.string()` (no `.optional()`) → mismatch.

## Frontend (`frontend/`)

1. Read `frontend/.env.example`.
2. `rg -n 'import\.meta\.env\.VITE_' frontend/` — every key actually read.
3. Compare. Report undocumented + dead vars.

## Output

Markdown table with columns: `key | declared in example? | used in code? | issue`.
End with a one-line summary and a recommended next action (e.g. "add
`FOO_BAR` to `.env.example` with a `[REQUIRED]` marker").

Do **not** modify any file. This is a read-only audit.
