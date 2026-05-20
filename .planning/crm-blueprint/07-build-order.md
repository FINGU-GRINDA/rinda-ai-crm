# 07 — Build Order

A phased rollout for the rebuild. Each phase has explicit deliverables, tests to write, and a binary success criterion. The source repo's own internal phasing is in [`docs/plans/rinda-sales-agent-deal-pipeline-gaps.md`](../plans/rinda-sales-agent-deal-pipeline-gaps.md) §Suggested phasing.

> **Suggested team & calendar**: 1 backend engineer + 1 frontend engineer can ship Phase 0–4 in 3–4 weeks of focused work. Phase 5 is a parallel polish stream. Phase 6 (Sales Agent) was unbuilt in source — budget realistically at 4–6 weeks if you do it.

---

## Phase 0 — Foundations (prerequisites, not CRM-specific)

Assume these exist in the new repo before starting CRM work. If they don't, build them first.

- [ ] Postgres database with `uuidv7()` available (PG 18 native or `pg_uuidv7` extension)
- [ ] A `workspaces` table with `id uuid primary key default uuidv7()` and a `users` table
- [ ] Workspace membership model: a user can be admin / member of N workspaces
- [ ] IAM resources & actions registry (`elysia-server/src/constants/iam-resources.ts` pattern)
- [ ] Auth macros: `adminAuth`, `workspaceAuth`, plus a tab-allowlist mechanism if reusing it
- [ ] BullMQ + Redis available; one queue infrastructure file
- [ ] AI gateway wrapper for Anthropic with usage tracking
- [ ] Secrets manager (any: Infisical, Doppler, .env)

**Success**: a smoke route `GET /api/v1/health` returns 200; one BullMQ test queue processes a no-op job; a Zod-validated Anthropic call returns a parsed object.

---

## Phase 1 — Wave 1 schema (data model)

Spec: [01-data-model.md](01-data-model.md)

### Deliverables

- [ ] Migration `0001_crm_core.sql` containing:
  - 11 enums (see [01-data-model.md](01-data-model.md) §Enums)
  - 9 tables (`accounts`, `persons`, `contacts`, `deals`, `deal_persons`, `deal_accounts`, `messages`, `crm_object_events`, `crm_backfill_progress`)
  - All FKs with correct cascade behavior
  - All partial-unique indexes (the dedup invariants table in [01-data-model.md](01-data-model.md))
  - The `messages_contact_required_check` CHECK constraint
- [ ] Drizzle (or your ORM) schema files mirroring the SQL
- [ ] Type exports (`Account`, `NewAccount`, `Deal`, …)

### Tests

- [ ] Migration applies cleanly to an empty DB
- [ ] Migration is idempotent on a clean re-run (or at minimum the dedup invariants are stable)
- [ ] Insert two `accounts` rows with the same domain in the same workspace → second hits unique violation
- [ ] Insert two `contacts` rows with same `(workspace_id, kind, lower(value))` → second hits unique violation
- [ ] Cascade test: delete a `workspace` → all CRM rows for that workspace disappear

**Success**: All migrations apply on a fresh DB and idempotent re-run is clean. Insert/query tests pass.

---

## Phase 2 — Slice A ingestion

Spec: [03-ingestion-pipeline.md](03-ingestion-pipeline.md)

### 2a. Provider-agnostic ingestion service

- [ ] `services/crm/crm-ingestion.service.ts` exporting `ingestEmail({workspaceId, message: IngestMessageDto}): IngestEmailResult`
- [ ] Helpers: `normalizeEmail`, `parseEmailAddress`, `registrableDomain`, `titleCaseFromDomain`
- [ ] Race-safe `upsertAccountByDomain()` and `createPersonAndContact()` with savepoint pattern
- [ ] Engagement gate (3 predicates: extractable buyer, engagement proof, prior-outbound for inbound)
- [ ] Idempotency check on `(workspace_id, external_message_id)`
- [ ] `crm_object_events` writes for first-time entity creation
- [ ] Atomic `sources` array dedup with SQL `CASE WHEN ... = ANY(sources)`

### 2b. Unipile email connector

- [ ] `services/unipile-email.service.ts` exporting `listAccountEmailsPage()`
- [ ] `services/unipile-account.service.ts` exporting `getAccountInfo()`
- [ ] `userEmailAccounts` schema entry per workspace email connection

### 2c. Backfill worker

- [ ] BullMQ queue: `crm-email-backfill` with deterministic job id
- [ ] Worker file `workers/bullmq/crm-email-backfill.worker.ts` (concurrency 1, retry 3 attempts × 30s exponential)
- [ ] Service `crm-email-backfill.service.ts`:
  - Cursor resume from `crm_backfill_progress.cursor`
  - 100/page, 200 pages/run cap
  - Per-page bulk-skip for already-ingested ids
  - Status transitions (pending → running → completed | failed)
  - Stage Classifier fan-out after loop (every touched thread)
