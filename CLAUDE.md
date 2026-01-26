# Project Instructions for Claude

## Frontend Code Quality

After **any modification** to files in `frontend/`, you MUST:

### Run Build
```bash
# Windows
cd frontend; npm run build;

# macOS/Linux
cd frontend && npm run build
```
Fix ALL build errors before proceeding.

---

## Elysia Server Code Quality

After **any modification** to files in `elysia-server/`, you MUST:

### 1. Run Linting
```bash
# Windows
cd elysia-server; bun lint;

# macOS/Linux
cd elysia-server && bun lint
```
Fix ALL errors and warnings before proceeding.

### 2. Run Type Checking
```bash
# Windows
cd elysia-server; bun type-check;

# macOS/Linux
cd elysia-server && bun type-check
```
Fix ALL type errors before proceeding.

## Type Safety Rules

- **NEVER use `any` type** - All types must be fully typed
- Use proper TypeScript types, interfaces, and generics
- If Elysia or library types are complex, create proper type definitions instead of using `any`
- Prefer `unknown` with type guards over `any` when type is truly unknown

## Database Migration Rules

**CRITICAL:**
- **NEVER run `db:migrate` automatically** - Migrations can cause data loss
- **NEVER run `db:push` automatically** - This modifies the database schema directly
- **NEVER manually create migration files** - This unsyncs the migrations between hosted db and local db if accidentally pushed
- You MAY ask for permission to run `db:generate` to create migration files
- Always wait for explicit user approval before any database schema changes
- When schema changes are needed, explain what will change and ask the user to run migrations manually
