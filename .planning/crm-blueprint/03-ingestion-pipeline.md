# 03 — Ingestion Pipeline

Source: [`crm-ingestion.service.ts`](../../elysia-server/src/services/crm/crm-ingestion.service.ts), [`crm-email-backfill.service.ts`](../../elysia-server/src/services/crm/crm-email-backfill.service.ts), [`crm-email-backfill.worker.ts`](../../elysia-server/src/workers/bullmq/crm-email-backfill.worker.ts).

Turns provider emails (Unipile-fetched) into rows in `accounts` / `persons` / `contacts` / `messages`, race-safe and idempotent.

---

## Big-picture flow

```
Unipile API ──► backfill worker ─┐
                                 │  IngestMessageDto
Unipile webhook ─────────────────┴────► ingestEmail() ─► db.transaction:
                                                          1. gate checks (engagement + thread shape)
                                                          2. idempotency check (external_message_id)
                                                          3. extract buyer emails
                                                          4. for each: upsert Account → upsert Person+Contact
                                                          5. insert Message row
                                                          6. emit crm_object_events
                                                        └──► (after all jobs in batch) addCrmStageClassifyJob per thread
```

Two callers feed `ingestEmail()`:
- **`processCrmEmailBackfill`** (BullMQ job) — 12-month historical pull, paginated 100/page, max 200 pages per run (resumes on next run if cursor non-null)
- **Unipile webhook handler** (per-message live ingest) — same DTO shape

`ingestEmail()` doesn't know about Unipile. The DTO is provider-agnostic.

---

## 1. The ingest DTO

```ts
type IngestMessageDto = {
  externalMessageId: string | null       // provider message id; drives idempotency. null = synthetic
  threadExternalId: string | null        // provider thread id. null = standalone
  direction: "inbound" | "outbound"
  fromEmail: string
  toEmail: string
  ccEmails?: string[] | null
  subject?: string | null
  body?: string | null
  sentAt: Date
  openedAt?: Date | null
  clickedAt?: Date | null
  repliedAt?: Date | null
}
```

`direction` is decided **by the caller**, not inferred inside `ingestEmail()`. The backfill caller knows all the rep's own email addresses (`SELECT email_address FROM user_email_accounts WHERE workspace_id = $1`) and labels accordingly:

```ts
const direction = repEmails.has(fromAddr) ? "outbound" : "inbound"
```

This matters in multi-account workspaces: without checking *all* rep addresses, a CC to a sibling rep account would be mis-labeled inbound, turning the rep into a buyer "Person" under their own domain.

---

## 2. Engagement gate (drop on the floor before any DB write)

`ingestEmail()` returns an empty result and writes nothing if any check fails:

