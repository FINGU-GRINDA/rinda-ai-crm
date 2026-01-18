# Architecture

**Analysis Date:** 2026-01-18

## Pattern Overview

**Overall:** Monorepo with separate frontend/backend applications using a layered service architecture

**Key Characteristics:**
- Full-stack TypeScript application (React frontend + Elysia/Bun backend)
- Repository pattern for database access with Drizzle ORM
- Service layer for business logic and external integrations
- RESTful API with consistent response format
- AI-powered features via Google Gemini integration

## Layers

**Presentation Layer (Frontend):**
- Purpose: User interface for CRM interactions
- Location: `frontend/`
- Contains: React components, services, hooks, contexts
- Depends on: Backend API via `apiClient`
- Used by: End users via browser

**Routes Layer:**
- Purpose: HTTP request handling and validation
- Location: `elysia-server/src/routes/`
- Contains: Elysia route definitions with schema validation
- Depends on: Repositories, Services
- Used by: Frontend API client

**Service Layer:**
- Purpose: Business logic, external API integrations, AI features
- Location: `elysia-server/src/services/`
- Contains: Gemini AI, Slack, Gmail, Calendar, Mixpanel services
- Depends on: Repositories, External APIs
- Used by: Routes

**Repository Layer:**
- Purpose: Data access abstraction for PostgreSQL
- Location: `elysia-server/src/repositories/`
- Contains: CRUD operations, queries, data transformations
- Depends on: Drizzle ORM, Database schema
- Used by: Routes, Services

**Database Layer:**
- Purpose: Schema definitions and database connection
- Location: `elysia-server/src/db/`
- Contains: Drizzle schema, connection pooling
- Depends on: PostgreSQL
- Used by: Repositories

## Data Flow

**API Request Flow:**

1. Frontend component calls `apiClient.method()` in `frontend/src/services/apiClient.ts`
2. HTTP request reaches Elysia server at `elysia-server/src/index.ts`
3. Middleware processes request (CORS, logging, error handling)
4. Route handler validates input using Elysia's `t.Object()` schema
5. Repository performs database operations via Drizzle ORM
6. Response wrapped with `success()` or `error()` utilities
7. Frontend receives standardized JSON response

**Customer Enrichment Flow:**

1. User clicks enrich button on `CustomerDetailPanel`
2. `App.tsx` calls `enrichCustomerData()` from `frontend/services/geminiService.ts`
3. Request goes to `/api/ai/enrich` endpoint
4. `geminiService.enrichCompany()` queries Gemini API
5. Enrichment data saved via `customerRepository.saveEnrichment()`
6. Customer state updated in frontend

**Slack Message Processing Flow:**

1. Slack sends event to `/api/slack/events` webhook
2. `slack-verify.ts` middleware validates Slack signature
3. `slackEventService.processEvent()` handles message
4. `geminiService.parseCustomerInquiry()` extracts intent
5. New prospect created or existing customer updated
6. Notification created if needed

**State Management:**
- Frontend uses React useState/useEffect hooks
- No external state library (Redux/Zustand)
- API client singleton manages HTTP communication
- Context providers for background tasks and customers

## Key Abstractions

**Customer Entity:**
- Purpose: Core CRM entity representing a business customer
- Examples: `elysia-server/src/db/schema/customers.ts`, `frontend/types.ts`
- Pattern: Status-based pipeline (prospect -> new -> contact -> negotiation -> won/lost)

**Repository Pattern:**
- Purpose: Encapsulate database operations
- Examples: `elysia-server/src/repositories/customer.repository.ts`
- Pattern: Each entity has a dedicated repository with standard CRUD + custom queries

**Service Pattern:**
- Purpose: Encapsulate business logic and external integrations
- Examples: `elysia-server/src/services/gemini.service.ts`, `elysia-server/src/services/slack-event.service.ts`
- Pattern: Singleton services with lazy initialization

**API Response Wrapper:**
- Purpose: Consistent API response format
- Examples: `elysia-server/src/utils/response.ts`
- Pattern: `{ success: true, data: T }` or `{ success: false, error: string, code?: string }`

## Entry Points

**Backend Server:**
- Location: `elysia-server/src/index.ts`
- Triggers: `bun run dev` or `bun run start`
- Responsibilities: Initialize database connection, configure middleware, mount routes, start HTTP server

**Frontend Application:**
- Location: `frontend/index.tsx`
- Triggers: `npm run dev` (Vite)
- Responsibilities: Mount React app to DOM, wrap with ErrorBoundary

**Main Application Component:**
- Location: `frontend/App.tsx`
- Triggers: React render
- Responsibilities: State management, data fetching, component orchestration, event handling

**Route Index:**
- Location: `elysia-server/src/routes/index.ts`
- Triggers: Server startup
- Responsibilities: Aggregate and mount all route modules

## Error Handling

**Strategy:** Centralized error handling middleware with typed error codes

**Patterns:**
- Backend uses `elysia-server/src/middleware/error-handler.ts` for global error handling
- Error codes defined in `elysia-server/src/utils/response.ts` (ErrorCode enum)
- Frontend wraps app in `ErrorBoundary` component
- API client catches errors and logs to console
- Toast notifications display user-friendly error messages

**Error Response Format:**
```typescript
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE"
}
```

## Cross-Cutting Concerns

**Logging:**
- Backend: Pino logger (`elysia-server/src/utils/logger.ts`)
- Frontend: Console logging
- Request logging via `elysia-server/src/middleware/logger.ts`

**Validation:**
- Backend: Elysia's built-in validation using `t.Object()` schemas
- Frontend: Form validation in components
- Config validation using Zod in `elysia-server/src/config.ts`

**Authentication:**
- Slack webhook verification via `elysia-server/src/middleware/slack-verify.ts`
- Google OAuth for Gmail/Calendar (`elysia-server/src/repositories/oauth.repository.ts`)
- No user authentication system (single-tenant application)

**CORS:**
- Configured in `elysia-server/src/index.ts` using `@elysiajs/cors`
- Allows specific frontend URL with credentials

---

*Architecture analysis: 2026-01-18*
