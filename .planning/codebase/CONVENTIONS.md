# Coding Conventions

**Analysis Date:** 2026-01-18

## Naming Patterns

**Files:**
- Backend: `kebab-case.ts` (e.g., `customer.repository.ts`, `ai.routes.ts`, `error-handler.ts`)
- Schema files: `kebab-case.ts` in `src/db/schema/` directory
- Services: `kebab-case.service.ts` (e.g., `gemini.service.ts`, `slack-api.service.ts`)
- Middleware: `kebab-case.ts` in `src/middleware/` directory
- Frontend: `camelCase.ts` (e.g., `apiClient.ts`)

**Functions:**
- camelCase for all functions: `findById`, `createCustomer`, `generateFollowUpStrategy`
- Repository methods: verb + noun pattern (`findAll`, `findById`, `create`, `update`, `delete`)
- Boolean functions: `is` prefix (`isAvailable`, `isDevelopment`)
- Async functions: no special naming, use `async/await`

**Variables:**
- camelCase: `customerRepository`, `geminiService`, `searchPattern`
- Constants: SCREAMING_SNAKE_CASE for config values (`DATABASE_URL`, `GEMINI_API_KEY`)
- Private class fields: no prefix, camelCase (`private client`, `private initialized`)

**Types:**
- PascalCase for types and interfaces: `Customer`, `NewCustomer`, `CustomerQueryOptions`
- Drizzle inferred types: `typeof table.$inferSelect`, `typeof table.$inferInsert`
- Enum values: PascalCase or snake_case based on database requirements

## Code Style

**Formatting (Biome):**
- Tool: `@biomejs/biome` v2.2.4 - configured in `elysia-server/biome.json`
- Indent: 2 spaces
- Line width: 100 characters
- Line ending: LF
- Semicolons: as needed (omit when possible)
- Quotes: double quotes for strings and JSX
- Trailing commas: all

**Linting (Biome):**
- Rule set: recommended + custom rules
- `noUnusedVariables`: error
- `noUnusedImports`: error
- `useConst`: error
- `useTemplate`: error (use template literals)
- `noExplicitAny`: warn (allowed but discouraged)
- `noNonNullAssertion`: warn

**Run Commands:**
```bash
# Check linting
bun run lint:check

# Fix linting issues
bun run lint

# Check formatting
bun run format:check

# Fix formatting
bun run format
```

## Import Organization

**Order (Backend):**
1. Node.js built-ins: `import crypto from "node:crypto"`
2. External packages: `import { Elysia, t } from "elysia"`
3. Internal absolute imports: `import { config } from "../config"`
4. Relative imports within same module

**Path Aliases:**
- Frontend: `@/` alias maps to project root (`@/src/services/apiClient`)
- Backend: No path aliases, uses relative imports

**Example Pattern:**
```typescript
// Node built-ins
import crypto from "node:crypto"

// External dependencies
import { Elysia, t } from "elysia"
import { eq, and, desc } from "drizzle-orm"

// Internal config/utils
import { config } from "../config"
import { logger } from "../utils/logger"

// Internal modules
import { customerRepository } from "../repositories"
import { geminiService } from "../services/gemini.service"
```

## Error Handling

**Patterns:**

1. **Route-level error handling via middleware:**
   ```typescript
   // src/middleware/error-handler.ts
   export const errorHandler = new Elysia().onError(({ code, error, set }) => {
     switch (code) {
       case "NOT_FOUND":
         set.status = 404
         return { error: "Not found", code }
       case "VALIDATION":
         set.status = 400
         return { error: "Validation error", details: errorMessage, code }
       default:
         set.status = 500
         return { error: errorMessage || "Unknown error", code }
     }
   })
   ```

2. **Standardized API responses:**
   ```typescript
   // Success responses
   return success(data)                    // { success: true, data: T }
   return successList(data, count)         // { success: true, data: T[], count: number }

   // Error responses
   return error("Message", ErrorCode.XXX)  // { success: false, error: string, code?: string }
   ```

3. **Repository error handling - return null for not found:**
   ```typescript
   const result = await db.select().from(customers).where(eq(customers.id, id))
   return result[0] || null
   ```

4. **Service error handling - return null on failure:**
   ```typescript
   try {
     const result = await this.model.generateContent(prompt)
     return response.text()
   } catch (error) {
     logger.error({ error: errorMsg }, "Error generating content")
     return null
   }
   ```

5. **Use predefined error codes:**
   ```typescript
   // src/utils/response.ts
   export const ErrorCode = {
     NOT_FOUND: "NOT_FOUND",
     CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
     SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
     // ... etc
   } as const
   ```

## Logging

**Framework:** Pino (`pino` v10.0.0 with `pino-pretty` for development)

**Configuration:** `src/utils/logger.ts`

**Patterns:**

1. **Basic logging:**
   ```typescript
   import { logger } from "../utils/logger"

   logger.info("Message")
   logger.error({ error: errorMsg }, "Error context")
   logger.warn("Warning message")
   logger.debug({ data }, "Debug info")
   ```

