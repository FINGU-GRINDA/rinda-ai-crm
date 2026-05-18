# Contributing to RINDA CRM

Thanks for contributing. This guide is intentionally short — the
detailed rules (commands, style, type-safety, migrations) live in the
agent contract files, which apply to both humans and AI tools:

- [`CLAUDE.md`](./CLAUDE.md) — canonical
- [`AGENTS.md`](./AGENTS.md) — mirror (open standard)
- Module-specific: [`frontend/CLAUDE.md`](./frontend/CLAUDE.md),
  [`elysia-server/CLAUDE.md`](./elysia-server/CLAUDE.md)
- Harness setup (hooks, slash commands, sub-agents):
  [`docs/HARNESS.md`](./docs/HARNESS.md)

If you only read one file, read [`CLAUDE.md`](./CLAUDE.md).

For the project overview see [`README.en.md`](./README.en.md) or
[`README.md`](./README.md).

---

## Workflow

1. **Branch from `main`.** Naming: `feat/<topic>`, `fix/<topic>`,
   `chore/<topic>`, `docs/<topic>`, `refactor/<topic>`.
2. Make focused commits — Conventional Commits, subject ≤ 70 chars.
3. Push and open a **draft** PR against `main`. Mark ready once CI is
   green.
4. Prefer **squash-merge** to keep `main` linear.

## Commit messages

```
<type>(<optional scope>): <imperative summary>
```

Types in use: `feat`, `fix`, `chore`, `refactor`, `docs`, `security`,
`perf`, `test`. Use the body for the *why*.

## Quality gates (must pass before review)

| Module | Command |
| --- | --- |
| `frontend/` | `cd frontend && npm run build` |
| `elysia-server/` | `cd elysia-server && bun lint && bun type-check` |

If you're using Claude Code, `/check` runs all four in one pass.

For UI changes, **exercise the feature in a browser** — type-check and
build don't verify behavior.

## Pull-request checklist

- [ ] Branch up to date with `main`
- [ ] Conventional Commits
- [ ] `bun lint` + `bun type-check` pass (if `elysia-server/` changed)
- [ ] `npm run build` passes (if `frontend/` changed)
- [ ] UI changes exercised in a browser
- [ ] New env vars documented in the matching `.env.example`
- [ ] No secrets / `.env` files in the diff
- [ ] No `any` types introduced
- [ ] If schema changed: migration generated via `bun run db:generate`,
      SQL reviewed, `drizzle/meta/_journal.json` committed together

## Reporting bugs / requesting features

Open a GitHub issue with: minimal reproduction, expected vs. actual,
environment (OS, browser, Bun version), screenshots / logs.

## Security

For security issues, **do not open a public issue.** Email maintainers
privately (see `git log` for current maintainers).
