# Agent Harness Engineering Guide

How this repo is set up for **Claude Code**, **Codex**, **Cursor**,
**Aider**, and other coding agents to make safe, consistent changes.

If you're new to the repo and want to make an agent work well here,
start with this doc, then read [`/CLAUDE.md`](../CLAUDE.md).

---

## 1. Single source of truth

The agent contract lives in **two mirrored files** at the repo root:

| File | Read by |
| --- | --- |
| [`CLAUDE.md`](../CLAUDE.md) | Claude Code |
| [`AGENTS.md`](../AGENTS.md) | Codex, Cursor, Aider, anything that reads the [agents.md](https://agents.md) open standard |

Both contain the same content. **When you change one, change the other.**

Module-specific contracts live next to the code:

- [`elysia-server/CLAUDE.md`](../elysia-server/CLAUDE.md) +
  [`elysia-server/AGENTS.md`](../elysia-server/AGENTS.md)
- [`frontend/CLAUDE.md`](../frontend/CLAUDE.md) +
  [`frontend/AGENTS.md`](../frontend/AGENTS.md)

## 2. Permission model (`.claude/settings.json`)

Committed to the repo, applies to every developer:

- **`allow`** — common safe commands (read-only git, build, lint,
  type-check, `just <recipe>`, dependency install). No permission
  prompts.
- **`deny`** — destructive operations that cannot be approved through
  the UI: `bun db:migrate`, `bun db:push`, `bun db:reset`, `git push
  --force`, `git reset --hard origin/...`, `rm -rf`, reading `.env`
  files and SSH keys.
- **`ask`** — gated on user approval: `git push`, `bun run db:generate`,
  `docker:*`.

Per-developer overrides go in `.claude/settings.local.json`
(**gitignored** — see `.gitignore`).

## 3. Hooks (`.claude/hooks/`)

Three shell scripts:

| Hook | When | What |
| --- | --- | --- |
| `session-start.sh` | session start / resume / clear | Runs `bun install` and `npm install` if `node_modules/` is missing (fresh cloud containers); injects a short status block into context. |
| `post-tool-use.sh` | after every `Edit` / `Write` / `MultiEdit` | Writes a marker file (`.claude/.cache/{be,fe}-touched`) noting which module was modified. Cheap — no checks here. |
| `stop.sh` | when Claude tries to yield | If `be-touched` exists, runs `bun lint:check` + `bun type-check`. If `fe-touched` exists, runs `npx tsc --noEmit`. **Blocks stop on failure** (exit 2) and feeds the errors back to Claude. |

Why split it this way? Running lint/type-check after every single edit
is loud and slow, especially with multi-file changes. Running it once
at end-of-turn catches everything in one pass and only one place.

The hooks are written so they're **safe to run manually**:

```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"elysia-server/src/foo.ts"}}' \
  | bash .claude/hooks/post-tool-use.sh
ls .claude/.cache/    # → be-touched
```

## 4. Slash commands (`.claude/commands/`)

| Command | Purpose |
| --- | --- |
| `/check` | Full backend + frontend quality gates. |
| `/check-be` | Backend lint + type-check only. |
| `/check-fe` | Frontend type-check + production build. |
| `/dev` | `just dev` — start both services. |
| `/db-generate` | Generate a Drizzle migration with a safety review. |
| `/new-route <name>` | Scaffold an Elysia route + register it. |
| `/new-component <name>` | Scaffold a React component (keeps `App.tsx` from growing). |
| `/env-audit` | Diff `.env.example` against `process.env.*` / `import.meta.env.*` usage. |

## 5. Sub-agents (`.claude/agents/`)

Spawned via the `Agent` tool with `subagent_type: <name>`:

| Agent | Use when |
| --- | --- |
| `migration-reviewer` | About to commit a generated Drizzle migration. Flags destructive ops, missing FK indexes, NOT-NULL-without-default. |
| `route-auditor` | Added or modified an Elysia route. Verifies registration in `routes/index.ts`, schema validation, repository pattern, auth scope. |
| `type-safety-cop` | Before committing. Scans the diff for `any`, `@ts-ignore`, non-null assertions, `biome-ignore`. |
| `secret-scanner` | Before pushing. Scans the diff for leaked API keys, JWTs, PEM blocks, AWS creds. |

These are all **read-only** by design. They report; the parent agent
acts.

## 6. Cloud / web execution notes

Sessions are ephemeral — the container is reclaimed when idle. Anything
you want to keep must be committed and pushed first.

The `SessionStart` hook handles the most painful part: dependency
install on a freshly cloned repo. If you see "module not found" on
boot, check the SessionStart output (the hook surfaces install
errors).

GitHub interaction goes through the **`mcp__github__*`** tools (no
`gh` CLI in cloud sessions). The MCP server is scoped to
`fingu-grinda/rinda-ai-crm` — calls to other repos are denied.

## 7. Updating the harness

When you change agent rules:

1. Update [`CLAUDE.md`](../CLAUDE.md) (canonical).
2. Mirror to [`AGENTS.md`](../AGENTS.md).
3. Mirror to module files if relevant.
4. Update this doc if the harness shape (hooks, commands, agents)
   changed.

If you add a new slash command or sub-agent, add a row to the
relevant table above.

## 8. Codex / Cursor / Aider parity

Other tools read `AGENTS.md`. They don't see:

- `.claude/settings.json` (no permission model).
- `.claude/hooks/` (no automatic quality gates).
- `.claude/commands/` (no slash commands).
- `.claude/agents/` (no sub-agent system).

For those tools, the contract in `AGENTS.md` is **all** they know. So
it documents the commands (`bun lint`, `npm run build`, …) as plain
shell commands — they should work from a fresh checkout with no Claude
Code installed.

## 9. Files involved (cheat sheet)

```
.gitignore                          # ignores .claude/settings.local.json + .cache
CLAUDE.md                           # canonical agent contract (Claude)
AGENTS.md                           # mirror (Codex / Cursor / Aider)
docs/HARNESS.md                     # this file
frontend/CLAUDE.md + AGENTS.md      # module rules
elysia-server/CLAUDE.md + AGENTS.md # module rules
.claude/
├── settings.json                   # team-shared permissions + hooks
├── settings.local.json             # gitignored, per-dev
├── hooks/
│   ├── session-start.sh
│   ├── post-tool-use.sh
│   └── stop.sh
├── commands/                       # /check, /check-be, /check-fe, /dev, /db-generate, /new-route, /new-component, /env-audit
└── agents/                         # migration-reviewer, route-auditor, type-safety-cop, secret-scanner
```
