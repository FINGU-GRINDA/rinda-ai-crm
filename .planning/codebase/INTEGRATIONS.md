# External Integrations

**Analysis Date:** 2025-01-18

## APIs & External Services

**Google Gemini AI:**
- Purpose: AI-powered CRM features (customer analysis, proposal generation, meeting summarization)
- SDK: `@google/generative-ai`
- Model: `gemini-2.0-flash`
- Auth: `GEMINI_API_KEY` env var
- Service: `elysia-server/src/services/gemini.service.ts`
- Features:
  - Customer data enrichment (`enrichCompany`)
  - Meeting transcription summarization (`summarizeMeeting`)
  - Proposal generation (`generateProposal`)
  - Follow-up strategy generation (`generateFollowUpStrategy`)
  - Intent parsing for AI assistant (`parseUserIntent`)
  - Risk signal detection (`detectRiskSignals`)

**Slack:**
- Purpose: Team notifications, customer inquiry monitoring
- SDK: `@slack/web-api`
- Auth:
  - `SLACK_BOT_TOKEN` - Bot OAuth token
  - `SLACK_SIGNING_SECRET` - Event API signature verification
  - `CS_CHANNEL_ID`, `SALES_CHANNEL_ID`, `MEETING_NOTES_CHANNEL_ID` - Channel IDs
- Services:
  - `elysia-server/src/services/slack-api.service.ts` - API client wrapper
  - `elysia-server/src/services/slack-event.service.ts` - Event processing
  - `elysia-server/src/services/slack-webhook.service.ts` - Outgoing webhooks
- Routes: `elysia-server/src/routes/slack-event.routes.ts`, `elysia-server/src/routes/slack-api.routes.ts`
- Features:
  - Channel message monitoring
  - Customer inquiry detection (AI-parsed)
  - Notification webhooks
  - Message threading

**Google Gmail:**
- Purpose: Email sync and sending for customer communication
- SDK: `googleapis` (Gmail API v1)
- Auth: OAuth 2.0
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- Scopes: `gmail.readonly`, `gmail.send`
- Service: `elysia-server/src/services/gmail.service.ts`
- Routes: `elysia-server/src/routes/gmail.routes.ts`
- Features:
  - OAuth flow (`/api/gmail/oauth/authorize`, `/api/gmail/oauth/callback`)
  - Email sync to database
  - Send emails on behalf of user

**Google Calendar:**
- Purpose: Meeting scheduling and calendar integration
- SDK: `googleapis` (Calendar API v3)
- Auth: OAuth 2.0 (shared credentials with Gmail)
- Scopes: `calendar.readonly`, `calendar.events`
- Service: `elysia-server/src/services/calendar.service.ts`
- Routes: `elysia-server/src/routes/calendar.routes.ts`
- Features:
  - OAuth flow
  - Fetch upcoming events
  - Create calendar events
  - Meeting preparation integration

**Mixpanel:**
- Purpose: Product analytics data ingestion
- SDK: Direct HTTP API (no SDK)
- Auth:
  - `MIXPANEL_PROJECT_ID`
  - `MIXPANEL_PROJECT_SECRET` (Basic auth)
- Endpoint: `https://data.mixpanel.com/api/2.0/export`
- Service: `elysia-server/src/services/mixpanel.service.ts`
- Routes: `elysia-server/src/routes/mixpanel.routes.ts`
- Features:
  - Event export and sync
  - Event processing pipeline

## Data Storage

**Primary Database:**
- PostgreSQL 16+ (Alpine image for Docker)
- Connection: `DATABASE_URL` or individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Client: `pg` (node-postgres)
- ORM: Drizzle ORM
- Schema location: `elysia-server/src/db/schema/`
- Connection pool: min 2, max 10 connections

**Database Tables:**
- `customers` - Core customer records with status tracking
- `customer_enrichments` - AI-generated company data
- `proposals` - Generated sales proposals
- `contacts` - Customer contact persons
- `meetings` - Meeting records with AI summaries
- `follow_ups` - Scheduled follow-up actions
- `prospects` - Lead/prospect pipeline
- `notifications` - System notifications
- `oauth_tokens` - Google OAuth tokens
- `slack_messages` - Synced Slack messages
- `emails` - Synced Gmail messages
- `mixpanel_events` - Synced Mixpanel events
- `settings` - Application settings (JSON blob)
- `icp_profiles` - Ideal Customer Profile definitions
- `attachments` - Universal file attachments

**File Storage:**
- Local filesystem only (no cloud storage)
- Proposal images stored as URLs (external)

**Caching:**
- None (no Redis/Memcached)

## Authentication & Identity

**Application Auth:**
- None (no user authentication system)
- Single-tenant design

**OAuth Providers:**
- Google OAuth 2.0 for Gmail and Calendar
- Tokens stored in `oauth_tokens` table
- Auto-refresh on token expiry

## Monitoring & Observability

**Logging:**
- Pino 10+ with structured JSON logging
- Pretty printing in development
- Log levels: trace, debug, info, warn, error, fatal
- Sensitive data redaction configured
- Service: `elysia-server/src/utils/logger.ts`
- Specialized loggers: `operationLogger`, `batchLogger`, `webhookLogger`, `emailWorkerLogger`

**Error Tracking:**
- None (no Sentry/Bugsnag)

**Metrics:**
- None (no Prometheus/DataDog)

## CI/CD & Deployment

**Containerization:**
- Docker Compose for local PostgreSQL: `elysia-server/compose.db.yml`
- No production Dockerfile present

**CI Pipeline:**
- None detected

**Hosting:**
- Not configured (development only)

## Environment Configuration

**Required env vars for full functionality:**
```
DATABASE_URL              # PostgreSQL connection
GEMINI_API_KEY           # AI features
```

**Optional env vars:**
```
# Slack
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET
CS_CHANNEL_ID
SALES_CHANNEL_ID
MEETING_NOTES_CHANNEL_ID

# Google OAuth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI

# Mixpanel
MIXPANEL_PROJECT_ID
MIXPANEL_PROJECT_SECRET

# Server
PORT                     # Default: 3001
FRONTEND_URL             # Default: http://localhost:3000
LOGGING_LEVEL            # Default: debug (dev), info (prod)
```

**Secrets location:**
- `.env` files (gitignored)
- `.env.example` provided for reference

## Webhooks & Callbacks

**Incoming:**
- `POST /api/slack/events` - Slack Event API endpoint
  - Handles URL verification challenge
  - Processes message events asynchronously
  - Signature verification via HMAC-SHA256

**Outgoing:**
- Slack Incoming Webhooks for notifications
  - Configurable webhook URL in settings
  - Test endpoint available

**OAuth Callbacks:**
- `GET /api/gmail/oauth/callback` - Gmail OAuth callback
- `GET /api/calendar/oauth/callback` - Calendar OAuth callback

## API Documentation

**Swagger UI:**
- Available at `/swagger`
- Auto-generated from Elysia routes
- Tags: Customers, Prospects, Contacts, Meetings, Notifications, Settings, AI, Slack, Gmail, Calendar, Mixpanel

## Frontend-Backend Communication

**API Client:**
- Location: `frontend/src/services/apiClient.ts`
- Base URL: `VITE_API_URL` or `http://localhost:3001`
- Vite proxy configured for `/api/*` routes in development

**Response Format:**
```typescript
// Success
{ success: true, data: T }

// List
{ success: true, data: T[], total?: number }

// Error
{ success: false, error: string, code: string }
```

---

*Integration audit: 2025-01-18*
