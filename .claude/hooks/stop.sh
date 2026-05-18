#!/usr/bin/env bash
# Stop hook — runs targeted quality gates if files were modified.
# - Backend: bun lint:check + bun type-check
# - Frontend: npx tsc --noEmit (full `npm run build` is reserved for /check-fe)
# Blocks (exit 2) with the failure output so Claude can fix before yielding.
set -uo pipefail

input="$(cat)"
already_active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
if [ "$already_active" = "true" ]; then
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"
cache=".claude/.cache"
fe_marker="$cache/fe-touched"
be_marker="$cache/be-touched"

if [ ! -f "$fe_marker" ] && [ ! -f "$be_marker" ]; then
  exit 0
fi

failures=""
declare -a outputs=()

run_check() {
  local label="$1"; shift
  local output
  if output="$("$@" 2>&1)"; then
    outputs+=("✅ $label passed")
  else
    failures+="❌ $label failed:\n$output\n\n"
  fi
}

if [ -f "$be_marker" ]; then
  echo "🔍 backend: bun lint:check + bun type-check ..." >&2
  run_check "backend lint" bash -c "cd elysia-server && bun lint:check"
  run_check "backend type-check" bash -c "cd elysia-server && bun type-check"
  rm -f "$be_marker"
fi

if [ -f "$fe_marker" ]; then
  echo "🔍 frontend: tsc --noEmit ..." >&2
  run_check "frontend type-check" bash -c "cd frontend && npx --no-install tsc --noEmit"
  rm -f "$fe_marker"
fi

if [ -n "$failures" ]; then
  {
    printf '%b' "$failures"
    echo
    echo "Fix these before yielding. CLAUDE.md requires lint + type-check to pass after edits."
  } >&2
  # Exit 2 → block stop and feed stderr back to Claude.
  exit 2
fi

for line in "${outputs[@]}"; do echo "$line" >&2; done
exit 0
