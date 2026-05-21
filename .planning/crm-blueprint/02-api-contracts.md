# 02 — API Contracts

Source: [`elysia-server/src/routes/crm/`](../../elysia-server/src/routes/crm/) (5 files) + response shape interfaces in [`elysia-server/src/services/crm/`](../../elysia-server/src/services/crm/).

**14 endpoints, prefix `/api/v1/crm`.** Stack is [Elysia](https://elysiajs.com) on Bun, but the contracts below are HTTP-level so any backend can implement them.

---

## Cross-cutting conventions

### Auth macros

Every route declares exactly one auth macro inline. The four kinds used by CRM:

| Macro | Meaning |
|---|---|
| `adminAuth: true` | Caller must be a workspace member with admin role. |
| `adminOrTabAllowlist: { tabKey: <string \| string[]> }` | Caller passes if admin OR if the workspace's tab allowlist has any of these keys (so non-admin reps can access specific tabs without full admin). Multi-key = OR. |
| `workspaceAuth: { resource: <IAM>, action: <IAM> }` | Caller must be a workspace member with the IAM role-policy permitting `(resource, action)`. |
| `public: true` / `auth: true` | Not used by CRM. |

Tab keys used by CRM: `leads.companies`, `leads.people`, `leads.dealPipeline`, `leads.deals`, `leads.threads`. The list endpoint for deals uses `["leads.dealPipeline", "leads.deals"]` because the same API backs both tabs.

IAM constants used: `CRM` resource with `MANAGE` (start a backfill) and `READ` (poll backfill status).

> **Rebuild note**: the source repo has the `CRM` IAM resource constant but **no IAM policy rows** seeded for it. Add policy rows during initial seed — see [08-gaps-and-corrections.md](08-gaps-and-corrections.md) §2.

### Workspace header

All CRM routes require the request header **`X-Workspace-Id: <uuid>`**. The `adminAuth` macro does not inject a workspace context, so the route handler reads the header directly. Routes throw **`400 BadRequestError { code: "WORKSPACE_HEADER_REQUIRED" }`** if missing or set to the literal `"all"`.

### Response envelope

All success responses go through `ok(data)` (see [`utils/reply.ts`](../../elysia-server/src/utils/reply.ts)). Shape:

```jsonc
{ "data": <payload>, "success": true }
```

> **Rebuild note**: do **not** put `{ success: boolean }` in your data payload — keep it on the envelope. Service-layer rule in this codebase, repeated as a critical rule in [`.claude/rules/backend-architecture.md`](../../.claude/rules/backend-architecture.md).

### Pagination

All list endpoints use **keyset cursors** (no OFFSET). Cursor shape is opaque to clients but is internally `"${ISOTimestamp}__${UUID}"` ordered by `(createdAt DESC, id DESC)` or `(sentAt DESC, id DESC)`. Invalid cursors reset to first page (do not 400).

Response always includes:
```jsonc
{
  "items": [ … ],
  "nextCursor": "2026-05-14T10:23:11.000Z__018f3a…" | null
}
```

`nextCursor: null` ⇒ end of list. `limit` is `1..200` (default `50`).

### Errors

All errors are `AppError` subclasses with stable `code`:
- `400 BadRequestError` — input validation, conflicting query flags, missing workspace header
- `404 NotFoundError` — entity not found in this workspace (don't leak existence in another workspace)
- `409 ValidationError` — domain rule (e.g. backfill against non-Unipile email account)

---

## 1. `GET /api/v1/crm/accounts` — list buyer companies

**Source**: [`crm-accounts.routes.ts`](../../elysia-server/src/routes/crm/crm-accounts.routes.ts), [`accounts.service.ts`](../../elysia-server/src/services/crm/accounts.service.ts)

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: "leads.companies" }` |
| Query | `q?: string (max 200)`, `cursor?: string`, `limit?: 1..200` |
| Response | `{ items: AccountListItem[], nextCursor: string \| null }` |

```ts
interface AccountListItem {
  id: string
  name: string
  domain: string | null
  country: string | null
  industry: string | null
  companySize: string | null
  buyerType: string | null
  websiteUrl: string | null
  description: string | null
  createdAt: string  // ISO 8601
  updatedAt: string
  dealCount: number       // count of deal_accounts rows where account_id = this id
  personCount: number     // count of persons with account_id = this id
  lastMessageAt: string | null  // max(messages.sent_at) walked via persons → contacts → messages
}
```

Aggregates are computed via **three batched lookups keyed on the page's account ids** (`count(deals)`, `count(persons)`, `max(messages.sent_at)`). Keeps the query under OLTP work_mem.

---

## 2. `GET /api/v1/crm/accounts/:id` — account detail

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: "leads.companies" }` |
| Params | `id: uuid` |
| Response | `{ account: AccountDetail }` |

```ts
interface AccountDetail extends AccountListItem {
  legalName: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  stateRegion: string | null
  postalCode: string | null
  taxId: string | null
  defaultCurrency: string | null
  timezone: string | null
}
```

`404 NotFoundError` if not in this workspace.

---

## 3. `GET /api/v1/crm/persons` — list humans

**Source**: [`crm-persons.routes.ts`](../../elysia-server/src/routes/crm/crm-persons.routes.ts), [`persons.service.ts`](../../elysia-server/src/services/crm/persons.service.ts)

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: "leads.people" }` |
| Query | `accountId?: uuid`, `q?: string (max 200)`, `cursor?: string`, `limit?: 1..200` |
| Response | `{ items: PersonListItem[], nextCursor: string \| null }` |

`accountId` filter scopes to one account's people. `q` searches `full_name` + `title`.

`PersonListItem` includes activity aggregates (last message at, deal count, contact channel counts).

---

## 4. `GET /api/v1/crm/persons/:id` — person detail

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: "leads.people" }` |
| Params | `id: uuid` |
| Response | `{ person: PersonDetail }` |