- [ ] REST endpoints: `POST /backfill/start`, `GET /backfill/status`, `GET /backfill/runs`

### 2d. Webhook live-ingest (optional in Phase 2; required for Phase 3 to keep up)

- [ ] `routes/webhooks/unipile.routes.ts` with HMAC verification
- [ ] Per-event translation to `IngestMessageDto` + `ingestEmail()` call
- [ ] Enqueue single classify job after each ingest

### Tests

- [ ] Mock `listAccountEmailsPage()`: 250 emails across 3 pages with 50 duplicates → exactly 200 `messages` rows, exactly N unique domains/accounts
- [ ] Concurrent ingest race: 2 parallel `ingestEmail()` with same external_message_id → one inserts, the other returns idempotent skip
- [ ] Engagement gate: cold outbound (no open/click/reply) → no rows written; opened outbound → rows written
- [ ] Prior-outbound gate: inbound without prior outbound on thread → dropped; inbound after outbound → ingested
- [ ] Backfill kill mid-page: re-enqueue resumes from cursor; total messages ingested equals expected count
- [ ] Multi-account workspace: CC to sibling rep email is NOT mis-labeled as inbound

**Success**: Connect a real (test) Gmail to a real Unipile account; start a 1-month backfill; observe Accounts / Persons / Contacts / Messages populate in the DB. Re-run the backfill: zero new rows.

---

## Phase 3 — Deal lifecycle

Spec: [04-deal-lifecycle.md](04-deal-lifecycle.md)

### 3a. Signal engine (pure function)

- [ ] `services/crm/signal-engine.service.ts` with `computeThreadSignals()`, `computeFloorStage()`, `clampToFloor()`
- [ ] Defensive sort with outbound-first tie-break
- [ ] All §3.1–§3.5 predicates encoded (higher tiers are stubs returning false until extraction lands)

### 3b. Stage classifier

