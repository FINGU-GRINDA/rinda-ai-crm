# Contributing to RINDA CRM

Thanks for contributing. This guide covers the conventions every PR is expected to follow.

For the full project overview see [`README.en.md`](./README.en.md) (English) or
[`README.md`](./README.md) (Korean).

---

## Workflow

1. **Branch from `main`.** Name branches descriptively: `feat/<topic>`,
   `fix/<topic>`, `chore/<topic>`, `docs/<topic>`, `refactor/<topic>`.
2. Make focused commits — see *Commit messages* below.
3. Push and open a pull request against `main`.
4. CI must be green and code review must pass before merge.
5. Prefer **squash-merge** to keep `main` linear and readable.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative summary>
```

Common types used in this repo: `feat`, `fix`, `chore`, `refactor`, `docs`,
`security`, `perf`, `test`.

Examples:

```
feat(slack): add file attachment processing for CS channel messages
fix: add customer status endpoint for kanban drag-drop
chore: bump postgres to 18-alpine
```

Keep the subject line ≤ 70 characters. Use the body for the *why*.

## Code quality gates

These checks run locally and in CI. **All must pass before review.**

### Frontend (`frontend/`)

After any change in `frontend/`:

```bash
cd frontend
npm run build
```

Fix every build error before opening the PR. For UI work, also run the app
locally and exercise the affected feature in a browser — type-checking does
not verify behavior.

### Server (`elysia-server/`)

After any change in `elysia-server/`:

```bash
cd elysia-server
bun lint          # Biome — write mode; fixes most issues automatically
bun type-check    # tsc --noEmit
```

Fix every lint warning and type error before opening the PR.

## Type-safety rules

- **No `any`.** Period. Use `unknown` with a type guard if the type is truly
  unknown, or write a proper interface/type.
- Prefer Drizzle/Elysia's inferred types over hand-rolling shapes that
  duplicate the source of truth.
- Avoid `// @ts-ignore` and `// @ts-expect-error` unless the alternative is
  materially worse — explain *why* in a comment.

## Database migrations

Migrations are dangerous: a bad one can lose production data or de-sync the
hosted DB from local. Strict rules:

- **Never run `bun db:migrate` or `bun db:push` without explicit approval.**
- **Never hand-write a migration file** — always generate via
  `bun db:generate` so it stays in sync with `_journal.json`.
- When schema changes are needed:
  1. Edit `src/db/schema.ts`.
  2. Run `bun db:generate` to produce the SQL migration.
  3. Review the generated SQL — Drizzle does not always do the right thing for
     destructive operations.
  4. Commit the new migration file and `_journal.json` together.
  5. Migrations are applied on server boot
     ([`src/db/bootstrap.ts`](./elysia-server/src/db/bootstrap.ts)) — no
     manual step is required in deploys.

## Environment variables

When you introduce a new env var:

1. Read it through `src/config.ts` (server) or `import.meta.env.VITE_*` (frontend).
2. Add it to the relevant `.env.example` with a `[REQUIRED]` or `[OPTIONAL]`
   marker and a one-line description.
3. If `[REQUIRED]`, fail loudly at startup (don't silently default to a
   placeholder).

## Pull-request checklist

Before requesting review:

- [ ] Branch is up to date with `main`
- [ ] Commit messages follow Conventional Commits
- [ ] Server: `bun lint` and `bun type-check` pass
- [ ] Frontend: `npm run build` passes
- [ ] UI changes were exercised in a browser
- [ ] New env vars are documented in the matching `.env.example`
- [ ] No secrets or `.env` files are in the diff
- [ ] No `any` types introduced

## Reporting bugs / requesting features

Open a GitHub issue with:

- A minimal reproduction (or steps to trigger)
- Expected vs. actual behavior
- Environment (OS, browser, Bun version)
- Screenshots / logs where applicable

## Security

If you find a security issue, **do not open a public issue**. Email the
maintainers privately (see `git log` for current maintainers) so we can patch
before disclosure.
