# 06 — Integrations

Source: [`elysia-server/src/lib/queue/types.ts`](../../elysia-server/src/lib/queue/types.ts), [`elysia-server/src/lib/queue/queues.ts`](../../elysia-server/src/lib/queue/queues.ts), [`elysia-server/src/services/unipile-email.service.ts`](../../elysia-server/src/services/unipile-email.service.ts), [`elysia-server/src/lib/ai-gateway/call.ts`](../../elysia-server/src/lib/ai-gateway/call.ts) (paths to validate in your local repo).

Four external dependencies + one Postgres extension.

---

## 1. Unipile (email integration)

**What it is**: a third-party API that connects to mail providers (Gmail, Outlook, IMAP, etc.) and exposes a unified interface for listing messages, threads, and webhook subscriptions. Replaces having to integrate each provider individually.

**Why we use it**: Slice A is "email-driven CRM". Building Gmail OAuth + IMAP + Outlook connectors per workspace is months of work; Unipile compresses that to a single API.

### 1.1 Account connection

```
elysia-server/src/services/unipile-account.service.ts
  - getAccountInfo(apiKey: string) → { account_id, email_address, provider, ... }
```

The `apiKey` in `userEmailAccounts.apiKey` is the **Unipile account_id**, not a Unipile API key. The Unipile workspace's bearer token is a server-level env var (not per-row).

### 1.2 List messages page (used by backfill)

```ts
// elysia-server/src/services/unipile-email.service.ts
async function listAccountEmailsPage(args: {
  accountId: string         // Unipile account_id
  after?: string            // ISO 8601 lower bound — "messages after this date"
  cursor?: string           // opaque page cursor
  limit?: number            // page size, max 100
}): Promise<{
  items: UnipileMailboxEmail[]
  cursor: string | null     // null = end of stream
}>
```

Each `UnipileMailboxEmail`:

```ts
{
  id: string                // provider message id
  threadId?: string         // provider thread id
  date: string              // ISO 8601
  from: { identifier?: string; ... }  // email address in `identifier`
  to: [{ identifier?: string }]
  cc: [{ identifier?: string }]
  subject?: string
  // body is NOT in the listing response — must fetch separately
}
```

**Pagination**: keyset-style cursor opaque to caller. End-of-stream signaled by `cursor: null` on the response.

**Rate limits**: Unipile docs claim ~10 req/sec per account; backfill worker is concurrency=1 with 100 emails/page so naturally bounded.

**Body fetch**: requires a separate per-message API call. Source repo does NOT fetch bodies during backfill (passes empty string to `messages.body`). The Stage Classifier needs bodies to work properly — see [08-gaps](08-gaps-and-corrections.md) §11.

### 1.3 Webhooks

Unipile pushes per-message events to a webhook URL. Source webhook handler lives at [`elysia-server/src/routes/webhooks/unipile.routes.ts`](../../elysia-server/src/routes/webhooks/) (outside `routes/crm/`).

Webhook events handled:
- New message (inbound) → translate to `IngestMessageDto` → `ingestEmail()` → enqueue classify job
- Open / click / reply tracking events → update `messages.opened_at` / `clicked_at` / `replied_at`

**Webhook security**: HMAC signature verification with a shared secret in env. The handler is `public: true` (no auth macro) but rejects unsigned/wrong-signature payloads.

### 1.4 Direction inference

Unipile doesn't say "this is outbound" vs "this is inbound" — the caller decides. Pattern in [03-ingestion-pipeline.md](03-ingestion-pipeline.md) §1:

```ts
const repEmails = new Set(
  await db.select(...).from(userEmailAccounts).where(eq(workspaceId, ws))
)
const direction = repEmails.has(fromAddr.toLowerCase()) ? "outbound" : "inbound"
```

**Multi-account workspaces**: must look up all rep email addresses, not just the one being backfilled. Otherwise a CC to a sibling rep account gets mis-labeled inbound, turning the rep into a buyer Person under their own domain.

---

## 2. Claude Sonnet 4.6 (Stage Classifier)

**Model ID**: `claude-sonnet-4-6` (Anthropic). Locked by spec §4.2 Step 3 — do not auto-substitute. Sonnet 4.6 is the cost/quality sweet spot for thread classification (Haiku 4.5 would work for first-pass label only; Opus is overkill).

### 2.1 Invocation

```ts
// stage-classifier.service.ts
import { callAIObject } from "../../lib/ai-gateway/call"

const { object } = await callAIObject({
  provider: "anthropic",
  model:    "claude-sonnet-4-6",
  feature:  "crm-stage-classifier",    // for usage tracking / billing per feature
  workspaceId,                          // for per-workspace cost attribution
  schema:   llmOutputSchema,            // Zod
  system:   STAGE_CLASSIFIER_SYSTEM_PROMPT,
  prompt:   buildUserPrompt({ ... }),
})
```