`PersonDetail` includes the person's channel contacts (`Contact[]` — every email / phone / linkedin row that points to this person).

---

## 5. `GET /api/v1/crm/deals` — list deals (kanban backing)

**Source**: [`crm-deals.routes.ts`](../../elysia-server/src/routes/crm/crm-deals.routes.ts), [`deals.service.ts`](../../elysia-server/src/services/crm/deals.service.ts)

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: ["leads.dealPipeline", "leads.deals"] }` (multi-tab OR) |
| Query | `dealStage?: DealStage`, `isBackfilled?: bool`, `includeLost?: bool`, `onlyLost?: bool`, `cursor?: string`, `limit?: 1..200` |
| Response | `{ items: DealListItem[], nextCursor: string \| null }` |

**Lost flag logic** (mutually exclusive — both ⇒ `400 LOST_FLAGS_CONFLICT`):
- neither = active only (`lost_at IS NULL`) ← default
- `includeLost=true` = active + lost
- `onlyLost=true` = lost only

```ts
interface DealListItem {
  id: string
  dealStage: "engaged" | "in_conversation" | "negotiating" | "confirmed" | "contract"
  dealSize: string | null      // numeric stringified (no JS Number truncation)
  currency: string | null
  expectedCloseDate: string | null  // YYYY-MM-DD
  lostAt: string | null        // ISO 8601 when marked lost; orthogonal to dealStage
  isBackfilled: boolean        // drives the "BACKFILL" badge on the card
  fieldOverrides: Record<string, { userId: string; timestamp: string }>
  createdAt: string
  updatedAt: string
  primaryAccount: {
    id: string; name: string; domain: string | null
    country: string | null; industry: string | null
    companySize: string | null; buyerType: string | null
  } | null
  primaryPerson: { id: string; fullName: string; title: string | null } | null
  lastMessage: {
    id: string; channel: string; direction: "inbound" | "outbound"
    subject: string | null; sentAt: string
  } | null
}
```

`primaryAccount` is the `deal_accounts` row where `is_primary = true`. `primaryPerson` likewise from `deal_persons`. `lastMessage` is the most recent message walked from this deal's persons → contacts → messages.

---

## 6. `GET /api/v1/crm/deals/:id` — deal detail

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: ["leads.dealPipeline", "leads.deals"] }` |
| Params | `id: uuid` |
| Response | `{ deal: DealDetail }` |