- [ ] `services/crm/stage-classifier.service.ts` exporting `classifyThread()`
- [ ] Anthropic system prompt (the full text in [04-deal-lifecycle.md](04-deal-lifecycle.md) §2.6 — copy verbatim)
- [ ] Zod output schema (the 6-field shape)
- [ ] Account resolution via majority vote on contacts
- [ ] Account history pre-fetch (and wire it into the prompt — source didn't but should)
- [ ] 2-attempt inner retry with 500ms backoff
- [ ] 5 skip reasons (`no_messages`, `no_signals`, `not_outbound_initiated`, `no_account`, `classifier_error`)

### 3c. Deal materializer

- [ ] `services/crm/deal-materializer.service.ts` exporting `materializeDealFromClassification()` and `cleanupRejectedDeal()`
- [ ] Three paths: router skip, INSERT, conflict update
- [ ] All conditional UPDATEs re-assert safety predicates in WHERE clause (race-safe)
- [ ] `extraction_json` merge with JSONB `||` operator
- [ ] `crm_object_events` writes on every state change

### 3d. Classify worker

- [ ] BullMQ queue: `crm-stage-classify` with deterministic job id per (workspace, thread)
- [ ] Worker file `workers/bullmq/crm-stage-classify.worker.ts` (concurrency 4, retry 3 × 30s exponential)
- [ ] Throw on `classifier_error` (BullMQ retry); resolve as success for deliberate skips
- [ ] Call `cleanupRejectedDeal()` on `not_outbound_initiated` skip

### 3e. Reclassify-on-deploy

- [ ] `services/crm/reclassify-on-deploy.service.ts` with `runReclassifyOnDeploy()` and `reclassifyWorkspace()`
- [ ] Invoke from worker process startup hook (after all workers started)
- [ ] Stagger enqueues at 4/sec/workspace
- [ ] Stamp `reclassified_at` on every progress row in workspace after enqueue
- [ ] Admin endpoint `POST /backfill/reclassify` exposing `reclassifyWorkspace()`

### Tests

- [ ] Signal engine unit tests covering every §3.1–§3.5 floor
- [ ] Tie-break: same-second outbound + inbound → first message is outbound
- [ ] Classifier stub returning `assigned_stage = "engaged"` over a thread with reply → clamped to `in_conversation`
- [ ] Materializer router skip: champion already has a deal → attach + maybe bump
- [ ] Materializer conflict update: re-classify same thread → updates stage iff safe
- [ ] `cleanupRejectedDeal`: backfilled deal whose thread now fails gate → deleted; manual deal → preserved
- [ ] PATCH dealStage from FE → `field_overrides.deal_stage` set → re-classifier doesn't overwrite

**Success**: A workspace with 100 backfilled threads runs through the classify worker pool; the kanban populates with the right count of cards in each stage. Manual-override a card's stage; trigger reclassify; card stays put.

---

## Phase 4 — Kanban FE

Spec: [05-frontend-architecture.md](05-frontend-architecture.md)

### 4a. Read endpoints

- [ ] `GET /crm/accounts` + `/accounts/:id` (+ `accounts.service.ts` with keyset pagination + batched aggregates)
- [ ] `GET /crm/persons` + `/persons/:id`
- [ ] `GET /crm/deals` + `/deals/:id` + `/messages?dealId=`
- [ ] `GET /crm/threads` + `/threads/summary` (admin debug)
- [ ] `GET /deals/pipeline-metrics` (KPI strip)

### 4b. PATCH endpoint

- [ ] `PATCH /crm/deals/:id` accepting `{ dealStage?, lostAt? }`
- [ ] Server stamps NOW() on `lostAt` (not client value)
- [ ] Writes `field_overrides.deal_stage` when `dealStage` provided
- [ ] Inserts `crm_object_events` for both kinds of change
- [ ] **Stretch goal (source didn't ship)**: accept `{ dealSize?, currency?, expectedCloseDate?, incoterms?, paymentTerms?, notes?, assigneeUserId? }` — see [08-gaps](08-gaps-and-corrections.md) §4

### 4c. FE hooks

- [ ] `useDeals`, `useDeal`, `useDealMessages` (TanStack `useInfiniteQuery` with cursor in `pageParam`)
- [ ] `useUpdateDealStage`, `useUpdateDealLost` (optimistic with `patchInfiniteDeal` helper)
- [ ] `useAccounts`, `usePersons`, `useThreads` for browse pages
- [ ] `usePipelineMetrics` for KPI strip

### 4d. Pages & components

- [ ] `LeadsPipelineView` (top-level container with auto-load loop, search, detail sheet state)
- [ ] `LeadPipelineBoard` (5 columns + DndContext)
- [ ] `LeadPipelineColumn` + `LeadPipelineCard`
- [ ] `LeadDetailSheet` (right-slide drawer, read-only v1)
- [ ] `PipelineMetricsStrip` (KPI tiles + funnel histogram)
- [ ] Browse pages: `DealsBrowsePage`, `AccountsBrowsePage`, `PersonsBrowsePage`, `ThreadsBrowsePage`
- [ ] Register all pages in lazy-import router

### Tests

- [ ] FE: optimistic stage change reflects immediately; server returns error → snapshot restores
- [ ] FE: drag-drop card to same column → no API call
- [ ] FE: mark-lost → card animates out of active view (default filter excludes `lost_at IS NOT NULL`)
- [ ] E2E (Playwright): connect a test mailbox → start backfill → wait for classifier → see kanban populate

**Success**: A user can open `/leads?view=deal-pipeline`, see deals from a backfilled mailbox, drag a card from `engaged` to `in_conversation`, and observe the change persist after refresh.

---

## Phase 5 — Polish (parallel stream; not in source)

The source repo shipped the MVP without these. The rebuild should add them inline rather than retrofit.

### 5a. Schema additions

- [ ] Migration `0002_crm_polish.sql`:
  - `deals.assignee_user_id uuid references users(id) on delete set null`
  - `deals.notes text`
  - `deal_tags` table: `(id, workspace_id, label, color)`
  - `deal_tag_assignments` table: `(deal_id, tag_id, workspace_id)`
  - (optional) `deal_custom_fields` registry table if you want typed custom fields

### 5b. IAM + RLS

- [ ] Add CRM IAM resource constants: `CRM`, `CRM_DEAL`, `CRM_ACCOUNT` with `READ`, `WRITE`, `MANAGE` actions
- [ ] Seed IAM role policies (admin gets all; member gets READ + WRITE on assigned deals; viewer gets READ only)
- [ ] RLS policies on every CRM table:
  ```sql
  alter table accounts enable row level security;
  create policy accounts_workspace_isolation on accounts
    using (workspace_id = current_setting('app.workspace_id')::uuid);
  ```
  Set `app.workspace_id` per DB session from the auth context.

### 5c. PATCH endpoint expansion

- [ ] Accept all editable fields with per-field `field_overrides` writes
- [ ] Add `bulkUpdate` endpoint: `PATCH /crm/deals` with `{ ids: uuid[], dealStage?, assigneeUserId?, ... }`

### 5d. Inline edit UI

- [ ] Wire the detail sheet fields to editable inputs
- [ ] Optimistic patch on every field with per-field error handling
- [ ] Reset-to-AI button on every `field_overrides`-locked field (clears the lock + triggers classifier re-run)

### 5e. Segmentation filters

- [ ] Add server-side filter params to `GET /crm/deals`: `assigneeUserId`, `industry`, `companySize`, `buyerType`, `tagId`
- [ ] FE filter sidebar / chip strip on the kanban

### 5f. Server-side search

- [ ] Add `pg_trgm` GIN indexes on `accounts.name`, `accounts.domain`, `persons.full_name`, `messages.subject`
- [ ] `?q=...` parameter to `/crm/deals` queries trigram-similarity across joined fields

### Tests

- [ ] Bulk update: select 50 cards, change assignee → all 50 update; permission check fires per row
- [ ] RLS: query without workspace_id session var → returns 0 rows
- [ ] Custom field: set deal_size from inline edit → `field_overrides.deal_size` populated; classifier respects it

**Success**: A deal can be reassigned, tagged, noted, and filtered by all of those. RLS prevents cross-workspace leaks even if app code forgets the `WHERE workspace_id = $1` clause.

---

## Phase 6 — Wave 2: Sales Agent (was never built in source)

Source repo: `agent_actions` + `agent_audit_log` tables don't exist; orchestrator + 6 sub-agents don't exist. The spec at [`docs/plans/rinda-sales-agent-deal-pipeline.md`](../plans/rinda-sales-agent-deal-pipeline.md) §5–§6 describes the intended shape.

### Deliverables

- [ ] Migration `0003_crm_agent.sql`:
  - `agent_actions` table: `(id, deal_id, agent_name, proposed_jump, signal_text, prepared_payload jsonb, risks jsonb, status, executed_at, executed_by_user_id, ...)`
  - `agent_audit_log` table: `(event_type, from_stage, to_stage, classifier_confidence, detected_signals, rationale_text, model_version, ...)`
- [ ] Orchestrator service that routes per-deal events to the right sub-agent based on `deals.deal_stage`
- [ ] Six sub-agents (each: Detected Signal + Prepared Action + Risk Check + Action Buttons):
  - Engaged Agent (behavior-tailored follow-up, channel switch)
  - Conversation Agent (welcome, meeting slots, follow-up notes)
  - Negotiation Agent (sample dispatch, defaults from Account profile, counter-offer drafter)
  - Quotation Agent (PI PDF, acceptance watchdog)
  - Contract Agent (info form, e-sign flow, signature reminders, regulatory checklist)
  - Handoff Agent (ERP webhook, pipeline-exit flag, after-sales enrollment)
- [ ] Endpoints: `POST /agent-actions/:id/execute`, `PATCH /agent-actions/:id` (edit), `POST /agent-actions/:id/dismiss`
- [ ] Per-stage opt-in auto-execute toggle (workspace setting)
- [ ] FE: per-card purple Jump button + Action Plan panel
- [ ] FE hooks: `useAgentActions(dealId)`, `useExecuteAgentAction()`, `useDismissAgentAction()`

**Success**: When a deal moves to a new stage, the corresponding sub-agent posts a prepared action; user can execute / edit / dismiss; audit log captures every state change.

**Time estimate**: 4–6 weeks for a 2-person team. Negotiation Agent (sample dispatch + defaults) and Contract Agent (e-sign integration) are the heaviest.

---

## Cross-cutting: things to set up once, use across phases

| Concern | Where | Phase |
|---|---|---|
| Workspace header convention `X-Workspace-Id` | API client + every route handler | 0 |
| Keyset cursor encoder/decoder (composite `${ISO}__${UUID}`) | `services/crm/cursor.ts` shared helper | 2 |
| `crm_object_events` insert helper | `services/crm/events.service.ts` | 1 |
| `field_overrides` read-modify-write helper | `services/crm/deal-overrides.ts` | 3 |
| Optimistic patch helper for FE (`patchInfiniteDeal`) | `lib/api/hooks/crm-deals-optimistic.ts` | 4 |
| Test fixtures (mock Unipile responses, mock Anthropic responses) | `__fixtures__/crm/` | 2 |

---

## Anti-patterns to avoid (learned from the source)

1. **Don't put `success: boolean` in your data payload** — keep it on the response envelope. Source had a critical-rule line item to enforce this.
2. **Don't use OFFSET pagination** — every list is keyset. The cursor pattern is in [02-api-contracts.md](02-api-contracts.md) §Pagination.
3. **Don't compute Deal attribution by joining `messages.deal_id`** — there's no such column, by design. Walk via `contacts`. (Or, in the rebuild, add the column from day one — [08-gaps](08-gaps-and-corrections.md) §10.)
4. **Don't mutate TanStack Query cache in-place** — always go through `setQueryData` with a new object.
5. **Don't add a Drizzle migration without running `bun db:generate`** (or your ORM's equivalent). Hand-rolled migrations broke production in this source repo at least twice.
6. **Don't write `--> statement-breakpoint` in a comment** — Drizzle splits on it raw and the next chunk fails as raw SQL. Source repo broke alpha for several days because of this.
7. **Don't put a `console.log` anywhere** — use a Pino logger (`utils/logger.ts` pattern). Source has a CI guard.
