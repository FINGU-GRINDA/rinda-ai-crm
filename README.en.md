# RINDA CRM

AI-powered smart sales management platform — customer analysis, automated proposal generation, and a kanban-board CRM tailored for Korean sales teams.

> Korean documentation: [`README.md`](./README.md)
> Contributing guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

---

## Stack

| Layer        | Tech                                             |
| ------------ | ------------------------------------------------ |
| Frontend     | React 19, TypeScript, Vite 6, Tailwind CSS 4     |
| Backend      | Bun, Elysia, TypeScript                          |
| Database     | PostgreSQL 18 (Drizzle ORM)                      |
| AI           | Google Gemini                                    |
| Integrations | Slack, Gmail, Google Calendar, Mixpanel          |
| Deployment   | Docker / Dokploy                                 |

## Repository layout

```
.
├── elysia-server/          # Bun + Elysia API server (port 3001)
│   ├── src/                # Application source
│   ├── drizzle/            # SQL migrations + journal
│   ├── scripts/            # One-off ops scripts
│   ├── compose.db.yml      # Local Postgres for dev
│   ├── Dockerfile          # Production image (Dokploy)
│   └── .env.example
├── frontend/               # React + Vite SPA (port 3000)
│   ├── src/                # Application source
│   ├── components/         # UI components
│   ├── nginx.conf.template # Runtime nginx config (production)
│   ├── Dockerfile          # Production image (Dokploy)
│   └── .env.example
└── docs/                   # Long-form docs and reports
```

## Prerequisites

- [Bun](https://bun.sh) `>= 1.1`
- [Node.js](https://nodejs.org) `>= 20` (frontend only)
- Docker (for local Postgres and image builds)

## Quick start (local development)

```bash
# 1. Clone
git clone git@github.com:FINGU-GRINDA/rinda-ai-crm.git
cd rinda-ai-crm

# 2. Start Postgres (dev DB)
cd elysia-server
docker compose -f compose.db.yml up -d

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY.

# 4. Install + run the API (port 3001)
bun install
bun run dev

# 5. In another terminal, run the SPA (port 3000)
cd ../frontend
cp .env.example .env       # defaults point at http://localhost:3001
npm install
npm run dev
```

The server runs migrations and adopts an existing schema on boot — see
`elysia-server/src/db/bootstrap.ts`.

## Environment variables

Every variable is documented in the relevant `.env.example`, marked
`[REQUIRED]` or `[OPTIONAL]`:

- [`elysia-server/.env.example`](./elysia-server/.env.example)
- [`frontend/.env.example`](./frontend/.env.example)

Required to boot the API: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`ENCRYPTION_KEY`, `FRONTEND_URLS`.

## Deployment (Dokploy)

Both services ship a production-ready `Dockerfile` designed for Dokploy (or
any platform that builds from a `Dockerfile` and injects env vars at runtime).

| Service       | Image base          | Port | Healthcheck         |
| ------------- | ------------------- | ---- | ------------------- |
| elysia-server | `oven/bun:1.1-alpine` | 3001 | `GET /health`      |
| frontend      | `nginx:1.27-alpine` | 80   | `GET /`             |

Notes:

- The frontend image substitutes `${BACKEND_URL}` into the nginx config at
  container start (`docker-entrypoint.sh` → `nginx.conf.template`).
- The server image runs migrations on boot; no separate migration step is
  required in your Dokploy pipeline.
- Do **not** bake `.env` files into images — Dokploy injects them at runtime.

## Scripts

### `elysia-server`

| Command            | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `bun run dev`      | Hot-reload dev server                         |
| `bun run start`    | Run the server (production-style)             |
| `bun lint`         | Biome lint + autofix                          |
| `bun type-check`   | `tsc --noEmit`                                |
| `bun db:generate`  | Generate a new Drizzle migration (review it!) |
| `bun db:studio`    | Open Drizzle Studio                           |

### `frontend`

| Command         | Purpose                |
| --------------- | ---------------------- |
| `npm run dev`   | Vite dev server        |
| `npm run build` | Production bundle      |
| `npm run preview` | Preview the build    |

## License

Proprietary — internal to FINGU-GRINDA. See [`LICENSE`](./LICENSE) if present.
