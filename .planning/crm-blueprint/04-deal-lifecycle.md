# 04 — Deal Lifecycle

Source: [`signal-engine.service.ts`](../../elysia-server/src/services/crm/signal-engine.service.ts), [`stage-classifier.service.ts`](../../elysia-server/src/services/crm/stage-classifier.service.ts), [`deal-materializer.service.ts`](../../elysia-server/src/services/crm/deal-materializer.service.ts), [`reclassify-on-deploy.service.ts`](../../elysia-server/src/services/crm/reclassify-on-deploy.service.ts), [`crm-stage-classify.worker.ts`](../../elysia-server/src/workers/bullmq/crm-stage-classify.worker.ts).

Three components, layered:

```
┌───────────────────────────────────────────────────────────────┐
│  Signal Engine  (deterministic, pure function)                │
│    in : ThreadMessageForSignals[]                             │
│    out: { signals: ThreadSignals, floorStage: DealStage|null }│
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────┐
│  Stage Classifier  (LLM, Claude Sonnet 4.6)                   │
│    in : thread messages + account history + signals + floor  │
│    out: ClassificationResult { stage ≥ floor, … }             │
│         OR ClassifierSkip { skipReason }                      │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────┐
│  Deal Materializer  (DB write, 3 paths)                       │
│    path A: ROUTER SKIP   — same champion person already has   │
│                            a deal → attach (optionally bump)  │
│    path B: INSERT        — net-new deal + deal_persons +      │
│                            deal_accounts + extraction merge   │
│    path C: CONFLICT      — same thread already has a deal →   │
│                            update stage if safe               │
└───────────────────────────────────────────────────────────────┘
```

The **signal engine is authoritative on the lower bound**; the LLM may **promote** above the floor (catching prose-only signals the mechanical columns miss), never **demote**.

---

## 1. Signal Engine

Pure function. No DB writes. Encodes spec §3.1–§3.5 state predicates.

### 1.1 Inputs

```ts
interface ThreadMessageForSignals {
  direction: "inbound" | "outbound"
  sentAt: Date
  openedAt: Date | null
  clickedAt: Date | null
  repliedAt: Date | null
}
```

### 1.2 Computed signals

```ts
interface ThreadSignals {
  // §3.1 / §3.2 — mechanical, derived from message tracking columns today.
  inboundCount: number
  outboundCount: number
  emailOpenedCount: number
  linkClicked: boolean
  attachmentOpened: boolean        // stub: always false until tracking lands
  replyReceived: boolean

  /** Pipeline-eligibility gate. True iff chronologically-first message is outbound. */
  firstMessageIsOutbound: boolean

  // §3.3 commercial mentions — stubs until per-message LLM extraction ships
  sampleRequestedOrSent: boolean
  moqMentioned: boolean
  paymentTermsMentioned: boolean
  incotermsMentioned: boolean
  unitPriceMentioned: boolean

  // §3.4 quotation milestones — stubs until send-flow + per-message intent track
  quotationSent: boolean
  quotationAccepted: boolean
  contractSigned: boolean

  // §3.5 contract execution — stubs until contract-flow integration lands
  contractTemplateSent: boolean
  eSignatureInProgress: boolean
  companyInfoCollectionInProgress: boolean
  regulatoryApprovalInProgress: boolean
}
```

> **State of the §3.3+ stubs in source**: hardcoded `false`. The full predicate tree is encoded so when those signals flip true (after per-message extraction ships), the floor auto-rises with no algorithm change. **In effect today, the floor caps at `in_conversation`**. The LLM still has full pipeline access via the prompt and prose evidence; it's just not backed by deterministic gates above §3.2 yet.

### 1.3 Floor function