`DealDetail` = `DealListItem` plus:
- `accounts: DealAccountLink[]` — every `deal_accounts` row (with role + isPrimary)
- `persons: DealPersonLink[]` — every `deal_persons` row (with role + isPrimary)
- `recentMessages: MessageListItem[]` — last 50 messages, newest first

---

## 7. `PATCH /api/v1/crm/deals/:id` — update deal (stage and/or lost)

| | |
|---|---|
| Auth | `adminAuth: true` |
| Params | `id: uuid` |
| Body | `{ dealStage?: DealStage, lostAt?: string \| null }` |
| Response | `{ deal: DealListItem }` |

**Body semantics:**
- Omit `dealStage` ⇒ no stage change
- Provide `dealStage` ⇒ writes `deals.deal_stage`, writes `field_overrides.deal_stage = { userId, timestamp: NOW() }` (protects from classifier overwrite), inserts `crm_object_events { event_type: "deal_stage_changed", source_type: "manual", triggered_by_user_id }`
- Omit `lostAt` key entirely ⇒ no lost-flag change
- `lostAt: null` ⇒ restore (clears `lost_at`)
- `lostAt: "<any string>"` ⇒ mark lost (server stamps `NOW()`, ignores the string value — protects from client clock drift)

All writes happen in one DB transaction.

---

## 8. `GET /api/v1/crm/messages` — list messages for a deal

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: ["leads.dealPipeline", "leads.deals"] }` |
| Query | `dealId: uuid (required)`, `cursor?: string`, `limit?: 1..200` |
| Response | `{ items: MessageListItem[], nextCursor: string \| null }` |

Walks `deal_persons ∪ deal_accounts → persons → contacts → messages`. Sorted by `sent_at DESC`. The "concurrent deals at same account share comms history" limitation lives here (see [01-data-model.md](01-data-model.md) `messages` table and [08-gaps](08-gaps-and-corrections.md) §10).

```ts
interface MessageListItem {
  id: string
  channel: "email" | "linkedin_dm" | "linkedin_inmail" | "web_form" | "meeting_note" | "sms" | "system"
  direction: "inbound" | "outbound"
  subject: string | null
  body: string
  sentAt: string
  // contact identity (joined):
  contactKind: "email" | "phone" | "linkedin" | "other" | null
  contactValue: string | null
  personFullName: string | null
}
```

---

## 9. `GET /api/v1/crm/threads` — admin debug list of thread rollups

**Source**: [`crm-threads.routes.ts`](../../elysia-server/src/routes/crm/crm-threads.routes.ts), [`threads.service.ts`](../../elysia-server/src/services/crm/threads.service.ts)

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: "leads.threads" }` |
| Query | `cursor?: string`, `limit?: 1..200` |
| Response | `{ items: ThreadRollup[], nextCursor: string \| null }` |

Surfaces the **message → classifier promotion gate → deal** funnel for debugging. Per-thread rollup of:
- message count + first/last `sent_at`
- whether the signal-engine gate passed (outbound→inbound shape, min messages)
- whether a Deal has been materialized
- classifier verdict (if Stage Classifier has run)

---

## 10. `GET /api/v1/crm/threads/summary` — workspace funnel counters

| | |
|---|---|
| Auth | `adminOrTabAllowlist: { tabKey: "leads.threads" }` |
| Response | `{ totalThreads, qualifyingThreads, threadsWithDeal, orphanMessages }` |

One-row summary of the same funnel. Used by the Threads tab header.

---

## 11. `POST /api/v1/crm/backfill/start` — enqueue 12-month Unipile backfill

**Source**: [`crm-backfill.routes.ts`](../../elysia-server/src/routes/crm/crm-backfill.routes.ts), worker entry [`crm-email-backfill.worker.ts`](../../elysia-server/src/workers/bullmq/crm-email-backfill.worker.ts)

| | |
|---|---|
| Auth | `workspaceAuth: { resource: CRM, action: MANAGE }` |
| Body | `{ emailAccountId: uuid, monthsBack?: 1..24 }` |
| Response | `{ jobId: string, status: "enqueued" }` |

