# Technology Stack

**Analysis Date:** 2025-01-18

## Languages

**Primary:**
- TypeScript 5.7+ - Backend (Elysia server) and Frontend (React)

**Secondary:**
- JavaScript - Configuration files (tailwind.config.js, postcss.config.js)

## Runtime

**Backend:**
- Bun 1.3+ - Runtime and package manager for `elysia-server/`
- Node.js compatibility layer via Bun

**Frontend:**
- Browser (ES2022 target)
- Vite 6.2+ dev server on port 3000

**Package Manager:**
- Bun (backend) - `bun.lockb` lockfile
- npm/pnpm (frontend) - standard lockfile

## Frameworks

**Backend Core:**
- Elysia 1.2+ - Web framework (Bun-native, similar to Express)
  - `@elysiajs/cors` - CORS middleware
  - `@elysiajs/swagger` - Auto-generated API documentation at `/swagger`

**Frontend Core:**
- React 19.2+ - UI framework
- Vite 6.2+ - Build tool and dev server

**Database:**
- Drizzle ORM 0.38+ - TypeScript-first ORM
- Drizzle Kit 0.30+ - Schema migrations and studio

**Styling:**
- Tailwind CSS 4.1+ - Utility-first CSS
- PostCSS 8.5+ - CSS processing

## Key Dependencies

**Backend Critical:**
- `pg` 8.16+ - PostgreSQL client (node-postgres)
- `drizzle-orm` 0.38+ - Database ORM with schema inference
- `zod` 3.24+ - Runtime schema validation
- `pino` 10+ / `pino-pretty` 13+ - Structured logging

**AI/ML:**
- `@google/generative-ai` 0.21+ - Gemini AI SDK (gemini-2.0-flash model)

**External Integrations:**
- `@slack/web-api` 7.8+ - Slack Bot API
- `googleapis` 144+ - Google APIs (Gmail, Calendar)
- `dotenv` 17+ - Environment configuration

**Frontend Critical:**
- `react` 19.2+ / `react-dom` 19.2+ - UI library
- `lucide-react` 0.562+ - Icon library
- `react-markdown` 10.1+ - Markdown rendering

**Dev Dependencies:**
- `@biomejs/biome` 2.2+ - Linting and formatting (backend)
- `bun-types` 1.3+ - Bun type definitions
- `@vitejs/plugin-react` 5+ - React Vite plugin

## Configuration

**Environment Variables (Backend):**
Required in `elysia-server/.env`:
```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
DB_POOL_MIN=2
DB_POOL_MAX=10

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# AI (required for AI features)
GEMINI_API_KEY=your-key

# Slack Integration (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
CS_CHANNEL_ID=...
SALES_CHANNEL_ID=...

# Google OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gmail/oauth/callback

# Mixpanel (optional)
MIXPANEL_PROJECT_ID=...
MIXPANEL_PROJECT_SECRET=...
```

**Environment Variables (Frontend):**
Optional in `frontend/.env`:
```
VITE_API_URL=http://localhost:3001
```

**Build Configuration:**
- `elysia-server/tsconfig.json` - ESNext target, Bun types, bundler resolution
- `frontend/tsconfig.json` - ES2022 target, DOM libs, experimental decorators
- `elysia-server/drizzle.config.ts` - Drizzle schema location and DB credentials
- `frontend/vite.config.ts` - Dev server with API proxy to backend
- `elysia-server/biome.json` - Linting rules (double quotes, trailing commas)

## Platform Requirements

**Development:**
- Bun 1.0+ installed globally
- Node.js 18+ (for frontend tooling)
- PostgreSQL 16+ (or Docker)
- Optional: Docker for local PostgreSQL (`compose.db.yml`)

**Database Setup:**
```bash
# Using Docker
cd elysia-server
bun run docker:db-up

# Or connect to existing PostgreSQL
# Edit .env with DATABASE_URL
```

**Production:**
- Bun runtime for backend
- Static hosting for frontend (Vite build output)
- PostgreSQL 16+ database
- Environment variables configured

## Scripts

**Backend (`elysia-server/`):**
```bash
bun run dev          # Start with hot reload
bun run start        # Production start
bun run db:generate  # Generate migrations
bun run db:push      # Push schema to DB
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
bun run lint         # Run Biome linter
bun run type-check   # TypeScript check
```

**Frontend (`frontend/`):**
```bash
bun run dev      # Start Vite dev server (port 3000)
bun run build    # Production build
bun run preview  # Preview production build
```

---

*Stack analysis: 2025-01-18*