1. **At least one buyer email extractable.** Inbound: the `from` address. Outbound: `to` + `cc` (rep's own addresses are not buyers). If none, drop.
2. **This message proves engagement.** Either: inbound, OR outbound with at least one of `opened_at` / `clicked_at` / `replied_at` set. Drop cold outbound that sat unread.
3. **(Inbound only) Thread was initiated by us.** A prior outbound row must exist in `messages` for the same `thread_external_id`. Drop inbound from threads where the rep never reached out (e.g. an Instagram security alert: inbound, but we never started it).

> **Caveat in the source**: an open-tracking ping arriving *after* a cold outbound was already dropped won't auto-retrigger ingestion. The webhook handler for open/click events doesn't currently re-invoke `ingestEmail()`. List this as a follow-up in [08-gaps-and-corrections.md](08-gaps-and-corrections.md) §11.

The prior-outbound check runs **inside the transaction**, after `BEGIN`, so a concurrent outbound INSERT for the same thread can't slip in between the SELECT and our subsequent writes. Sub-second outbound+inbound webhook pairs would otherwise lose the inbound forever.

---

## 3. Idempotency check (still inside the transaction)

```sql
select id from messages
where workspace_id = $1 and external_message_id = $2
limit 1;
```

If found ⇒ short-circuit, return `{ messageId: null }`. The partial-unique index `messages_workspace_external_message_uidx` is the SSOT; this SELECT just avoids the per-row upsert cost on hot duplicates (webhook retry storm during backfill).

---

## 4. Domain extraction

Subdomains collapse to **registrable domain** (eTLD+1) before account lookup:

```ts
// legal@mail.attio.com  →  domain="attio.com"  →  Account name="Attio"
// john@attio.com        →  domain="attio.com"  →  same Account
```

This uses the existing helper [`utils/domain.ts:registrableDomain`](../../elysia-server/src/utils/domain.ts) (Public Suffix List). Without subdomain collapse, the company name would be derived from the subdomain (e.g. "Mail").

---

## 5. Account upsert (SELECT-then-INSERT with savepoint)

The race-safe pattern:

```ts
// 1. SELECT
const existing = await tx.select({ id: accounts.id })
  .from(accounts)
  .where(and(
    eq(accounts.workspaceId, ws),
    sql`lower(${accounts.domain}) = ${domain}`,
  ))
  .limit(1)
if (existing) return { id: existing.id, isNew: false }

// 2. INSERT inside a SAVEPOINT (nested transaction)
try {
  const inserted = await tx.transaction(async (sav) => {
    return await sav.insert(accounts)
      .values({ workspaceId: ws, name: titleCaseFromDomain(domain), domain })
      .returning({ id: accounts.id })
  })
  if (inserted) return { id: inserted.id, isNew: true }
} catch {
  // unique violation — fall through to re-read
}

// 3. RE-READ the winning row
const winner = await findAccountByDomain(tx, ws, domain)
if (!winner) throw // contract violation — partial unique exists
return { id: winner.id, isNew: false }
```

**Why a savepoint, not the outer tx**: a unique violation aborts a Postgres transaction. The savepoint lets us catch the violation and continue with the outer tx's other writes.

Account default values on insert:
- `name`: title-cased first segment of domain (`attio.com` → `Attio`)
- `domain`: the registrable domain
- All other columns: NULL (enrichment fills them later — Slice A is "no enrichment")

---

## 6. Person + Contact creation (savepoint pattern, atomic)

Same race-safe pattern, but Person and Contact insert together in one savepoint so we never produce an orphan Person if the contact insert loses the race:

```ts
try {
  const inserted = await tx.transaction(async (sav) => {
    const newPerson  = await sav.insert(persons).values({ workspaceId, accountId, fullName: localPart }).returning()
    const newContact = await sav.insert(contacts).values({ workspaceId, personId: newPerson.id, kind: "email", value: lowerEmail, sources: [sourceTag] }).returning()
    return { personId: newPerson.id, contactId: newContact.id }
  })
} catch {
  // contact unique violation — savepoint rollback discards both inserts (no orphan Person)
}

// Re-read the winning contact, return its person_id
```

**Person `full_name` defaults to the email local-part** (`john@attio.com` → "John"). Enrichment fills the real name later.

**`sources` accumulates** — when an existing contact is found, append the new source tag (atomically, via SQL `CASE WHEN ... = ANY(sources)` so two concurrent ingests don't both append):

```sql
update contacts set sources = case
  when 'inbound_email' = any(sources) then sources
  else array_append(sources, 'inbound_email')
end
where id = $1
```

Source tag values: `"inbound_email"`, `"outbound_email"`. Other ingestion paths add `"enrichment"`, `"unipile"`, `"manual"`.

---

## 7. Message insert

Each ingest produces **at most one** `messages` row. The row's `contact_id` is the **first** buyer email's contact (the "primary"). The other CC contacts get their Account / Person / Contact rows created in the same loop, but no separate `messages` row — they're discoverable via `accounts` ↔ `persons` ↔ `contacts` walks.

```ts
await tx.insert(messages).values({
  workspaceId,
  contactId: primaryContactId,
  channel: "email",
  direction,
  externalMessageId,
  threadExternalId,
  subject,
  body: body ?? "",
  sentAt, openedAt, clickedAt, repliedAt,
})
```

> **Backfill body caveat**: the backfill path passes `body: ""`. Unipile's listing endpoint returns metadata only — fetching the body would require a separate API call per email (100× cost). Enrichment / on-demand fetch fills it later. The kanban detail sheet shows the subject + sender; body view requires the body-fetch path which is not built yet.

---

## 8. Provenance events

Inside the same transaction, for each newly-created CRM row:

```ts
await tx.insert(crmObjectEvents).values([
  { workspaceId, eventType: "account_created",  targetType: "account",  targetId: accountId,  sourceType: "unipile_webhook" },
  { workspaceId, eventType: "person_created",   targetType: "person",   targetId: personId,   sourceType: "unipile_webhook" },
  { workspaceId, eventType: "contact_added",    targetType: "contact",  targetId: contactId,  sourceType: "unipile_webhook" },
])
```

No event is written for "message ingested" — `messages.created_at` is the event itself. Events only mark **first-time** CRM-entity creation, plus the lifecycle changes (`deal_created`, `deal_stage_changed`, `deal_lost_changed`).

The `source_type` distinguishes how the row came into being:
- `unipile_webhook` — ingestion (both backfill and live)
- `manual` — user typed it in the admin UI
- `classifier` — Stage Classifier created the Deal
- `lead` — lead conversion flow
- `api` — direct API call
- `csv_import` — CSV upload

---

## 9. Backfill worker — Unipile pagination loop

`processCrmEmailBackfill(job)` is the BullMQ handler:

```ts
const UNIPILE_PAGE_SIZE     = 100
const MAX_PAGES_PER_RUN     = 200   // 20,000 emails per run; safety cap

const after = NOW() - monthsBack * 30 days
let cursor = progress.cursor ?? null   // resumes from previous failed run

while (pagesThisRun < MAX_PAGES_PER_RUN) {
  const page = await listAccountEmailsPage({ accountId, after, cursor, limit: 100 })
  await ingestPage({ workspaceId, repEmails, items: page.items })
  cursor = page.cursor                  // null = end of stream
  await db.update(crmBackfillProgress).set({ cursor, ...counters })
  if (cursor === null) break
}
```

**Resumability**: if the worker crashes / is killed / hits the page cap, the cursor on `crm_backfill_progress` lets the next enqueue resume exactly where it left off. The progress row updates **every page** so a kill is at worst 100 emails of replay.

**Per-page bulk-skip**: before calling `ingestEmail()` per item, bulk-fetch the subset of provider ids already in `messages`:

```sql
select external_message_id from messages
where workspace_id = $1 and external_message_id = any($2)
```

Skip already-ingested ids in JS rather than paying the savepoint cost per row. (Skipped ids still go into `threadsTouched` for classifier fan-out — see §10.)

**Status transitions**:
- enqueue ⇒ upsert `crm_backfill_progress` with `status="running"` (`onConflictDoUpdate`, so re-enqueue on the same key is safe)
- normal completion (cursor reached null) ⇒ `status="completed"`, `completed_at=NOW()`, `reclassified_at=NOW()`
- hit page cap with cursor non-null ⇒ `status="running"` (next enqueue resumes)
- exception thrown ⇒ `status="failed"`, `last_error = message.slice(0, 1000)`

**Concurrency = 1** per worker. One backfill job per (workspace, email account) at a time — no contention possible.

---

## 10. Stage Classifier fan-out (after the page loop)

Every thread touched during this backfill run gets a `crm-stage-classify` job enqueued, **after** the progress row is marked complete:

```ts
for (const threadExternalId of threadsTouchedThisRun) {
  await addCrmStageClassifyJob({ workspaceId, threadExternalId, reason: "backfill" })
}
```

The classify job's BullMQ id is deterministic on `(workspace_id, thread_external_id)`, so:
- Overlapping pages (same thread spanning a page boundary) ⇒ one classify job
- Re-runs of the same backfill ⇒ one classify job per thread (idempotent)
- Crash mid-fan-out ⇒ residual threads picked up by `reclassify-on-deploy` hook ([04-deal-lifecycle.md](04-deal-lifecycle.md) §3.7)

Threads idempotent-skipped on this run (their messages already existed) **still** go into `threadsTouched`. Reason: a previous backfill might have ingested the messages but failed to fan out classify jobs (worker was down, partial deploy). The classify job is itself idempotent so re-enqueueing is safe.

---

## 11. Webhook live-ingest path (sibling caller — not in CRM code)

The Unipile webhook handler (in [`elysia-server/src/routes/webhooks/`](../../elysia-server/src/routes/webhooks/), outside `routes/crm/`) calls `ingestEmail()` directly for each incoming webhook event. Same DTO, same gate, same idempotency.

After a successful live ingest, the webhook handler enqueues a single classify job for the thread (if `threadExternalId` is not null). No fan-out needed — webhooks deliver one message at a time.

---

## 12. Failure modes the source repo handled

| Scenario | How it's handled |
|---|---|
| Webhook retry storm during backfill | Idempotent on `(workspace_id, external_message_id)` partial unique. Both writers SELECT, one INSERTs, the loser re-reads the winner. |
| Concurrent outbound+inbound on same thread (sub-second) | Prior-outbound check runs *inside* the transaction. The outbound INSERT must commit before the inbound SELECT can see it; if the inbound runs first it'll be dropped (gate fails), but that's correct — we don't know yet that we initiated the thread. |
| Backfill killed mid-page | Cursor on `crm_backfill_progress` lets next enqueue resume. At-most 1 page of replay (each page commits its cursor). |
| Backfill killed mid-fan-out | `reclassify-on-deploy` hook picks up residual threads at worker startup. |
| Per-message ingestion failure | `try/catch` per item in `ingestPage()` — log and continue. One malformed sender doesn't abort the batch. |
| Stale `userEmailAccounts` row (user disconnected on Unipile) | Pre-flight `getAccountInfo(apiKey)` on `/backfill/start` — surfaces a 404 with `EMAIL_ACCOUNT_NOT_FOUND` so FE can localize the message, instead of failing silently inside the worker. |

---

## What's not in the source you should add

- **Open/click webhook re-invokes `ingestEmail()`** for the original outbound row. Currently a cold outbound that gets opened later is permanently dropped.
- **`body` fetch path**. Unipile's per-message body endpoint exists but isn't wired into the backfill worker. Without bodies, the Stage Classifier has only the subject + metadata to work with, which is insufficient.
- **Public-domain filter**. Slice A creates an Account for every sender domain, including `gmail.com`, `outlook.com`, `qq.com`. This litters the Accounts list with junk. Recommendation: maintain an allow-list of "this is a buyer" domains, OR a deny-list of public providers (`accounts.is_public_provider` flag).
- **Person-name enrichment**. The current default (email local-part title-cased) gives "John" instead of "John Smith". Wiring an enrichment service (Hunter, Apollo, or LLM signature parsing) to fill `persons.full_name` / `title` / `department` is the next step after Slice A.
