---
description: Run the full backend + frontend quality gates
allowed-tools: Bash(cd elysia-server && bun lint:check), Bash(cd elysia-server && bun type-check), Bash(cd frontend && npm run build), Bash(cd frontend && npx tsc --noEmit)
---

Run the complete quality gate suite, in order:

1. `cd elysia-server && bun lint:check` — Biome (read-only).
2. `cd elysia-server && bun type-check` — `tsc --noEmit`.
3. `cd frontend && npx tsc --noEmit` — frontend types.
4. `cd frontend && npm run build` — full Vite production build.

Report PASS/FAIL per step. If any step fails:

- Quote the relevant error excerpts (not the full output).
- Propose the smallest fix that addresses the root cause.
- Do **not** add fallbacks, `any`, `@ts-ignore`, or `eslint-disable` to
  silence errors — fix them.

End with a one-line summary: `✅ all gates pass` or `❌ <N> gate(s) failed`.
