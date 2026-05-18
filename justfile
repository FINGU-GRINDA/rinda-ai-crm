set shell := ["bash", "-cu"]

LIKEC4_DIR := "docs/likec4"
LIKEC4_OUT := "docs/likec4/dist"

# default: list recipes
default:
    @just --list

# ---------- LikeC4 ----------

# parse + type-check the architecture model
c4-validate:
    likec4 validate -i {{LIKEC4_DIR}}

# format .c4 files in place
c4-format:
    likec4 format -i {{LIKEC4_DIR}}

# dev server with hot reload
c4-serve:
    likec4 serve -i {{LIKEC4_DIR}}

# build static site
c4-build:
    likec4 build -i {{LIKEC4_DIR}} -o {{LIKEC4_OUT}}

# export PNGs (one per view)
c4-png:
    likec4 export png -i {{LIKEC4_DIR}} -o {{LIKEC4_OUT}}/png

# export Mermaid
c4-mermaid:
    likec4 export mermaid -i {{LIKEC4_DIR}} -o {{LIKEC4_OUT}}/mermaid

# ---------- Frontend (React / Vite) ----------

fe-dev:
    cd frontend && npm run dev

fe-build:
    cd frontend && npm run build

fe-install:
    cd frontend && npm install

# ---------- Backend (Elysia / Bun) ----------

be-dev:
    cd elysia-server && bun run dev

be-start:
    cd elysia-server && bun run start

be-lint:
    cd elysia-server && bun lint

be-typecheck:
    cd elysia-server && bun type-check

be-format:
    cd elysia-server && bun format

be-install:
    cd elysia-server && bun install

# run lint + type-check together (matches CLAUDE.md project rules)
be-check: be-lint be-typecheck

# generate Drizzle migration files (review before applying)
db-generate:
    cd elysia-server && bun db:generate

# open Drizzle Studio
db-studio:
    cd elysia-server && bun db:studio

# ---------- Local Postgres (docker compose) ----------

db-up:
    cd elysia-server && bun docker:db-up

db-down:
    cd elysia-server && bun docker:db-down

db-logs:
    cd elysia-server && bun docker:db-logs

# ---------- Convenience ----------

# install all workspaces
install: fe-install be-install

# run backend + frontend together
dev:
    just be-dev & just fe-dev