`callAIObject()` is an internal wrapper around Anthropic's `messages.create` that:
- Routes through a shared gateway (token usage logging, billing attribution)
- Validates output against the Zod schema (rejects malformed JSON)
- Returns `{ object: LlmOutput }` on success, throws on validation / network / 5xx error

### 2.2 Output validation (Zod)

```ts
const llmOutputSchema = z.object({
  assigned_stage:   z.enum(["engaged","in_conversation","negotiating","confirmed","contract"]),
  confidence_score: z.number().min(0).max(1),
  detected_signals: z.array(z.string()).max(20),
  rationale_text:   z.string().max(400),
  champion_email:   z.string().nullable(),
  extraction_json:  z.record(z.string(), z.unknown()),
})
```

Anthropic's `tools` / `response_format` flow makes the model return strict JSON. If the model still returns invalid JSON or violates the schema, Zod throws and the outer retry kicks in.

### 2.3 Token budgets

| Limit | Value | Reason |
|---|---|---|
| Max messages per thread | 40 | Truncate to most recent — older messages rarely change the stage verdict |
| Max body chars per message | 2000 (~500 tokens) | Email tails (quoted history, signatures) wasted before this cap |
| System prompt | ~1.5k tokens | Fixed |
| Per-call total | ~25–35k tokens at max | Well under Sonnet 4.6's 200k context |

### 2.4 Retry policy (two layers)

**Inner retry** (in `classifyThread`):
- 2 attempts total
- 500ms jittered backoff between
- Catches transient 5xx / network blips that typically clear within a second

**Outer retry** (BullMQ):
- 3 attempts total
- Exponential 30s base backoff
- Triggers on `classifier_error` throw from the worker

So worst case: 6 LLM calls before the job permanently fails (2 inner × 3 outer). At Sonnet 4.6's per-call cost, this is acceptable.

### 2.5 Cost guardrails

`reclassify-on-deploy` hook staggers enqueues at **≤4 jobs/sec/workspace** (`ENQUEUE_STAGGER_MS = 250`). For a workspace with 10,000 threads, that's a 40-minute drain — slow but predictable. Bumping concurrency 4 in the worker pool further bounds parallel API calls.

