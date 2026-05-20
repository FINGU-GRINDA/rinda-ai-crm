# CRM Blueprint — Rebuilding the Rinda CRM in a new repo

This folder is a self-contained spec set. Everything you need to rebuild the CRM (deal pipeline, email ingestion, kanban UI) is in these markdown files — you should not have to read the source repo to follow them, only to verify edge cases.

Each doc cites the source-of-truth file paths from the original repo for cross-reference, but the column-by-column schemas, request/response shapes, and algorithms are copied here verbatim.

## Source provenance

- **Original repo**: `d:\work\send-grid-test` (Rinda monorepo: React + Vite admin / Elysia + Bun server / Playwright e2e)
- **Shipped**: v2.7.2.0 on 2026-05-15 ([CHANGELOG.md](../../CHANGELOG.md))
- **Spec docs**: [rinda-sales-agent-deal-pipeline.md](../plans/rinda-sales-agent-deal-pipeline.md) (v1.0, 2026-05-12) + [rinda-sales-agent-deal-pipeline-gaps.md](../plans/rinda-sales-agent-deal-pipeline-gaps.md)
- **Primary author**: viky (vikyw@grinda.ai), 111 CRM commits, 2025-10-28 → 2026-05-14

## Read order

| File | Tier | What it answers |
|---|---|---|
| [00-overview.md](00-overview.md) | overview | What is this CRM, what problem does it solve, where does it sit in the product |
| [01-data-model.md](01-data-model.md) | implementation | Every table, column, enum, index, FK, dedup invariant |
| [02-api-contracts.md](02-api-contracts.md) | implementation | Every endpoint: method, path, auth, request, response, pagination |
| [03-ingestion-pipeline.md](03-ingestion-pipeline.md) | implementation | How emails become Account / Person / Contact / Message rows |
| [04-deal-lifecycle.md](04-deal-lifecycle.md) | implementation | Signal engine gates → mechanical deal materializer → stage classifier |
| [05-frontend-architecture.md](05-frontend-architecture.md) | implementation | 5-stage kanban, detail sheet, query hooks, optimistic DnD |
| [06-integrations.md](06-integrations.md) | implementation | Unipile, Claude Sonnet 4.6, BullMQ, Postgres extensions |
| [07-build-order.md](07-build-order.md) | implementation | Phased rollout — what to build first |
| [08-gaps-and-corrections.md](08-gaps-and-corrections.md) | implementation | What's missing or broken in the source so the rebuild can fix it |

## Build order at a glance

1. **Wave 1 schema** — 9 tables + enums + migrations ([01](01-data-model.md))
2. **Slice A ingestion** — Unipile connector + entity mappers + backfill worker ([03](03-ingestion-pipeline.md))
3. **Signal engine + deal materializer** — mechanical-only, no LLM ([04](04-deal-lifecycle.md) §1–2)
4. **Stage classifier** — LLM with `extraction_json` actually written this time ([04](04-deal-lifecycle.md) §3, [08](08-gaps-and-corrections.md) §1)
5. **Kanban FE** — 5-stage board + detail sheet + KPI strip ([05](05-frontend-architecture.md))
6. **Wave 2 (was never built in source)** — agent orchestration tables + Sales Agent ([07](07-build-order.md) §6, [08](08-gaps-and-corrections.md) §9)
7. **Polish** — inline edit, assignee, notes, tags, custom fields, segmentation ([08](08-gaps-and-corrections.md) §2–8)

## Conventions used throughout

- **PKs**: `uuid` PG type, default `uuidv7()` (PG 18+ native function). Sortable by creation time, no separate `created_at` index needed when ordering by PK.
- **Workspace scoping**: every CRM table has `workspace_id uuid not null references workspaces(id) on delete cascade`. Every query filters by `workspace_id`. Every unique index is partial-scoped to `workspace_id`.
- **Timestamps**: `timestamp with time zone not null default now()` for `created_at` / `updated_at`; nullable for event-specific timestamps (`lost_at`, `replied_at`, `opened_at`, `clicked_at`, `completed_at`).
- **Dedup**: partial unique indexes on `(workspace_id, lower(value))` patterns — race-safe under concurrent inserts; second writer hits unique violation and re-reads the existing row.
- **Audit trail**: every state change writes a `crm_object_events` row in the same DB transaction.
