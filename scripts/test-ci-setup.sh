#!/usr/bin/env bash
#
# TDD harness for the CI + lefthook + biome setup.
#
# Each assertion below codifies a piece of the expected end state.
# Run from repo root:  bash scripts/test-ci-setup.sh
#
# Exit 0 = everything green. Exit 1 = at least one failing assertion.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
FAILED_NAMES=()

ok()    { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
nope()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); }
group() { printf "\n\033[1m── %s\033[0m\n" "$1"; }

assert_file() {
  local path="$1"
  if [ -f "$path" ]; then ok "exists: $path"; else nope "missing: $path"; fi
}

assert_grep() {
  local file="$1" pattern="$2" label="$3"
  if [ -f "$file" ] && grep -qE "$pattern" "$file"; then
    ok "$label"
  else
    nope "$label"
  fi
}

assert_cmd() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else nope "$label"; fi
}

# ── 1. Root lefthook host ─────────────────────────────────────────────
group "Root lefthook host"
assert_file "package.json"
assert_grep "package.json" '"lefthook"' "root package.json declares lefthook devDep"
assert_grep "package.json" '"prepare":.*"lefthook install"' "root package.json has prepare script"

# ── 2. Lefthook config ────────────────────────────────────────────────
group "Lefthook config"
assert_file "lefthook.yml"
assert_grep "lefthook.yml" '^pre-commit:' "lefthook.yml defines pre-commit stage"
assert_grep "lefthook.yml" '^pre-push:'   "lefthook.yml defines pre-push stage"
assert_grep "lefthook.yml" 'biome check'  "lefthook.yml runs biome check"
assert_grep "lefthook.yml" 'bun type-check' "lefthook.yml runs backend type-check on push"
assert_grep "lefthook.yml" 'npm run build' "lefthook.yml runs frontend build on push"

# ── 3. Frontend biome ─────────────────────────────────────────────────
group "Frontend Biome"
assert_file "frontend/biome.json"
assert_grep "frontend/package.json" '"@biomejs/biome"' "frontend devDep has @biomejs/biome"
assert_grep "frontend/package.json" '"lint":'         "frontend has lint script"
assert_grep "frontend/package.json" '"lint:check":'   "frontend has lint:check script"
assert_grep "frontend/package.json" '"format":'       "frontend has format script"
assert_grep "frontend/package.json" '"format:check":' "frontend has format:check script"
assert_grep "frontend/package.json" '"type-check":'   "frontend has type-check script"

# ── 4. Backend biome (unchanged, sanity only) ────────────────────────
group "Backend Biome (sanity)"
assert_file "elysia-server/biome.json"
assert_grep "elysia-server/package.json" '"lint:check":' "backend retains lint:check script"
assert_grep "elysia-server/package.json" '"type-check":' "backend retains type-check script"

# ── 5. CI workflow ────────────────────────────────────────────────────
group "GitHub Actions CI"
assert_file ".github/workflows/ci.yml"
assert_grep ".github/workflows/ci.yml" 'branches:.*main'    "CI triggers on push to main"
assert_grep ".github/workflows/ci.yml" 'pull_request'       "CI triggers on pull_request"
assert_grep ".github/workflows/ci.yml" 'concurrency:'       "CI defines concurrency"
assert_grep ".github/workflows/ci.yml" 'cancel-in-progress' "CI cancels superseded runs"
assert_grep ".github/workflows/ci.yml" 'oven-sh/setup-bun'  "CI sets up bun for backend"
assert_grep ".github/workflows/ci.yml" 'actions/setup-node' "CI sets up node for frontend"
assert_grep ".github/workflows/ci.yml" 'bun lint:check'     "CI runs backend lint:check"
assert_grep ".github/workflows/ci.yml" 'bun type-check'     "CI runs backend type-check"
assert_grep ".github/workflows/ci.yml" 'npm run lint:check' "CI runs frontend lint:check"
assert_grep ".github/workflows/ci.yml" 'npm run build'      "CI runs frontend build"
assert_file ".nvmrc"

# ── 6. Justfile recipes ──────────────────────────────────────────────
group "Justfile recipes"
assert_grep "justfile" '^fe-lint:'        "justfile has fe-lint recipe"
assert_grep "justfile" '^fe-lint-check:'  "justfile has fe-lint-check recipe"
assert_grep "justfile" '^fe-typecheck:'   "justfile has fe-typecheck recipe"
assert_grep "justfile" '^fe-check:'       "justfile has fe-check recipe"
assert_grep "justfile" '^check:'          "justfile has top-level check recipe"

# ── 7. .gitignore ────────────────────────────────────────────────────
group "Gitignore"
assert_grep ".gitignore" '^node_modules/?' "root .gitignore ignores node_modules/"

# ── 8. Tooling actually works ────────────────────────────────────────
group "Live tool execution"
if [ -f "frontend/biome.json" ] && [ -d "frontend/node_modules/@biomejs/biome" ]; then
  assert_cmd "frontend biome runs (--version)"   bash -c "cd frontend && ./node_modules/.bin/biome --version"
  assert_cmd "frontend lint:check exits 0"       bash -c "cd frontend && ./node_modules/.bin/biome check ."
  # Frontend tsc has pre-existing errors — tracked separately, not enforced in CI yet.
else
  nope "frontend biome not installed yet (skipping live exec)"
fi

assert_cmd "backend lint:check still exits 0"   bash -c "cd elysia-server && bun lint:check"
assert_cmd "backend type-check still exits 0"   bash -c "cd elysia-server && bun type-check"

# ── Summary ──────────────────────────────────────────────────────────
echo
echo "──────────────────────────────────────────"
printf "Passed: \033[32m%d\033[0m   Failed: \033[31m%d\033[0m\n" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed assertions:"
  for n in "${FAILED_NAMES[@]}"; do echo "  - $n"; done
  exit 1
fi
exit 0
