# Claude / Agent Instructions — RINDA CRM

This file is the **canonical agent contract** for this repo. Every agent
(Claude Code, Codex via `AGENTS.md`, Cursor, Aider, …) must follow it.

> Mirror file for tools that read the open `AGENTS.md` standard:
> [`AGENTS.md`](./AGENTS.md). **Keep the two in sync.**

---

## 1. Project at a glance

A monorepo with two deployable services and a shared docs/architecture layer.

| Path | Stack | Run |
| --- | --- | --- |
| `frontend/` | React 19 + Vite 6 + Tailwind 4 + TypeScript, **npm** | `npm run dev` / `npm run build` |
| `elysia-server/` | Bun 1.3 + Elysia + Drizzle ORM + Postgres + Zod, **bun** + **Biome** | `bun run dev` / `bun lint` / `bun type-check` |
| `docs/likec4/` | LikeC4 architecture model (`just c4-*`) | `just c4-serve` |
| `.planning/` | Implementation notes & codebase maps | — |

Top-level orchestration is in [`justfile`](./justfile). Prefer `just <recipe>`
over remembering individual `cd` invocations.

The frontend calls the Elysia API at `VITE_API_URL` (build-time only — there
is no runtime config; rebuild to change). The backend's `FRONTEND_URLS`
allowlist must include that origin.

## 2. Repo map (where things live)

```
elysia-server/src/
├── index.ts          # Boot: waitForDatabase → runMigrations → settings init → routes
├── config.ts         # Zod-validated env. Throws on missing required vars.
├── routes/           # One file per domain (customer, prospect, slack, …)
│   └── index.ts      # Registers every route module under authMiddleware
├── services/         # External integrations (gemini, slack, gmail, calendar, …)
├── repositories/     # DB access layer
├── middleware/       # auth, error-handler, logger
├── db/
│   ├── schema.ts     # Re-exports every table from db/schema/*.ts
│   ├── drizzle.ts    # pg pool + drizzle client
│   └── bootstrap.ts  # waitForDatabase + runMigrations (runs from src/index.ts)
└── utils/            # logger, response helpers, etc.

frontend/
├── App.tsx           # ⚠️ 1200+ lines — DON'T add more; split into components.
├── index.tsx         # Mounts <RouterProvider router={router} />
├── src/router.tsx    # React Router routes + auth guards
├── src/services/apiClient.ts  # Single fetch client (uses VITE_API_URL)
├── src/utils/
│   ├── safeStorage.ts    # Always use these for localStorage (try/catch wrapped)
│   ├── apiTransformers.ts
│   └── typeGuards.ts
├── components/       # Top-level feature components (KanbanBoard, ...)
├── components/{auth,followup,modals,settings}/  # Grouped sub-components
├── contexts/         # AuthContext etc.
└── services/         # Frontend-side integration adapters (Gemini, Slack, Email, …)
```

## 3. Mandatory quality gates

Run **after any modification** to the matching tree. The Stop hook
(`.claude/hooks/stop.sh`) runs targeted checks automatically and will
**block end-of-turn** on failure — fix issues before yielding.

### `frontend/`

```bash
cd frontend && npm run build         # full build (slow, but catches everything)
# or for a faster loop:
cd frontend && npx tsc --noEmit      # types only (what the Stop hook runs)
```

### `elysia-server/`

```bash
cd elysia-server && bun lint         # Biome — auto-fixes
cd elysia-server && bun lint:check   # Biome — read-only (CI / hooks)
cd elysia-server && bun type-check   # tsc --noEmit
```

Use the slash commands when you want to check the whole project:
`/check`, `/check-fe`, `/check-be`.

## 4. Type-safety rules

- **Never `any`.** Use `unknown` + a type guard, or write a proper
  interface. Biome's `noExplicitAny` rule is `warn` — treat it as `error`.
- Prefer Drizzle's inferred types (`InferSelectModel`, `InferInsertModel`)
  and Elysia's `t.*` schemas over hand-rolling shapes.
- `tsconfig.json` has `noUncheckedIndexedAccess: true` on the server —
  index access returns `T | undefined`. Don't silence it with `!`.
- Avoid `@ts-ignore` / `@ts-expect-error`. If unavoidable, explain *why*
  inline.

## 5. Database & migrations — **CRITICAL**

The hook layer and `settings.json` `deny` list both block these. The rule:

- **Never run** `bun db:migrate`, `bun db:push`, `bun db:reset`, or
  `drizzle-kit migrate|push` — even "just to check." Migrations apply
  automatically at server boot via [`src/db/bootstrap.ts`](./elysia-server/src/db/bootstrap.ts).