2. **Operation logging (start/end with timing):**
   ```typescript
   const op = operationLogger.start({
     component: "email-worker",
     operation: "send_batch",
     traceId: executionId,
     metadata: { batchSize: 50 }
   })

   // ... do work ...

   op.success({ itemsProcessed: 48, itemsFailed: 2 })
   // or
   op.failure("Connection timeout")
   ```

3. **Batch operation logging:**
   ```typescript
   const batch = batchLogger.start({
     component: "lead-enrichment",
     operation: "enrich_batch",
     totalItems: 50
   })

   for (const item of items) {
     try {
       await process(item)
       batch.recordSuccess()
     } catch (e) {
       batch.recordFailure(e.message)
     }
   }

   batch.complete()  // Logs summary only
   ```

4. **Sensitive data redaction (automatic):**
   - `password`, `apiKey`, `token`, `accessToken`, `refreshToken`
   - `authorization` headers
   - Email content (`html`, `htmlBody`, `textBody`)

## Comments

**When to Comment:**
- JSDoc for exported functions/classes
- Complex business logic explanation
- Configuration rationale
- Korean comments allowed for Korean-specific business logic

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * Generate a unique ID
 * Format: timestamp_randomString
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
```

**Block comments for major sections:**
```typescript
// ============================================================================
// CORE LOGGER SETUP
// ============================================================================
```

## Function Design

**Size:** Functions should be focused on single responsibility. Complex operations broken into smaller helpers.

**Parameters:**
- Use object destructuring for multiple parameters
- Optional parameters with defaults: `limit = 100`, `offset = 0`
- Type parameters explicitly with interfaces

**Return Values:**
- Repositories return `T | null` for single items, `{ data: T[], count: number }` for lists
- Services return `T | null` (null on failure)
- Routes return standardized response objects via `success()`, `error()`, `successList()`

**Example Pattern:**
```typescript
export interface CustomerQueryOptions {
  status?: string
  industry?: string
  search?: string
  limit?: number
  offset?: number
}

findAll: async (options: CustomerQueryOptions = {}): Promise<{ data: Customer[]; count: number }> => {
  const { status, industry, search, limit = 100, offset = 0 } = options
  // ... implementation
}
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- One export object per repository/service module
- Barrel files (`index.ts`) for directory exports

**Barrel Files:**
```typescript
// src/repositories/index.ts
export { contactRepository } from "./contact.repository"
export { customerRepository } from "./customer.repository"
// ...

// src/db/schema.ts
export * from "./schema/attachments"
export * from "./schema/contacts"
// ...
```

**Service Pattern (Singleton):**
```typescript
class GeminiService {
  private client: GoogleGenerativeAI | null = null
  private initialized = false

  private initialize() { /* ... */ }

  isAvailable(): boolean { /* ... */ }

  async generateContent(prompt: string): Promise<string | null> { /* ... */ }
}

export const geminiService = new GeminiService()
```

**Repository Pattern (Object with methods):**
```typescript
export const customerRepository = {
  findAll: async (options) => { /* ... */ },
  findById: async (id) => { /* ... */ },
  create: async (data) => { /* ... */ },
  update: async (id, data) => { /* ... */ },
  delete: async (id) => { /* ... */ },
}
```

## Database Conventions

**Schema Definition:**
```typescript
export const customers = pgTable(
  "customers",  // table name: snake_case, plural
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_customers_status").on(table.status),  // index name: idx_tablename_column
  ],
)

// Type exports at end of schema file
export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
```

**Column naming:**
- Database columns: snake_case (`created_at`, `customer_id`)
- TypeScript fields: camelCase (`createdAt`, `customerId`) - Drizzle handles mapping

## API Route Conventions

**Route Definition:**
```typescript
export const customerRoutes = new Elysia({ prefix: "/api/customers" })
  .get("/", async ({ query }) => { /* list */ })
  .get("/:id", async ({ params }) => { /* get one */ })
  .post("/", async ({ body, set }) => { /* create */ })
  .put("/:id", async ({ params, body }) => { /* update */ })
  .delete("/:id", async ({ params }) => { /* delete */ })
```

**Validation with Elysia's `t` (TypeBox):**
```typescript
.post(
  "/",
  async ({ body, set }) => { /* ... */ },
  {
    body: t.Object({
      name: t.String(),
      website: t.Optional(t.String()),
      status: t.Optional(t.Union([
        t.Literal("prospect"),
        t.Literal("new"),
        // ...
      ])),
    }),
  },
)
```

## Configuration Pattern

**Zod schema for env validation:**
```typescript
const configSchema = z.object({
  DATABASE_URL: z.string().default("postgres://..."),
  PORT: z.coerce.number().default(3001),
  GEMINI_API_KEY: z.string().optional(),
})

export const config = loadConfig()
```

---

*Convention analysis: 2026-01-18*
