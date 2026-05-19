#!/usr/bin/env bash
# SessionStart hook — bootstrap dependencies on fresh (cloud) containers.
# Runs only when node_modules is missing, so warm containers pay no cost.
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

declare -a notes=()

if [ -d "elysia-server" ] && [ ! -d "elysia-server/node_modules" ]; then
  if command -v bun >/dev/null 2>&1; then
    echo "📦 elysia-server: bun install ..." >&2
    if (cd elysia-server && bun install --silent 2>&1 | tail -5 >&2); then
      notes+=("backend deps installed")
    else
      notes+=("⚠️  backend bun install failed — run \`cd elysia-server && bun install\` manually")
    fi
  else
    notes+=("⚠️  bun not found — backend deps not installed")
  fi
fi

if [ -d "frontend" ] && [ ! -d "frontend/node_modules" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "📦 frontend: npm install ..." >&2
    if (cd frontend && npm install --silent 2>&1 | tail -5 >&2); then
      notes+=("frontend deps installed")
    else
      notes+=("⚠️  frontend npm install failed — run \`cd frontend && npm install\` manually")
    fi
  else
    notes+=("⚠️  npm not found — frontend deps not installed")
  fi
fi

mkdir -p .claude/.cache

# Surface dependency status (and a brief harness reminder) into the session.
{
  echo "## Harness status"
  if [ ${#notes[@]} -eq 0 ]; then
    echo "- Dependencies already installed (warm container)."
  else
    for n in "${notes[@]}"; do echo "- $n"; done
  fi
  echo
  echo "Quality gates configured. After edits, the Stop hook auto-runs:"
  echo "- elysia-server changes → \`bun lint:check\` + \`bun type-check\`"
  echo "- frontend changes → \`npx tsc --noEmit\` (full \`npm run build\` reserved for /check-fe)"
  echo
  echo "Never run \`bun db:migrate\` / \`bun db:push\` (blocked in settings.json)."
} | jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: .
  }
}'

exit 0
