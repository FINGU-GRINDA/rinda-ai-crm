# AGENTS.md — RINDA CRM

This is the **open-standard agent contract** ([agents.md](https://agents.md))
for this repo. Codex, Cursor, Aider, and other tools that read `AGENTS.md`
should treat this file as authoritative.

Claude Code reads [`CLAUDE.md`](./CLAUDE.md) — the two files are kept
in sync in intent (every rule appears in both), though their section
structure differs. **Keep both files in sync** when you update either.

---

## Project at a glance

Monorepo with two services:

- **`frontend/`** — React 19 + Vite 6 + Tailwind 4 + TypeScript. Package
  manager: **npm**.
- **`elysia-server/`** — Bun 1.3 + Elysia + Drizzle ORM + Postgres + Zod.
  Linter/formatter: **Biome**. Package manager: **bun**.

Plus `docs/likec4/` (architecture model) and `.planning/` (notes).
Top-level commands are in [`justfile`](./justfile) — prefer `just <recipe>`.

The frontend calls the Elysia API at `VITE_API_URL` (build-time only).
Backend's `FRONTEND_URLS` allowlist must include that origin.

## Dev / build / test commands

```bash
# Frontend
cd frontend && npm install            # deps
cd frontend && npm run dev            # local dev server
cd frontend && npm run build          # production build + type-check
cd frontend && npx tsc --noEmit       # types only (fast)

# Server
cd elysia-server && bun install       # deps
cd elysia-server && bun run dev       # local dev server (watch)
cd elysia-server && bun lint          # Biome — auto-fixes
cd elysia-server && bun lint:check    # Biome — read-only
cd elysia-server && bun type-check    # tsc --noEmit

# Together
just dev                              # runs both
just be-check                         # lint + type-check
```

There is **no test suite** yet. The build + type-check + lint are the only
automated quality gates — they MUST pass after every change.

## Repo map

```
elysia-server/src/
├── index.ts          # Boot: waitForDatabase → runMigrations → routes
├── config.ts         # Zod-validated env (throws on missing required vars)
├── routes/           # One file per domain; routes/index.ts wires them up
├── services/         # External integrations (gemini, slack, gmail, ...)
├── repositories/     # DB access layer
├── middleware/       # auth, error-handler, logger
└── db/
    ├── schema.ts     # Re-exports tables from db/schema/*.ts
    ├── drizzle.ts    # pg pool + drizzle client
    └── bootstrap.ts  # Runs migrations at startup

frontend/
├── App.tsx           # ⚠️ 1200+ lines — DON'T grow it; split into components
├── src/router.tsx    # React Router + auth guards
├── src/services/apiClient.ts
├── src/utils/{safeStorage,apiTransformers,typeGuards}.ts
├── components/       # All feature components live here
├── contexts/         # AuthContext, ...
└── services/         # Frontend integration adapters
```

## Code style

- **No `any`.** Use `unknown` + type guard. Biome's `noExplicitAny` is `warn` —
  treat as `error`.
- Server tsconfig has `noUncheckedIndexedAccess: true`. Indexed access
  returns `T | undefined`. Don't silence with `!`.
- Server formatter: **Biome** — 2-space indent, 100-col, double quotes,
  no semicolons, trailing commas, always-paren arrows. `bun lint`
  writes fixes.
- Frontend: no formatter enforced; match surrounding file.
- Avoid `@ts-ignore` / `@ts-expect-error`; if unavoidable, explain inline.
- Use Drizzle's `InferSelectModel` / `InferInsertModel` and Elysia's
  `t.*` schemas instead of hand-rolling types.

## Database / migration rules — **CRITICAL**

- **Never run `bun db:migrate` or `bun db:push`.** Migrations apply
  automatically at server boot (see `elysia-server/src/db/bootstrap.ts`).
- **Never hand-write a migration file** under `elysia-server/drizzle/`.
- Schema change workflow:
  1. Edit `elysia-server/src/db/schema/<table>.ts`.
  2. Get user approval, then run `bun run db:generate`.
  3. Review the generated SQL — flag any destructive op (drop column,
     rename, NOT NULL on populated column) in the PR description.
  4. Commit the SQL + updated `_journal.json` together.

## Environment variables

- Server: read **only** through `src/config.ts` (Zod-validated). Document
  every new var in `elysia-server/.env.example` with `[REQUIRED]` or
  `[OPTIONAL]` and a one-line description.
- Frontend: read **only** through `import.meta.env.VITE_*`. Document in
  `frontend/.env.example`. Vite bakes these in at build time — they are
  effectively public.

## Adding an API route

1. Create `elysia-server/src/routes/<name>.routes.ts` modeled on
   `customer.routes.ts`.
2. Register it in `elysia-server/src/routes/index.ts`. **Placement
   matters**: routes above `authMiddleware` are public, below are
   protected.
3. Validate body + response with Zod / Elysia `t.*`.
4. DB access goes through `repositories/`, not direct `import { db }`.
5. Run lint + type-check.

## Adding a frontend feature

- Do **not** add code to `App.tsx`; it's already 1200+ lines. New
  features go in `frontend/components/<Feature>.tsx`.
- `localStorage` access must use `frontend/src/utils/safeStorage.ts`.
- API calls go through `frontend/src/services/apiClient.ts`.

## Commit / PR conventions

- Conventional Commits: `<type>(<scope>): <subject>` with subject ≤ 70
  chars. Types in use: `feat`, `fix`, `chore`, `refactor`, `docs`,
  `security`, `perf`, `test`.
- Prefer squash-merge to keep `main` linear.
- Branch from `main`; name like `feat/<topic>`, `fix/<topic>`, etc.
- Open PRs as **draft** initially; mark ready once lint/type-check/build
  all pass.
- **AI-tooling attribution in commits** — never `Co-Authored-By: Claude`, never mention Claude / Claude Code / AI in commit messages, PR titles, or PR bodies.

## Pitfalls already paid for

- Server's `EncryptionService` is eagerly instantiated — missing
  `ENCRYPTION_KEY` crashes the server at boot. Don't paper over it.
- `App.tsx` has had multiple bugs from `useEffect` cleanup mistakes and
  duplicate intervals. When editing it, verify cleanup on every
  `useEffect` you touch.
- Migration files in `elysia-server/drizzle/` are applied at boot;
  hand-edits desync `_journal.json`.

## Module-specific contracts

- [`frontend/AGENTS.md`](./frontend/AGENTS.md)
- [`elysia-server/AGENTS.md`](./elysia-server/AGENTS.md)
