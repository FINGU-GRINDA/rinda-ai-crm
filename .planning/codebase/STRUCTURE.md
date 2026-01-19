# Codebase Structure

**Analysis Date:** 2026-01-18

## Directory Layout

```
rinda-ai-crm/
├── .claude/                    # Claude configuration
├── .planning/                  # Planning documents
│   └── codebase/              # Codebase analysis docs
├── elysia-server/             # Backend application
│   ├── drizzle/               # Database migrations
│   │   └── meta/              # Migration metadata
│   ├── scripts/               # Utility scripts
│   ├── src/                   # Source code
│   │   ├── db/               # Database layer
│   │   │   └── schema/       # Drizzle schema definitions
│   │   ├── middleware/       # Elysia middleware
│   │   ├── repositories/     # Data access layer
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic services
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions
│   └── tests/                # Backend tests
├── frontend/                  # Frontend application
│   ├── components/           # React components
│   │   ├── followup/        # Follow-up related components
│   │   ├── modals/          # Modal dialogs
│   │   └── settings/        # Settings components
│   │       └── tabs/        # Settings tab components
│   ├── contexts/            # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API and service integrations
│   ├── src/                 # Additional source
│   │   └── services/        # API client
│   └── styles/              # CSS styles
├── API_COMPATIBILITY_REPORT.md
├── metadata.json
└── README.md
```

## Directory Purposes

