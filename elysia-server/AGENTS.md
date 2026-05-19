# AGENTS.md — `elysia-server/`

Module-scoped agent instructions. Mirror of [`CLAUDE.md`](./CLAUDE.md);
keep both in sync. Root contract: [`../AGENTS.md`](../AGENTS.md).

## Stack

- Bun 1.3+ runtime (not Node).
- Elysia (HTTP), Drizzle ORM, Postgres, Zod, Biome, pino.

## Commands

```bash
bun install
bun run dev          # watch mode
bun lint             # auto-fix (Biome)
bun lint:check       # read-only (CI / hooks)
bun type-check       # tsc --noEmit
bun run db:generate  # generate migration (user-approval required)
```

Don't run `bun db:migrate` / `bun db:push` / `bun db:reset` — blocked.

## Boot order (`src/index.ts`)

`waitForDatabase` → `runMigrations` → `settingsRepository.initializeDefaults`
→ middleware → routes → `listen(PORT)`.

Throws at boot if `JWT_SECRET`, `JWT_REFRESH_SECRET`, or `ENCRYPTION_KEY`
is missing.

## Adding a route

1. Create `src/routes/<name>.routes.ts` (template: `customer.routes.ts`).
2. Register in `src/routes/index.ts` — above `authMiddleware` = public,
   below = protected.
3. Validate body + response (Zod / Elysia `t.*`).
4. DB access via `repositories/`; external calls via `services/`.
5. Run `bun lint` + `bun type-check`.

## Schema changes

1. Edit `src/db/schema/<table>.ts`.
2. Ask user → `bun run db:generate`.
3. Review SQL in `drizzle/<timestamp>_<name>.sql`. Call out destructive
   ops (drop, rename, NOT NULL on populated column).
4. Commit SQL + `drizzle/meta/_journal.json`.

## Gotchas

- `noUncheckedIndexedAccess: true` — array/record indexing returns
  `T | undefined`. Don't paper with `!`.
- `verbatimModuleSyntax: true` — use `import type { ... }` for types.
- Optional integrations (Google, Slack) lazy-init; routes return 503
  when the dependency is missing, not 500.
- `EncryptionService` is eagerly instantiated — `ENCRYPTION_KEY` (32
  raw bytes, hex) is mandatory.