- **Never hand-write** a migration file under `elysia-server/drizzle/` —
  it desyncs `_journal.json`.
- Schema change workflow:
  1. Edit `elysia-server/src/db/schema/<table>.ts` (or add a new file +
     re-export from `db/schema.ts`).
  2. Ask the user to approve, then run `bun run db:generate` (gated by
     `ask` in settings.json).
  3. Review the generated SQL — Drizzle is conservative but not magic.
     Use the `migration-reviewer` sub-agent for a safety pass on any
     destructive op.
  4. Commit the new SQL + updated `_journal.json` together.
- For destructive operations (drop column, rename table, NOT NULL on a
  non-empty column), call out the risk explicitly in the PR description.

## 6. Code style

- Server formatter: **Biome** (see `elysia-server/biome.json`).
  - 2-space indent, 100-col width, double quotes, no semicolons,
    trailing commas always, arrow parens always.
  - `bun lint` writes fixes; don't fight the formatter.
- Frontend: TypeScript + Tailwind utility classes inline. No formatter is
  enforced; match the surrounding file.
- Conventional Commits for subjects (see `CONTRIBUTING.md`): `feat`,
  `fix`, `chore`, `refactor`, `docs`, `security`, `perf`, `test` —
  subject ≤ 70 chars.

## 7. Environment variables

- Server: read **only** through `src/config.ts` (Zod-validated). New vars
  must be declared there and documented in `elysia-server/.env.example`
  with a `[REQUIRED]` / `[OPTIONAL]` marker.
- Frontend: read **only** through `import.meta.env.VITE_*`. Document in
  `frontend/.env.example`. Remember: Vite bakes these in at build time —
  they're public.
- Required-but-missing on the server should fail loudly at startup
  (`config.ts` already does this for `JWT_SECRET`, `ENCRYPTION_KEY`, etc).

## 8. Adding a new API route

1. Create `elysia-server/src/routes/<name>.routes.ts` following the shape
   of an existing file (`customer.routes.ts` is a good template).
2. Register it in [`elysia-server/src/routes/index.ts`](./elysia-server/src/routes/index.ts)
   — **placement matters**: routes above `authMiddleware` are public,
   below are protected.
3. Add Zod / Elysia `t.*` schemas for body + response.
4. Use repositories under `repositories/` for DB access; don't `import { db }`
   directly in a route handler.
5. Run `/check-be`.

Or just: `/new-route <name>`.

## 9. Adding a new frontend feature

- Don't keep growing `frontend/App.tsx` (already 1200+ lines). New
  features belong in `frontend/components/<Feature>.tsx`.
- LocalStorage access must go through `frontend/src/utils/safeStorage.ts`
  — never raw `JSON.parse(localStorage.getItem(...))`.
- API calls go through `frontend/src/services/apiClient.ts`.
- Run `/check-fe` when done.

## 10. Working with sub-agents

Specialized sub-agents live under `.claude/agents/`. Use them when:

- About to commit a generated migration → spawn **`migration-reviewer`**.
- Adding a new route → spawn **`route-auditor`** to catch missing
  registration, schema validation, or auth scope.
- Before pushing → spawn **`type-safety-cop`** on your diff to catch
  `any` / `@ts-ignore` regressions and **`secret-scanner`** to catch
  leaked keys.

## 11. Slash commands

| Command | What it does |
| --- | --- |
| `/check` | Run full backend + frontend quality gates |
| `/check-be` | `bun lint:check` + `bun type-check` |
| `/check-fe` | `npx tsc --noEmit` + `npm run build` |
| `/dev` | Start backend + frontend together (`just dev`) |
| `/db-generate` | Generate Drizzle migration with safety review |
| `/new-route <name>` | Scaffold an Elysia route + register it |
| `/new-component <name>` | Scaffold a React component |
| `/env-audit` | Diff `.env.example` against code usage |

## 12. Module-specific instructions

- Frontend: [`frontend/CLAUDE.md`](./frontend/CLAUDE.md)
- Server: [`elysia-server/CLAUDE.md`](./elysia-server/CLAUDE.md)

## 13. Pitfalls already paid for

- Encryption service is **eagerly instantiated** at boot — missing
  `ENCRYPTION_KEY` crashes the server immediately. Don't paper over it.
- `frontend/App.tsx` is a known hotspot for race conditions on
  `useEffect` cleanup, duplicate intervals, and stale closures. When
  editing it, look at *every* `useEffect` you touch and verify the
  cleanup path.
- LikeC4 model lives in `docs/likec4/` — keep it updated when you change
  service boundaries (`just c4-validate` before commit).
- Migration files under `elysia-server/drizzle/` are committed and
  applied on boot. **Never edit them manually**; always regenerate.
