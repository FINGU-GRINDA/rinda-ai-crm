# Testing Patterns

**Analysis Date:** 2026-01-18

## Test Framework

**Runner:**
- **Not configured** - No test framework is currently set up in this project
- Config: None present (`jest.config.*`, `vitest.config.*` not found)

**Potential Frameworks (Bun-compatible):**
- Bun's built-in test runner (`bun test`)
- Vitest (recommended for Vite frontend)

**Assertion Library:**
- Not configured

**Run Commands:**
```bash
# No test commands currently defined in package.json
# Recommended additions:
bun test                    # Run backend tests with Bun
bun run test:watch          # Watch mode
bun run test:coverage       # Coverage
```

## Test File Organization

**Location:**
- **No test files exist** in the project source directories
- Node_modules contain test files from dependencies only

**Recommended Pattern (co-located):**
```
elysia-server/src/
├── repositories/
│   ├── customer.repository.ts
│   └── customer.repository.test.ts    # Co-located test
├── services/
│   ├── gemini.service.ts
│   └── gemini.service.test.ts
└── routes/
    ├── customer.routes.ts
    └── customer.routes.test.ts
```

**Alternative Pattern (separate directory):**
```
elysia-server/
├── src/
│   └── ...
└── tests/
    ├── unit/
    │   ├── repositories/
    │   └── services/
    ├── integration/
    │   └── routes/
    └── fixtures/
```

## Test Structure

**Recommended Suite Organization (Bun test):**
```typescript
import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test"
import { customerRepository } from "../repositories/customer.repository"

describe("CustomerRepository", () => {
  describe("findAll", () => {
    test("returns customers with default pagination", async () => {
      const result = await customerRepository.findAll()

      expect(result.data).toBeArray()
      expect(result.count).toBeNumber()
    })

    test("filters by status when provided", async () => {
      const result = await customerRepository.findAll({ status: "new" })

      expect(result.data.every(c => c.status === "new")).toBe(true)
    })
  })

  describe("findById", () => {
    test("returns customer when exists", async () => {
      const customer = await customerRepository.findById("valid-id")

      expect(customer).not.toBeNull()
      expect(customer?.id).toBe("valid-id")
    })

    test("returns null when not found", async () => {
      const customer = await customerRepository.findById("non-existent")

      expect(customer).toBeNull()
    })
  })
})
```

**Patterns:**
- Setup/Teardown: Use `beforeAll`/`afterAll` for database setup, `beforeEach`/`afterEach` for test isolation
- Assertion: Use `expect()` with specific matchers
- Test naming: Describe behavior, not implementation

## Mocking

**Framework:** Bun's built-in `mock()` function

**Patterns:**
```typescript
import { mock } from "bun:test"

// Mock a module
mock.module("../services/gemini.service", () => ({
  geminiService: {
    isAvailable: () => true,
    generateContent: async (prompt: string) => "mocked response",
  },
}))

// Mock a function
const mockFetch = mock(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ data: "test" }),
}))

// Spy on existing function
const spy = mock(customerRepository.findById)
```

**What to Mock:**
- External API calls (Gemini, Slack, Gmail APIs)
- Database connections for unit tests
- Time-dependent operations (`Date.now()`)
- Random generators for deterministic tests

**What NOT to Mock:**
- Business logic under test
- Drizzle ORM in integration tests (use test database)
- Request/response validation

## Fixtures and Factories

**Recommended Test Data Pattern:**
```typescript
// tests/fixtures/customers.ts
export const createTestCustomer = (overrides: Partial<NewCustomer> = {}): NewCustomer => ({
  id: "test-customer-1",
  name: "Test Company",
  website: "https://test.com",
  industry: "Technology",
  status: "new",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
})

export const testCustomers = {
  prospect: createTestCustomer({ status: "prospect", name: "Prospect Co" }),
  active: createTestCustomer({ status: "contact", name: "Active Co" }),
  won: createTestCustomer({ status: "won", name: "Won Co" }),
}
```

**Location:**
- Recommended: `elysia-server/tests/fixtures/`
- Alternative: `elysia-server/src/__fixtures__/`

## Coverage