**elysia-server/src/db/**
- Purpose: Database connection and schema definitions
- Contains: Drizzle configuration, schema files, connection pooling
- Key files: `drizzle.ts` (connection), `schema.ts` (exports), `schema/*.ts` (table definitions)

**elysia-server/src/db/schema/**
- Purpose: Individual table schema definitions
- Contains: One file per entity (customers, contacts, meetings, etc.)
- Key files: `customers.ts`, `contacts.ts`, `meetings.ts`, `prospects.ts`, `followups.ts`, `emails.ts`, `oauth.ts`, `settings.ts`, `slack.ts`, `notifications.ts`, `icp.ts`, `mixpanel.ts`, `attachments.ts`

**elysia-server/src/middleware/**
- Purpose: Request processing middleware
- Contains: Error handling, logging, rate limiting, Slack verification
- Key files: `error-handler.ts`, `logger.ts`, `rate-limit.ts`, `slack-verify.ts`

**elysia-server/src/repositories/**
- Purpose: Data access layer with CRUD operations
- Contains: One repository per entity
- Key files: `customer.repository.ts`, `prospect.repository.ts`, `contact.repository.ts`, `meeting.repository.ts`, `followup.repository.ts`

**elysia-server/src/routes/**
- Purpose: API endpoint definitions
- Contains: Route modules grouped by domain
- Key files: `customer.routes.ts`, `prospect.routes.ts`, `ai.routes.ts`, `gmail.routes.ts`, `slack-event.routes.ts`, `calendar.routes.ts`

**elysia-server/src/services/**
- Purpose: Business logic and external integrations
- Contains: Service classes for AI and integrations
- Key files: `gemini.service.ts`, `gmail.service.ts`, `calendar.service.ts`, `slack-event.service.ts`, `slack-webhook.service.ts`, `mixpanel.service.ts`

**elysia-server/src/utils/**
- Purpose: Shared utility functions
- Contains: Logging, response formatting, ID generation, date helpers
- Key files: `logger.ts`, `response.ts`, `id-generator.ts`, `date.ts`

**frontend/components/**
- Purpose: React UI components
- Contains: Feature components, modals, settings panels
- Key files: `App.tsx` (main), `KanbanBoard.tsx`, `CustomerDetailPanel.tsx`, `ProposalGenerator.tsx`, `AIAssistant.tsx`

**frontend/services/**
- Purpose: Frontend service layer for API and business logic
- Contains: Service modules for various features
- Key files: `geminiService.ts`, `autoFollowUpService.ts`, `notificationService.ts`, `emailIntegrationService.ts`, `calendarIntegrationService.ts`

**frontend/src/services/**
- Purpose: Core API client
- Contains: Single API client module
- Key files: `apiClient.ts` (central HTTP client)

**frontend/contexts/**
- Purpose: React context providers for global state
- Contains: Context and provider components
- Key files: `BackgroundTaskContext.tsx`, `CustomerContext.tsx`

**frontend/hooks/**
- Purpose: Custom React hooks
- Contains: Reusable hook functions
- Key files: `useCustomers.ts`, `useMediaQuery.ts`

## Key File Locations

**Entry Points:**
- `elysia-server/src/index.ts`: Backend server entry
- `frontend/index.tsx`: Frontend app entry
- `frontend/App.tsx`: Main React component

**Configuration:**
- `elysia-server/src/config.ts`: Backend environment config with Zod validation
- `elysia-server/drizzle.config.ts`: Drizzle ORM configuration
- `elysia-server/biome.json`: Biome linter/formatter config
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/tailwind.config.js`: Tailwind CSS configuration
- `frontend/tsconfig.json`: Frontend TypeScript config
- `elysia-server/tsconfig.json`: Backend TypeScript config

**Core Logic:**
- `elysia-server/src/services/gemini.service.ts`: AI features implementation
- `elysia-server/src/repositories/customer.repository.ts`: Customer data operations
- `frontend/src/services/apiClient.ts`: Frontend HTTP client

**Testing:**
- `elysia-server/tests/`: Backend test files (currently minimal)

**Database:**
- `elysia-server/drizzle/`: Migration files
- `elysia-server/src/db/schema/*.ts`: Schema definitions

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `KanbanBoard.tsx`, `CustomerDetailPanel.tsx`)
- Services: camelCase with `.service.ts` suffix (e.g., `gemini.service.ts`)
- Repositories: camelCase with `.repository.ts` suffix (e.g., `customer.repository.ts`)
- Routes: camelCase with `.routes.ts` suffix (e.g., `customer.routes.ts`)
- Hooks: camelCase with `use` prefix (e.g., `useCustomers.ts`)
- Schema: camelCase matching entity name (e.g., `customers.ts`, `contacts.ts`)

**Directories:**
- Lowercase with hyphens for multi-word (e.g., `elysia-server`)
- Singular for feature-specific (e.g., `followup`, `settings`)
- Plural for collections (e.g., `components`, `services`, `hooks`)

**Exports:**
- Repositories export singleton objects (e.g., `export const customerRepository = {...}`)
- Services export singleton class instances (e.g., `export const geminiService = new GeminiService()`)
- Routes export Elysia instances (e.g., `export const customerRoutes = new Elysia({...})`)

## Where to Add New Code

**New API Endpoint:**
- Create route file: `elysia-server/src/routes/[feature].routes.ts`
- Add repository if needed: `elysia-server/src/repositories/[feature].repository.ts`
- Register in: `elysia-server/src/routes/index.ts`

**New Database Table:**
- Create schema: `elysia-server/src/db/schema/[entity].ts`
- Export from: `elysia-server/src/db/schema.ts`
- Run migration: `bun run db:push`

**New React Component:**
- Feature component: `frontend/components/[ComponentName].tsx`
- Modal: `frontend/components/modals/[ModalName].tsx`
- Settings tab: `frontend/components/settings/tabs/[TabName].tsx`

**New Frontend Service:**
- Service file: `frontend/services/[feature]Service.ts`
- API client method: Add to `frontend/src/services/apiClient.ts`

**New Backend Service:**
- Service file: `elysia-server/src/services/[feature].service.ts`
- Export singleton instance at bottom of file

**Utilities:**
- Backend: `elysia-server/src/utils/[utility].ts`
- Frontend: Consider adding `frontend/utils/` directory

**Custom Hooks:**
- Hook file: `frontend/hooks/use[Feature].ts`

## Special Directories

**elysia-server/drizzle/**
- Purpose: Database migration files and metadata
- Generated: Yes (by drizzle-kit)
- Committed: Yes

**elysia-server/node_modules/**
- Purpose: Backend dependencies
- Generated: Yes (by bun)
- Committed: No

**frontend/node_modules/**
- Purpose: Frontend dependencies
- Generated: Yes (by npm)
- Committed: No

**frontend/dist/**
- Purpose: Production build output
- Generated: Yes (by vite build)
- Committed: No

**.planning/**
- Purpose: Project planning and analysis documents
- Generated: No (created manually or by tools)
- Committed: Yes

---

*Structure analysis: 2026-01-18*