`reclassified_at` timestamp on `crm_backfill_progress` is the **per-workspace LLM cost ratchet** — once a workspace is classified, redeploying does not re-classify unless `CRM_RECLASSIFY_VERSION` is bumped. (Source repo: the env var is documented but the gate doesn't actually compare against it — see [08-gaps](08-gaps-and-corrections.md) §5.)

---

## 3. BullMQ + Redis (job queues)

Two CRM queues in [`elysia-server/src/lib/queue/types.ts`](../../elysia-server/src/lib/queue/types.ts):

```ts
QUEUE_NAMES = {
  CRM_EMAIL_BACKFILL: "crm-email-backfill",
  CRM_STAGE_CLASSIFY: "crm-stage-classify",
  // ... other non-CRM queues
}
```

### 3.1 `crm-email-backfill` queue

| | |
|---|---|
| Concurrency | 1 per worker process |
| Attempts | 3 (BullMQ default, configured) |
| Backoff | exponential 30s |
| Job ID | deterministic `crmEmailBackfillJobId(workspaceId, emailAccountId)` |
| Resumability | cursor in `crm_backfill_progress.cursor` |
| Per-run cap | 200 pages = 20,000 emails (next enqueue resumes from cursor) |
| Failure mode | service writes `status="failed"` + truncated `last_error` to progress row inside its try/catch — the worker doesn't need additional cleanup |

Deterministic job id ⇒ enqueueing twice with the same `(workspaceId, emailAccountId)` is a no-op (BullMQ rejects). This is how the start endpoint and the worker startup hook both safely enqueue.

### 3.2 `crm-stage-classify` queue

| | |
|---|---|
| Concurrency | 4 per worker process |
| Attempts | 3 |
| Backoff | exponential 30s |
| Job ID | deterministic per `(workspaceId, threadExternalId)` |
| Delay support | yes — used by reclassify-on-deploy to stagger enqueues (4/sec/workspace) |
| Failure mode | worker throws on `classifier_error` skipReason to trigger retry; other skip reasons resolve as success |

### 3.3 Redis connection

```ts
// elysia-server/src/lib/redis/connection.ts
function createRedisConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,   // BullMQ requirement
    enableReadyCheck:     false,
  })
}
```

The two worker processes share the Redis connection pool. CRM doesn't introduce any custom Redis keys outside BullMQ's own.

### 3.4 Worker process lifecycle

`elysia-server` ships **two processes** in `bun run dev`:
1. **API process** (`src/index.ts`) — Elysia HTTP server, no workers
2. **Worker process** (`src/worker.ts`) — all BullMQ workers + the `runReclassifyOnDeploy` startup hook

`just dev` runs both via `concurrently`. Running only `bun --watch src/index.ts` means workers don't run and CRM jobs accumulate in Redis. ([../../CONTRIBUTING.md](../../CONTRIBUTING.md) Troubleshooting section.)

### 3.5 Job logging

Every enqueue / start / complete / fail goes through `services/job-log.service.ts` which writes to a `job_logs` table. The admin Sync Inspector page reads from there.

---

## 4. Postgres extensions and conventions

### 4.1 `uuidv7()` function (PG 18+ native)

Used as the PK default on every CRM table:

```sql
id uuid primary key default uuidv7()
```

UUIDv7 is monotonic by creation time, so ordering by `id` is equivalent to ordering by `created_at`. Saves a separate `created_at` index when you want chronological iteration.

> **If your Postgres is < 18**: install the [pg_uuidv7](https://github.com/fboulnois/pg_uuidv7) extension and substitute `uuid_generate_v7()`. Drizzle helper is at [`elysia-server/src/db/helpers/uuid-v7.ts`](../../elysia-server/src/db/helpers/uuid-v7.ts).

### 4.2 Connection split (analytics vs OLTP)

The repo runs **two Postgres roles**:

```
postgres        — OLTP, work_mem=32MB — single-row queries, all writes
analytics_reader — readonly, work_mem=256MB — heavy aggregates, COUNT(DISTINCT)
```

CRM read endpoints all use the default `db` (OLTP). The per-account aggregates in `GET /crm/accounts` are batched lookups that stay under 32MB work_mem; no `analyticsDb` use yet.

**If you build CRM dashboard/reporting later**: use `analyticsDb` for queries with `COUNT(DISTINCT)`, DISTINCT JOIN, multi-FILTER aggregates, or `temp_blks_written > 0` in `EXPLAIN`. Otherwise you'll spill to disk.

### 4.3 No RLS in source

The source repo has no Row-Level Security policies on CRM tables. Workspace isolation is enforced 100% in application code (every query filters by `workspace_id`). The FK to `workspaces(id) on delete cascade` is the only DB-level guarantee. [08-gaps](08-gaps-and-corrections.md) §2 recommends adding RLS in the rebuild.

### 4.4 GIN trigram for search

The source repo uses `pg_trgm` with `gin (column gin_trgm_ops) WITH (fastupdate=on, gin_pending_list_limit=32MB)` on some search-heavy columns (leads). CRM search is currently client-side over a 1000-deal slice ([05](05-frontend-architecture.md) §2.3), so no trigram indexes exist on CRM tables. If you add server-side search (>5000 deals), add trigram on `accounts.name`, `accounts.domain`, `persons.full_name`, `messages.subject`.

---

## 5. Secrets management (Infisical)

The source repo uses [Infisical](https://infisical.com) for secret management. Three environments: `local`, `alpha`, `beta` (production).

CRM-relevant secrets:
- `UNIPILE_API_KEY` (workspace-level bearer token for Unipile)
- `UNIPILE_WEBHOOK_SECRET` (HMAC verification key)
- `ANTHROPIC_API_KEY` (for the AI gateway)
- `DATABASE_URL`, `DATABASE_ANALYTICS_URL`, `REDIS_URL`

**Rebuild can use any secrets manager** — Doppler, AWS Secrets Manager, Vault, or just `.env` files for dev. The shape that matters: one Anthropic key, one Unipile workspace key, one webhook secret per env.

---

## 6. Integration test surface (what to exercise)

For the rebuild, a working integration test set covers:

1. **Unipile mock backfill**: feed `listAccountEmailsPage()` mock data; assert `accounts` / `persons` / `contacts` / `messages` rows are created with the expected dedup.
2. **Webhook live-ingest**: POST a Unipile-shaped payload; assert one `messages` row + one classify job enqueued.
3. **Classifier mock**: stub `callAIObject()` to return a fixed `LlmOutput`; assert `materializeDealFromClassification()` writes the expected `deals` + `deal_persons` + `deal_accounts` + `crm_object_events` rows.
4. **Race-safety**: spawn 2 concurrent `ingestEmail()` calls with the same `external_message_id`; assert exactly one `messages` row exists at the end.
5. **PATCH deal stage**: optimistic patch from FE; assert `field_overrides.deal_stage` is set; re-run classifier; assert the materializer respects the override.
6. **Reclassify-on-deploy**: insert a workspace with `reclassified_at IS NULL`; run the hook; assert classify jobs are enqueued with `ENQUEUE_STAGGER_MS` delay and `reclassified_at` is stamped after.

The source repo has tests for ingestion + classifier + materializer ([`*.test.ts`](../../elysia-server/src/services/crm/) siblings of each service file). Use them as fixtures.
