---
description: Run frontend type-check + production build
allowed-tools: Bash(cd frontend && npx tsc --noEmit), Bash(cd frontend && npm run build)
---

Run frontend quality gates:

1. `cd frontend && npx tsc --noEmit` (fast, run first)
2. `cd frontend && npm run build` (full Vite production build)

If either fails:

- Quote error excerpts (not the full output).
- Propose root-cause fixes.

Reminder: for UI / behavior changes, type-check + build do **not**
verify behavior. Tell the user explicitly that the feature should be
exercised in a browser.

End with `✅ frontend clean` or `❌ frontend failed`.