```ts
function computeFloorStage(signals: ThreadSignals): DealStage | null {
  // §3.5 Contract
  if (signals.contractTemplateSent || signals.eSignatureInProgress
      || signals.companyInfoCollectionInProgress || signals.regulatoryApprovalInProgress) {
    return "contract"
  }
  // §3.4 Confirmed
  if (signals.quotationSent && signals.quotationAccepted && !signals.contractSigned) {
    return "confirmed"
  }
  // §3.3 Negotiating
  const hasCommercialMention =
    signals.sampleRequestedOrSent || signals.moqMentioned
    || signals.paymentTermsMentioned || signals.incotermsMentioned
    || signals.unitPriceMentioned
  if (hasCommercialMention && !signals.quotationSent) {
    return "negotiating"
  }
  // §3.2 In Conversation
  if (signals.replyReceived) {
    return "in_conversation"
  }
  // §3.1 Engaged — behavioral interest, no reply yet
  const hasBehavioralSignal = signals.emailOpenedCount > 0 || signals.linkClicked || signals.attachmentOpened
  if (signals.outboundCount > 0 && hasBehavioralSignal && !signals.replyReceived) {
    return "engaged"
  }
  return null  // no signal at all — classifier should skip
}
```

`floorStage === null` ⇒ classifier short-circuits with `skipReason: "no_signals"`. No Deal materialized.

### 1.4 Sort defensively + tie-break

Messages are sorted by `sentAt ASC` defensively (callers usually pre-sort). **Tie-break**: when two messages have the same `sentAt`, **outbound first**. Reason: a same-second auto-ack (out-of-office, auto-reply stamped to the second of our send) must not make a thread we initiated look inbound-initiated.

### 1.5 Clamp helper

```ts
function clampToFloor(candidate: DealStage, floor: DealStage): DealStage {
  // STAGE_ORDER = ["engaged","in_conversation","negotiating","confirmed","contract"]
  return stageIdx(candidate) >= stageIdx(floor) ? candidate : floor
}
```

If the LLM returns "engaged" but the engine floor is "in_conversation" (buyer replied), clamp up. Evidence overrides judgment.

---

## 2. Stage Classifier

Read-only against the DB. The decision to write a `deals` row lives in the materializer — keeping the LLM call free of write side-effects makes it trivially safe to re-run on retry.

### 2.1 Model + budgets

| | |
|---|---|
| Model | `claude-sonnet-4-6` (spec §4.2 Step 3 locks this model — do not auto-substitute) |
| Provider | `anthropic` (called through internal AI gateway) |
| Feature label | `crm-stage-classifier` (for usage tracking) |
| Max messages per thread | 40 (truncate to most recent) |
| Max body chars per message | 2000 (truncate with ellipsis) |
| Retries | 2 attempts, 500ms jittered backoff between |
| Outer retry | BullMQ: 3 attempts, exponential 30s — fires when classifier exhausts inner retries |

Anthropic Sonnet 4.6 has 200k context; the budget above stays well under.

### 2.2 Output schema (Zod)

```ts
const llmOutputSchema = z.object({
  assigned_stage:    z.enum(["engaged","in_conversation","negotiating","confirmed","contract"]),
  confidence_score:  z.number().min(0).max(1),
  detected_signals:  z.array(z.string()).max(20),
  rationale_text:    z.string().max(400),
  champion_email:    z.string().nullable(),
  extraction_json:   z.record(z.string(), z.unknown()),
})
```

`extraction_json` is a **flat object** with the entity registry below. Values are typed; `null` = "not present in thread, do not invent":

```ts
{
  moq?: number | null
  payment_terms?: string | null         // "T/T", "L/C", "30%/70%"
  incoterms?: string | null             // "FOB Busan", "CIF Tokyo", "EXW", "DDP"
  currency?: string | null              // ISO 4217: "USD", "EUR", "JPY", "KRW"
  unit_price?: number | null
  deal_size?: number | null
  expected_close_date?: string | null   // ISO 8601 date "YYYY-MM-DD"
  sample_requested?: boolean | null
  sample_sent?: boolean | null
  quotation_sent?: boolean | null
  quotation_accepted?: boolean | null
  contract_signed?: boolean | null
  contract_template_sent?: boolean | null
}
```

### 2.3 The five skip reasons