**Pre-flight checks (in order):**
1. Email account exists in this workspace → else `404 EMAIL_ACCOUNT_NOT_FOUND`
2. Email account's `provider === "unipile"` → else `409 ValidationError`
3. Unipile API confirms the account_id still resolves on Unipile's side (catches stale rows where the user disconnected on Unipile but DB never cleaned up) → else `404 EMAIL_ACCOUNT_NOT_FOUND` with localizable code

Then enqueues a BullMQ job with deterministic id `crmEmailBackfillJobId(workspaceId, emailAccountId)` — same id ⇒ second enqueue is a no-op.

---

## 12. `GET /api/v1/crm/backfill/status` — read progress row

| | |
|---|---|
| Auth | `workspaceAuth: { resource: CRM, action: READ }` |
| Query | `emailAccountId: uuid` |
| Response | `BackfillStatus` (see below) |

```ts
type BackfillStatus =
  | { status: "not_started"; emailAccountId: string; jobId: string }
  | {
      status: "pending" | "running" | "completed" | "failed"
      emailAccountId: string
      cursor: string | null         // opaque Unipile cursor
      monthsBack: number
      pagesProcessed: number
      messagesProcessed: number
      messagesIngested: number      // subset that produced new messages rows (rest were idempotent skips)
      lastError: string | null
      startedAt: string             // ISO 8601
      completedAt: string | null
      updatedAt: string
      jobId: string
    }
```

Read straight from `crm_backfill_progress` table.

---

## 13. `GET /api/v1/crm/backfill/runs` — list all backfill progress rows (admin)

| | |
|---|---|
| Auth | `adminAuth: true` |
| Response | `{ runs: BackfillRun[] }` |

For the admin Sync Inspector page. Each `BackfillRun` is a `crm_backfill_progress` row joined with the email account's display info.

---

## 14. `POST /api/v1/crm/backfill/reclassify` — re-enqueue Stage Classifier (admin recovery)

| | |
|---|---|
| Auth | `adminAuth: true` |
| Body | (none) |
| Response | `{ threadsEnqueued: number }` |

Sweeps every thread in the workspace that has no Deal yet, enqueues a Stage Classifier job for each. Use case: after a classifier behavior change, existing threads carry old verdicts. Same logic as the worker-startup `runReclassifyOnDeploy` hook ([04-deal-lifecycle.md](04-deal-lifecycle.md) §3.7), but workspace-scoped + on-demand. No Unipile API cost.

---

## Endpoint summary table

| # | Method | Path | Auth | Tab key(s) |
|---|---|---|---|---|
| 1 | GET | `/crm/accounts` | tab-allowlist | leads.companies |
| 2 | GET | `/crm/accounts/:id` | tab-allowlist | leads.companies |
| 3 | GET | `/crm/persons` | tab-allowlist | leads.people |
| 4 | GET | `/crm/persons/:id` | tab-allowlist | leads.people |
| 5 | GET | `/crm/deals` | tab-allowlist (OR) | leads.dealPipeline, leads.deals |
| 6 | GET | `/crm/deals/:id` | tab-allowlist (OR) | leads.dealPipeline, leads.deals |
| 7 | PATCH | `/crm/deals/:id` | adminAuth | — |
| 8 | GET | `/crm/messages` | tab-allowlist (OR) | leads.dealPipeline, leads.deals |
| 9 | GET | `/crm/threads` | tab-allowlist | leads.threads |
| 10 | GET | `/crm/threads/summary` | tab-allowlist | leads.threads |
| 11 | POST | `/crm/backfill/start` | workspaceAuth | CRM:MANAGE |
| 12 | GET | `/crm/backfill/status` | workspaceAuth | CRM:READ |
| 13 | GET | `/crm/backfill/runs` | adminAuth | — |
| 14 | POST | `/crm/backfill/reclassify` | adminAuth | — |

**Pipeline-metrics endpoint** (KPI strip backing) lives in a sibling route file outside `routes/crm/` — see [05-frontend-architecture.md](05-frontend-architecture.md) §4 for the kanban-specific endpoints.
