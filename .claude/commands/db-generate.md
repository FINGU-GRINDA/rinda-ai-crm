---
description: Generate a Drizzle migration with a safety review
argument-hint: [migration name, e.g. "add_customer_tags"]
allowed-tools: Bash(cd elysia-server && bun run db:generate:*), Read(./elysia-server/drizzle/**), Read(./elysia-server/src/db/**)
---

Generate a new Drizzle migration with a built-in safety review.

## Workflow

1. **Confirm schema state.** Read the relevant file(s) under
   `elysia-server/src/db/schema/` and summarize for the user what
   changed in the schema source vs. `main`.
2. **Get explicit approval.** Show the diff and ask the user whether to
   proceed. Do not auto-run.
3. **Run** `cd elysia-server && bun run db:generate` (passing `$ARGUMENTS`
   as the name if provided). This requires the `ask` prompt from
   settings.json — the user will see and approve the command.
4. **Read the generated SQL** under `elysia-server/drizzle/` (newest
   timestamped file).
5. **Run the `migration-reviewer` sub-agent** on the SQL to identify:
   - Drop column / drop table / rename
   - Adding `NOT NULL` without a default to a non-empty table
   - Type changes that lose precision
   - Missing indexes on FK columns
6. **Report**. Show the SQL summary and the reviewer's findings. Do
   **not** apply — migrations apply at server boot
   (`elysia-server/src/db/bootstrap.ts`).
7. **Stage** the new `.sql` file and the updated `drizzle/meta/_journal.json`
   together. Don't commit; ask the user to commit when they're ready.

## Hard rules

- Never run `bun db:migrate`, `bun db:push`, or `bun db:reset` — all are
  blocked by `settings.json`.
- Never hand-edit a generated migration. If the SQL is wrong, edit the
  schema source and regenerate.