**Requirements:** None enforced currently

**Recommended Setup:**
```bash
# Add to package.json scripts
"test:coverage": "bun test --coverage"
```

**View Coverage:**
```bash
bun test --coverage
# Opens coverage report in terminal
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, repository methods, service methods
- Approach: Mock all external dependencies
- Location: Co-located with source files
- Example targets:
  - `customerRepository.findAll()` - test query building
  - `geminiService.generateJSON()` - test JSON parsing
  - `generateId()` - test ID format

**Integration Tests:**
- Scope: Route handlers with real database
- Approach: Use test database, seed data, test full request/response cycle
- Location: `tests/integration/`
- Example targets:
  - `POST /api/customers` - test customer creation flow
  - `GET /api/customers/:id` - test retrieval with relationships
  - Webhook handlers (Slack, Gmail)

**E2E Tests:**
- Framework: **Not used**
- Potential tools: Playwright (for frontend), Supertest (for API)

## Common Patterns

**Async Testing:**
```typescript
import { test, expect } from "bun:test"

test("handles async operations", async () => {
  const result = await customerRepository.findAll()

  expect(result.data).toHaveLength(expect.any(Number))
})
```

**Error Testing:**
```typescript
test("throws on invalid input", () => {
  expect(() => {
    validateConfig({ PORT: "invalid" })
  }).toThrow("Invalid environment variables")
})

test("returns error response for missing customer", async () => {
  const response = await app
    .handle(new Request("http://localhost/api/customers/non-existent"))
    .then(r => r.json())

  expect(response.success).toBe(false)
  expect(response.code).toBe("CUSTOMER_NOT_FOUND")
})
```

**Database Testing (Integration):**
```typescript
import { beforeAll, afterAll, describe, test } from "bun:test"
import { db } from "../src/db"
import { customers } from "../src/db/schema"

describe("Customer Integration", () => {
  beforeAll(async () => {
    // Setup: Use test database connection
    // Could use testcontainers or docker-compose for isolated DB
  })

  afterAll(async () => {
    // Cleanup: Remove test data
    await db.delete(customers).where(/* test data condition */)
  })

  test("creates and retrieves customer", async () => {
    // Test with real database
  })
})
```

**Elysia Route Testing:**
```typescript
import { describe, test, expect } from "bun:test"
import { Elysia } from "elysia"
import { customerRoutes } from "../src/routes/customer.routes"

describe("Customer Routes", () => {
  const app = new Elysia().use(customerRoutes)

  test("GET /api/customers returns list", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/customers")
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeArray()
  })

  test("POST /api/customers creates customer", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Company" }),
      })
    )

    expect(response.status).toBe(201)
  })
})
```

## Recommended Test Setup

**1. Install Test Dependencies:**
```bash
# No additional packages needed for Bun's built-in test runner
# For coverage visualization:
bun add -d @vitest/coverage-v8  # Optional
```

**2. Add package.json Scripts:**
```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

**3. Create Test Database Config:**
```typescript
// src/config.test.ts
export const testConfig = {
  DATABASE_URL: process.env.TEST_DATABASE_URL || "postgres://...",
}
```

**4. Create Test Setup File:**
```typescript
// tests/setup.ts
import { beforeAll, afterAll } from "bun:test"
import { db } from "../src/db"

beforeAll(async () => {
  // Run migrations on test database
  // Seed initial test data
})

afterAll(async () => {
  // Cleanup
})
```

## Current Test Coverage Gaps

**Critical areas without tests:**
1. All repository methods (`customer.repository.ts`, etc.)
2. All route handlers (`customer.routes.ts`, etc.)
3. Service integrations (`gemini.service.ts`, `slack-*.service.ts`)
4. Middleware (`error-handler.ts`, `slack-verify.ts`)
5. Utility functions (`response.ts`, `id-generator.ts`)

**Priority for testing:**
1. **High**: Repository CRUD operations - core data access
2. **High**: API route handlers - user-facing functionality
3. **Medium**: Service integrations - external dependencies
4. **Medium**: Error handling middleware
5. **Low**: Utility functions (simple, less likely to break)

---

*Testing analysis: 2026-01-18*