```ts
type ClassifierSkipReason =
  | "no_messages"            // thread has zero rows in `messages`
  | "no_signals"             // floor stage was null — nothing actionable yet
  | "not_outbound_initiated" // first message wasn't ours; filter out inbound noise (login alerts, etc.)
  | "no_account"             // messages exist but none link to an Account
  | "classifier_error"       // LLM call exhausted retries (transient 5xx / network)
```

**Worker handling per skip reason:**
- `classifier_error` ⇒ **throw** (BullMQ outer retry kicks in)
- `not_outbound_initiated` ⇒ call `cleanupRejectedDeal()` to delete the existing Deal if any (safety predicates protect manual / lost / overridden rows)
- All others ⇒ resolve as success, no Deal

### 2.4 Account resolution (majority vote)

The classifier walks the thread's contacts to find the Account:

```
threadRows.contactId  ──►  contacts.person_id  ──►  persons.account_id
                                                            │
                                                            ▼
                                              majority vote across thread's contacts
```

CC chains where a non-buyer (e.g. internal rep CC'd) is the first contact don't dominate, because their `persons.account_id` is null or points to the rep's own org.

### 2.5 Account history is fetched (but not yet sent to prompt)

The classifier also queries **all other persons + contacts at the same Account** (`allAccountPersonIds`, `allAccountContactIds`). This is per spec §7.11 #9: "a new Deal at an established Account inherits the Account's pipeline maturity." **In the current source, those ids are gathered but not passed into the LLM prompt** — the prompt only contains the thread under classification. Adding "this Account has 3 deals already in negotiating" to the prompt is a follow-up. ([08-gaps-and-corrections.md](08-gaps-and-corrections.md) §12.)

### 2.6 Prompt structure

**System prompt (excerpt)**:
> You are RINDA's Stage Classifier — you place a single email thread on a 5-stage export-sales pipeline (spec §3.1–3.5).
>
> PIPELINE (evaluate in REVERSE order: Contract → Confirmed → Negotiating → In Conversation → Engaged):
>
> §3.5 CONTRACT — contract execution in progress. Entry predicates (ANY): contract template sent, e-signature flow in progress (DocuSign, 모두싸인, "please sign", "signed copy attached"), company information collection (KYC, banking, shipping), regulatory approval (FDA, CE, CPNP, HALAL).
>
> §3.4 CONFIRMED — quotation accepted, contract not yet signed. Predicates (ALL): quotation_sent + quotation_accepted ("approved", "let's proceed", "we'll order", "PO coming") + !contract_signed.
>
> §3.3 NEGOTIATING — sample requested/sent, OR at least one of {moq, payment_terms, incoterms (FOB/CIF/EXW/DDP), unit_price} mentioned, AND !quotation_sent.
>
> §3.2 IN_CONVERSATION — reply_received, intent ∉ {sample_request, price_inquiry, contract_terms}.
>
> §3.1 ENGAGED — email_opened ≥1 OR link_clicked OR attachment_opened, AND !reply_received.
>
> **FLOOR CONSTRAINT (hard rule)**: `assigned_stage` MUST be `floor_stage` OR a stage to the LEFT in the list (i.e. equal or higher commercial maturity). Demoting below the floor is forbidden.

**User prompt structure**:

```
ACCOUNT: <name> (<domain>)

MECHANICAL SIGNALS (computed by signal engine):
  inbound_count                  = <n>
  outbound_count                 = <n>
  email_opened_count             = <n>
  link_clicked                   = <bool>
  ...
  contract_template_sent         = <bool>
  ...
FLOOR_STAGE: <stage>  ← your output must be this stage or higher.

THREAD (<n> messages, chronological):

--- Message 1 (outbound, 2026-04-12T09:23:00Z, from=rep@acme.com) ---
Subject: Hi from RINDA
<body, truncated to 2000 chars>

--- Message 2 (inbound, ...) ---
...
```

Full prompt at [`stage-classifier.service.ts:357`](../../elysia-server/src/services/crm/stage-classifier.service.ts#L357).

### 2.7 Champion person resolution

After the LLM returns `champion_email`:

```ts
const championContact = contactRows.find(c => c.value.toLowerCase() === llmOut.champion_email.toLowerCase().trim())
let championPersonId = championContact?.personId ?? null

// Fallback: first inbound message's person
if (!championPersonId) {
  const firstInbound = threadRows.find(m => m.direction === "inbound")
  championPersonId = contactRows.find(c => c.id === firstInbound?.contactId)?.personId ?? null
}
```

### 2.8 Eligibility gate (hard reject)

Before invoking the LLM, the classifier short-circuits with `skipReason: "not_outbound_initiated"` if `!signals.firstMessageIsOutbound`. Reason: the rep's mailbox backfill ingests *everything* (Instagram security alerts, "verify your email", marketing newsletters). Without this gate, the kanban fills with junk.

The gate is **per-thread**, not per-workspace. Cold sends with zero buyer engagement still pass (they just sit in `engaged` until the buyer opens/clicks/replies).

---

## 3. Deal Materializer

Writes the `deals` / `deal_persons` / `deal_accounts` / `crm_object_events` rows from a `ClassificationResult`. Idempotent. Race-safe via Postgres partial unique indexes plus conditional UPDATE.

### 3.1 Inputs

```ts
interface MaterializeDealParams {
  workspaceId: string
  threadExternalId: string
  classification: ClassificationResult   // assignedStage is non-null here
}
```

### 3.2 The three paths

All three run inside one `db.transaction`:

#### Path A — ROUTER SKIP (one Deal per buyer Person)

```sql
-- Lookup
select d.id, d.deal_stage, d.is_backfilled, d.field_overrides, d.thread_external_id
from deals d
inner join deal_persons dp on dp.deal_id = d.id and dp.person_id = $championPersonId
where d.workspace_id = $workspaceId
limit 1;
```

If a row is found, **attach** to that Deal instead of inserting a new one. Reason: marketing/digest senders that ship one thread id per send (daily-priorities newsletters) would otherwise spawn N duplicate cards for the same buyer Person.

Optionally **advance the stage** if higher (never demote), respecting manual overrides:

```sql
update deals
set deal_stage = $newStage, updated_at = now()
where id = $existingId
  and is_backfilled = true
  and not (field_overrides ? 'deal_stage')
returning id;
```

The safety predicates (`is_backfilled`, `not field_overrides ? 'deal_stage'`) are re-asserted in the WHERE clause so a concurrent rep stage override between the SELECT and UPDATE can't race past the gate. If the UPDATE returns zero rows ⇒ the rep edited in the meantime; leave the deal alone and return the existing id.

> **Race-window note**: concurrent classifies for the same person on *different* threads would both see "no existing" in the SELECT and both INSERT. The source repo accepts this rare dupe rather than denormalizing `primary_person_id` onto `deals` with a unique index. If you want stronger guarantee in the rebuild, add the denormalized column + partial unique.

#### Path B — INSERT (new deal)

```sql
insert into deals (workspace_id, thread_external_id, deal_stage, is_backfilled)
values ($workspaceId, $threadExternalId, $stage, true)
on conflict (workspace_id, thread_external_id) where thread_external_id is not null
do nothing
returning id;
```

The partial-unique index `deals_workspace_thread_uidx` is the SSOT. On success:

1. Insert `deal_accounts (deal_id, account_id, role="buyer", is_primary=true)`
2. If `championPersonId` resolved: insert `deal_persons (deal_id, person_id, role="champion", is_primary=true)`
3. **Merge `extraction_json` onto every message in the thread**:
   ```sql
   update messages
   set extraction_json = extraction_json || $classifierJson::jsonb
   where workspace_id = $workspaceId and thread_external_id = $threadExternalId;
   ```
   JSONB `||` is rightmost-wins, so the classifier's keys land on top of any pre-existing extraction. Per-message refinements layered on later by future LLM extractors override the thread-level rollup.
4. Insert `crm_object_events`:
   ```ts
   {
     event_type: "deal_created",
     target_type: "deal", target_id: dealId,
     source_type: "classifier",
     classifier_confidence: classification.confidenceScore.toFixed(2),
     metadata: {
       threadExternalId,
       assignedStage: dealStage,
       detectedSignals: classification.detectedSignals,
       rationaleText: classification.rationaleText,
       modelVersion: "claude-sonnet-4-6",
     },
   }
   ```

#### Path C — CONFLICT (deal already exists for this thread)

INSERT returned 0 rows (thread already has a Deal). Re-read the existing row:

```sql
select id, deal_stage, is_backfilled, field_overrides
from deals
where workspace_id = $1 and thread_external_id = $2
limit 1;
```

Two sub-cases:
- **Re-classification**: `is_backfilled = true` AND stage not overridden AND stage changed ⇒ UPDATE with the same WHERE-clause safety predicates as Path A, write `crm_object_events { event_type: "deal_stage_changed", trigger: "reclassify" }`.
- **Untouchable**: manual deal (`is_backfilled = false`) OR rep set stage explicitly ⇒ leave alone, just return id.

### 3.3 `cleanupRejectedDeal` — when a thread becomes ineligible

Called from the classify worker when `skipReason === "not_outbound_initiated"`. Use case: a previous classifier run created a Deal under a looser rule; a tighter gate now rejects the same thread. The Deal must be removed or the kanban shows stale cards forever.

```sql
-- Safety-checked delete
delete from deals
where id = $existingId
  and is_backfilled = true
  and lost_at is null
  and not (field_overrides ? 'deal_stage')
returning id;
```

**Refuses to delete when** any of:
- `is_backfilled = false` ⇒ manual deal (lead conversion / "+New deal")
- `lost_at is not null` ⇒ rep already archived as lost (preserve audit trail)
- `field_overrides has 'deal_stage'` ⇒ rep manually moved the card

Returns `{ deleted: false, skipReason: "manual_override" | "lost" | "not_backfilled" }` in those cases. Cascade FKs handle `deal_persons` / `deal_accounts` on delete. The original `deal_created` event row in `crm_object_events` is intentionally retained (no FK to deals).

### 3.4 Field-overrides protection in detail

When a user PATCHes `/api/v1/crm/deals/:id` with `dealStage`, the route writes:

```ts
field_overrides = {
  ...field_overrides,
  deal_stage: { userId: <caller>, timestamp: ISO8601 }
}
```

(Read-modify-write in JS; no `jsonb_set` wrapper in the codebase.)

Every materializer write path re-checks `not (field_overrides ? 'deal_stage')` inside the WHERE clause. If set, the materializer cannot overwrite the stage — the rep's choice wins.

Other field locks (`deal_size`, `currency`, `expected_close_date`, …) follow the same pattern but aren't writable in the source yet (PATCH endpoint only accepts `dealStage` + `lostAt`). [08-gaps](08-gaps-and-corrections.md) §4.

### 3.5 BullMQ retry policy (classify queue)

| | |
|---|---|
| Concurrency | 4 |
| Attempts | 3 |
| Backoff | exponential, 30s base |
| Dedup | deterministic job id per (workspace, thread); duplicate enqueues are no-ops |

---

## 4. Reclassify-on-deploy hook

Runs at worker startup (after all BullMQ workers are up). One-shot sweep:

```sql
-- Find workspaces with completed backfills not yet classified
select distinct workspace_id from crm_backfill_progress
where status = 'completed' and reclassified_at is null;
```

For each workspace, find threads that need classification:

```sql
select distinct m.thread_external_id
from messages m
left join deals d on d.workspace_id = m.workspace_id and d.thread_external_id = m.thread_external_id
where m.workspace_id = $1
  and m.thread_external_id is not null
  and (d.id is null OR d.is_backfilled = true);
```

**Included threads:**
- (a) Threads with no Deal — first-time classification
- (b) Threads whose Deal is classifier-created (`is_backfilled = true`) — re-run so rule changes land

**Excluded:**
- Manual deals (`is_backfilled = false`) — those reflect user intent; don't clobber

Enqueue at **≤4 jobs/sec/workspace** (`ENQUEUE_STAGGER_MS = 250`) to keep Anthropic budget linear. After enqueuing, stamp `reclassified_at = NOW()` on every progress row in the workspace so a redeploy doesn't re-blast LLM cost.

The same logic is exposed at `POST /api/v1/crm/backfill/reclassify` (admin-on-demand) for after-the-fact recovery.

**Force re-run**: bump env var `CRM_RECLASSIFY_VERSION`. The hook re-reads `reclassified_at IS NULL` as the gate — wiring the version env to also re-trigger requires changing the gate to include a comparison (e.g. `reclassified_at < (settings.CRM_RECLASSIFY_VERSION_TS)`). Source repo doesn't ship that yet — the env var is documented but not actually checked.

---

## 5. End-to-end flow for one inbound email

```
1. Unipile webhook POST /webhooks/unipile
   ──► ingestEmail() in transaction:
        ├─ engagement gate passes (it's inbound)
        ├─ prior-outbound check passes (we initiated the thread)
        ├─ idempotency check (external_message_id) — first time
        ├─ upsert Account by sender domain
        ├─ upsert Person + Contact for sender email
        ├─ insert messages row (channel=email, direction=inbound)
        └─ insert crm_object_events for any new entities

2. Webhook handler enqueues addCrmStageClassifyJob({workspaceId, threadExternalId, reason: "webhook"})

3. classify worker picks up the job (concurrency 4):
   ──► classifyThread():
        ├─ SELECT messages where workspace + thread
        ├─ computeThreadSignals() → { ..., firstMessageIsOutbound: true, replyReceived: true }
        ├─ firstMessageIsOutbound gate ✓ passes
        ├─ computeFloorStage() → "in_conversation"
        ├─ Resolve Account via majority vote on contacts
        ├─ Build Account history (gathered but not yet sent to LLM)
        ├─ Build user prompt with signals + floor + thread text
        ├─ callAIObject({ provider: "anthropic", model: "claude-sonnet-4-6", ... })
        │   (2-attempt retry with 500ms backoff on transient errors)
        ├─ Validate output via Zod
        ├─ clampToFloor(llmOut.assigned_stage, floor)  // "in_conversation" or higher
        └─ return ClassificationResult

4. classify worker invokes materializeDealFromClassification():
   ──► db.transaction:
        ├─ Path A (router): is champion already on a deal? No.
        ├─ Path B (insert): try insert deals on conflict do nothing
        │   ├─ Success path:
        │   │   ├─ insert deal_accounts (buyer, primary)
        │   │   ├─ insert deal_persons (champion, primary)
        │   │   ├─ merge extraction_json onto messages in this thread
        │   │   └─ insert crm_object_events (deal_created)
        │   └─ Conflict path: re-read, optionally update stage if safe
        └─ return { dealId, created: true }

5. Kanban realtime poll (or page revisit) picks up the new deal card.
```

---

## What the rebuild should do differently

Tracked in [08-gaps-and-corrections.md](08-gaps-and-corrections.md), but lifecycle-specific:

1. **Send Account history into the prompt.** Already gathered, not yet wired. Per-prompt cost is tiny and the classification quality improves at established accounts.
2. **Per-message extraction.** The §3.3+ stub flags stay `false` until per-message LLM extraction runs. Add a second classifier (or a single-pass two-output classifier) that writes `messages.extraction_json` directly, so the engine floor can actually reach `negotiating` / `confirmed` / `contract` mechanically.
3. **Add `field_overrides` writeability for other fields**: `deal_size`, `currency`, `expected_close_date`, `incoterms`, `payment_terms`. The materializer's merge logic already respects any key in `field_overrides`; only the PATCH endpoint needs to accept them.
4. **Promote `is_backfilled` to an enum** if you want more than two states. Today it's a boolean (`true` = classifier-created, `false` = manual). A third state ("import from CSV", "lead conversion") would help analytics.
5. **Make `CRM_RECLASSIFY_VERSION` actually trigger re-runs.** Either embed it in the gate predicate or stamp it onto `reclassified_at_version` and compare.
