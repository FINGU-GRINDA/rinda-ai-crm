---
description: Scaffold a new Elysia route and register it
argument-hint: [route name, e.g. "invoice"]
allowed-tools: Read(./elysia-server/src/routes/**), Write(./elysia-server/src/routes/*.routes.ts), Edit(./elysia-server/src/routes/index.ts), Bash(cd elysia-server && bun lint), Bash(cd elysia-server && bun type-check)
---

Scaffold a new Elysia route module named `$ARGUMENTS`.

## Steps

1. Read `elysia-server/src/routes/customer.routes.ts` as a template.
2. Create `elysia-server/src/routes/$ARGUMENTS.routes.ts` with:
   - `export const ${camelCase}Routes = new Elysia({ prefix: "/${kebab}" })`
   - At minimum, a `GET /` handler with proper response typing.
   - Zod or Elysia `t.*` schemas for body + response.
   - DB access via a (possibly new) `repositories/${camelCase}.repository.ts` —
     **not** raw `db` import.
3. Ask the user: **public or protected?**
   - Public → register **above** `authMiddleware` in `routes/index.ts`.
   - Protected → register **below**.
4. Add the import + `.use(${camelCase}Routes)` in
   `elysia-server/src/routes/index.ts`.
5. Run the **`route-auditor`** sub-agent on the new file + the updated
   `index.ts` to verify the registration is correct.
6. Run `bun lint` + `bun type-check`. Fix anything that surfaces.
7. Report the path, the registered prefix, and one example `curl`.

Don't add tests (no test runner). Don't run migrations.
