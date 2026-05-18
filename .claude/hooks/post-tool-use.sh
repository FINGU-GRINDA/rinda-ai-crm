#!/usr/bin/env bash
# PostToolUse hook — records which module was modified so the Stop hook
# can run a targeted check. Intentionally cheap: just a marker file.
set -uo pipefail

input="$(cat)"
tool_name="$(printf '%s' "$input" | jq -r '.tool_name // ""')"

case "$tool_name" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')"
[ -z "$file_path" ] && exit 0

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cache="$repo_root/.claude/.cache"
mkdir -p "$cache"

case "$file_path" in
  *"/elysia-server/src/"*|*"/elysia-server/drizzle.config.ts"|*"/elysia-server/tsconfig.json"|*"/elysia-server/biome.json")
    touch "$cache/be-touched" ;;
  *"/frontend/"*.ts|*"/frontend/"*.tsx|*"/frontend/tsconfig.json"|*"/frontend/vite.config.ts")
    touch "$cache/fe-touched" ;;
esac

exit 0
