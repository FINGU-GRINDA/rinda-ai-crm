---
description: Run backend Biome lint + tsc type-check
allowed-tools: Bash(cd elysia-server && bun lint:check), Bash(cd elysia-server && bun type-check)
---

Run backend quality gates only:

1. `cd elysia-server && bun lint:check`
2. `cd elysia-server && bun type-check`

If either fails:

- Quote the error excerpts (not the full output).
- Propose root-cause fixes. No `any` / `@ts-ignore` to silence.
- For Biome auto-fixable issues, suggest running `bun lint` (write mode).

End with `✅ backend clean` or `❌ backend failed`.
