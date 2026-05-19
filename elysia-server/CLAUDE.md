# `elysia-server/` — agent instructions

Module-scoped rules for the Elysia API server. The root
[`CLAUDE.md`](../CLAUDE.md) applies first; this file refines.

## Stack reminders

- **Runtime**: Bun 1.3+ (not Node). Always `bun run`, never `node` /
  `npm` here.
- **Framework**: Elysia (typed HTTP).
- **ORM**: Drizzle. Schemas in `src/db/schema/*.ts`, re-exported from
  `src/db/schema.ts`.
- **Validation**: Zod for env (`config.ts`) and request payloads. Elysia
  `t.*` schemas at the route boundary.
- **Lint/format**: Biome (see `biome.json`). Run `bun lint` to auto-fix.
- **Logging**: `pino` via `src/utils/logger.ts` — never `console.log` in
  application code.

## Quality gate (mandatory after every change)

```bash
bun lint           # auto-fix
bun type-check     # tsc --noEmit
```

The Stop hook runs `bun lint:check` + `bun type-check`. Both must be
clean before yielding.

## Boot order (`src/index.ts`)

1. `waitForDatabase()` — polls until Postgres accepts `SELECT 1`.
2. `runMigrations()` — applies pending Drizzle migrations from
   `drizzle/` against `__drizzle_migrations` in schema `public`.
3. `settingsRepository.initializeDefaults()` — seeds default settings rows.
4. CORS (`config.FRONTEND_URLS`), Swagger, error/logger middleware.
5. `routes` (everything under `routes/index.ts`).
6. `.listen(config.PORT)`.

The server **throws on boot** if `JWT_SECRET`, `JWT_REFRESH_SECRET`, or
`ENCRYPTION_KEY` are missing. Don't silently default them.

## Adding a route

Use `customer.routes.ts` as a template. Checklist:

- [ ] Exported as `xxxRoutes` (camelCase).
- [ ] Registered in `routes/index.ts` — **above** `authMiddleware` if
      public, **below** if protected.
- [ ] Body + response schemas defined (Zod or Elysia `t.*`).
- [ ] DB access via a `repositories/` module, not raw `db`.
- [ ] External calls go through a `services/*` module.
- [ ] Error paths use the error response helper, not `throw new Response(...)`.

Or invoke `/new-route <name>`.

## Repositories

Every table has (or should have) a repository in `src/repositories/`.
Route handlers call repositories; repositories own the SQL. This makes
it easy to swap data sources and test.

## Services (`src/services/`)

External integrations live here. Each service is responsible for its
own credential lookup (via `config.ts`) and lazy initialization where
the integration is optional. Example: `GoogleOAuthService` is lazy-init
because Google envs are optional (see commit `b4d1b52`).

When an env is `[OPTIONAL]`:

- The service should construct fine without it.
- Methods that need the missing var should throw or return a typed error.
- The route layer should surface that as a 503, not a 500.

## Schema changes

```text
1. Edit src/db/schema/<table>.ts
   ↓
2. (ask user) bun run db:generate
   ↓
3. Review generated SQL in drizzle/<timestamp>_<name>.sql
   ↓  (use migration-reviewer sub-agent for any destructive op)
4. Commit SQL + drizzle/meta/_journal.json together
```

**Never** run `bun db:migrate` or `bun db:push`. Migrations apply
automatically on server boot via `db/bootstrap.ts`.

## Common gotchas

- `tsconfig.json` enables `noUncheckedIndexedAccess`. Array/Record
  indexing returns `T | undefined`. Use `.at(i)` + check, or destructure
  with a default — not `arr[i]!`.
- `verbatimModuleSyntax: true` is on. Use `import type { ... }` for
  type-only imports. Biome's `noUnusedImports` will flag stragglers.
- `bun-types` is the only types package — don't add `@types/node`.
- `EncryptionService` uses AES-256-GCM with `ENCRYPTION_KEY`. The key
  must be 32 raw bytes (64 hex chars) — generate with
  `openssl rand -hex 32`.

## Slack-specific notes

- Backfill jobs live in `scripts/slack-backfill.ts`. Run via
  `bun run scripts/slack-backfill.ts`.
- Slack webhooks verify `X-Slack-Signature` — `SLACK_SIGNING_SECRET`
  must be set for events to flow.
