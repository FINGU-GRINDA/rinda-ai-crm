# 01 — Data Model

Source: [`elysia-server/src/db/schema/crm-core.ts`](../../elysia-server/src/db/schema/crm-core.ts), [`crm-deals.ts`](../../elysia-server/src/db/schema/crm-deals.ts), [`crm-events.ts`](../../elysia-server/src/db/schema/crm-events.ts), [`crm-backfill-progress.ts`](../../elysia-server/src/db/schema/crm-backfill-progress.ts). Drizzle ORM on Postgres 18+.

**9 tables, 11 enums, all workspace-scoped, all UUIDv7 PKs.** Every CRM row cascade-deletes on workspace teardown.

---

## Conventions

| Concern | Convention |
|---|---|
| PK | `id uuid primary key default uuidv7()` (PG 18+ native function). Sortable by creation time — saves a `created_at` index when ordering by insertion order. |
| Workspace scoping | Every table: `workspace_id uuid not null references workspaces(id) on delete cascade`. |
| Timestamps | `created_at`, `updated_at`: `timestamp with time zone not null default now()`. Event-specific: nullable. |
| Dedup | Partial unique indexes on `(workspace_id, lower(<value>)) where <value> is not null`. Race-safe: second writer hits unique violation and re-reads. |
| Soft delete | Use timestamp columns (`lost_at`, `completed_at`). Don't physically delete CRM rows. |
| Audit | Every state change writes a row into `crm_object_events` in the same DB transaction. |

---

## Enums (11 total)

```sql
-- crm-core
create type company_size_enum as enum ('1_10','11_50','51_200','201_500','501_1000','1000_plus');
create type buyer_type_enum as enum ('buyer','distributor','reseller','oem','unknown');
create type crm_contact_kind_enum as enum ('email','phone','linkedin','other');

-- crm-deals
create type deal_stage_enum as enum ('engaged','in_conversation','negotiating','confirmed','contract');
create type deal_person_role_enum as enum ('champion','decision_maker','influencer','gatekeeper','user','other');
create type deal_account_role_enum as enum ('buyer','partner','distributor','end_customer','other');
create type crm_message_channel_enum as enum ('email','linkedin_dm','linkedin_inmail','web_form','meeting_note','sms','system');
create type crm_message_direction_enum as enum ('inbound','outbound');

-- crm-events
create type crm_object_event_type_enum as enum (
  'account_created','account_merged_into',
  'person_created','person_merged_into',
  'person_contact_added','account_contact_added','contact_added',  -- first two are dead values (kept for PG compat)
  'deal_created','deal_stage_changed','deal_lost_changed',
  'lead_converted'
);
create type crm_object_target_type_enum as enum (
  'account','person','person_contact','account_contact','contact','deal'
  -- person_contact, account_contact are dead values
);
create type crm_object_source_type_enum as enum ('lead','unipile_webhook','classifier','manual','api','csv_import');

-- crm-backfill-progress
create type crm_backfill_status_enum as enum ('pending','running','completed','failed');
```

> **Rebuild note**: skip the dead enum values (`person_contact_added`, `account_contact_added`, `person_contact`, `account_contact`). They exist in the source repo only because Postgres can't drop enum values once added. New code emits `contact_added` against the unified `contacts` table.

---

## Table: `accounts` — buyer companies

```sql
create table accounts (
  id                uuid primary key default uuidv7(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  name              text not null,
  domain            text,                       -- nullable; matches against 800M buyer DB
  country           text,                       -- ISO 3166
  industry          text,
  legal_name        text,                       -- formal contract name e.g. "Acme International Co., Ltd."
  address_line1     text,
  address_line2     text,
  city              text,
  state_region      text,
  postal_code       text,
  tax_id            text,                       -- VAT / EIN / business registration
  default_currency  text,                       -- ISO 4217 — deal.currency overrides per opportunity
  website_url       text,                       -- full URL https://acme.com (separate from `domain`)
  description       text,                       -- free-form notes / enrichment blurb
  company_size      company_size_enum,
  buyer_type        buyer_type_enum,
  timezone          text,                       -- IANA — used by Conversation Agent to propose meeting slots
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index accounts_workspace_name_idx on accounts (workspace_id, name);

-- Partial: domain-less rows don't collide on NULL.
-- One Account per (workspace, domain). Catches M:1 race on lead conversion: second
-- writer hits unique violation → handler re-reads existing account row.
create unique index accounts_workspace_domain_lower_uidx
  on accounts (workspace_id, lower(domain))
  where domain is not null;
```

---

## Table: `persons` — humans at an account

```sql
create table persons (
  id            uuid primary key default uuidv7(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  account_id    uuid references accounts(id) on delete set null,  -- nullable + set null (see notes)
  full_name     text not null,
  title         text,
  department    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index persons_workspace_account_idx on persons (workspace_id, account_id);
```

**Notes:**
- `account_id` is nullable so persons from public-domain mailboxes (e.g. `gmail.com`) or persons created before an Account is matched can exist.
- `on delete set null` (not cascade) — when an Account is deleted, the Person row is preserved.
- LinkedIn URL / phone / email all live on the `contacts` table; no per-channel column here.

---

## Table: `contacts` — channel identifiers per person

```sql
create table contacts (
  id                  uuid primary key default uuidv7(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  person_id           uuid not null references persons(id) on delete cascade,
  kind                crm_contact_kind_enum not null,  -- email | phone | linkedin | other
  value               text not null,                    -- the address / number / URL
  label               text,
  is_primary          boolean not null default false,
  last_verified_at    timestamptz,                      -- null = never verified
  sources             text[] not null default '{}',     -- accumulates: manual | unipile | enrichment | inbound_email | ...
  do_not_contact      boolean not null default false,   -- CAN-SPAM / GDPR — agents skip when true
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index contacts_workspace_person_idx on contacts (workspace_id, person_id);

-- Workspace-wide dedup on (kind, lower(value)). The ingestion service looks up
-- an incoming email here first; on hit it reuses `person_id` instead of creating
-- a new Person.
create unique index contacts_workspace_kind_value_uidx
  on contacts (workspace_id, kind, lower(value));
```

**`sources` is an accumulating array** — append, don't overwrite. The same channel id can be acquired through multiple sources over time (e.g. first via `inbound_email`, later confirmed via `enrichment`).

---

## Table: `deals` — sales opportunities

```sql
create table deals (
  id                    uuid primary key default uuidv7(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  deal_stage            deal_stage_enum not null default 'engaged',
  deal_size             numeric(14, 2),
  currency              text,                            -- ISO 4217
  expected_close_date   date,
  lost_at               timestamptz,                     -- soft-archive; orthogonal to deal_stage
  incoterms             text,
  payment_terms         text,
  field_overrides       jsonb not null default '{}'::jsonb,  -- see below
  is_backfilled         boolean not null default false,  -- drives "BACKFILL" badge on kanban card
  thread_external_id    text,                            -- provider thread id; partial-unique below
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Kanban column scan — workspace + stage is the dominant access pattern.
create index deals_workspace_stage_idx on deals (workspace_id, deal_stage);

-- One Deal per (workspace, thread). Partial — classifier-created Deals set
-- threadExternalId; manually-created Deals leave it NULL and don't collide.
create unique index deals_workspace_thread_uidx
  on deals (workspace_id, thread_external_id)
  where thread_external_id is not null;
```

**`field_overrides` shape** (jsonb):
```ts
{
  [fieldName: string]: { user_id: uuid, timestamp: ISO8601 }
}
```
Locked-in fields (e.g. a manually edited `deal_stage`) survive Stage Classifier re-runs. See [04-deal-lifecycle.md](04-deal-lifecycle.md) §3.5 (Manual Override Protection).

**`lost_at` semantics**: NULL = active. Non-NULL timestamp = lost (rep clicked "Mark as Lost"). The deal keeps its last `deal_stage` for historical clarity. Restore = `UPDATE deals SET lost_at = NULL`. Server stamps `NOW()` on lost-write to avoid client clock drift.

---

## Table: `deal_persons` — M:M Deal ↔ Person

```sql
create table deal_persons (
  id            uuid primary key default uuidv7(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  deal_id       uuid not null references deals(id) on delete cascade,
  person_id     uuid not null references persons(id) on delete cascade,
  role          deal_person_role_enum,                  -- champion | decision_maker | influencer | gatekeeper | user | other
  is_primary    boolean not null default false,
  added_at      timestamptz not null default now()
);

-- One row per (deal, person) pair.
create unique index deal_persons_workspace_deal_person_uidx
  on deal_persons (workspace_id, deal_id, person_id);

-- Max one primary champion per deal.
create unique index deal_persons_workspace_deal_primary_uidx
  on deal_persons (workspace_id, deal_id)
  where is_primary;

create index deal_persons_workspace_deal_idx   on deal_persons (workspace_id, deal_id);
create index deal_persons_workspace_person_idx on deal_persons (workspace_id, person_id);
```

The `is_primary = true` row identifies the **champion** for the deal.

---

## Table: `deal_accounts` — M:M Deal ↔ Account

```sql
create table deal_accounts (
  id            uuid primary key default uuidv7(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  deal_id       uuid not null references deals(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  role          deal_account_role_enum,                 -- buyer | partner | distributor | end_customer | other
  is_primary    boolean not null default false,
  added_at      timestamptz not null default now()
);

create unique index deal_accounts_workspace_deal_account_uidx
  on deal_accounts (workspace_id, deal_id, account_id);

create unique index deal_accounts_workspace_deal_primary_uidx
  on deal_accounts (workspace_id, deal_id)
  where is_primary;

create index deal_accounts_workspace_deal_idx    on deal_accounts (workspace_id, deal_id);
create index deal_accounts_workspace_account_idx on deal_accounts (workspace_id, account_id);
```

The `is_primary = true` row identifies the **primary buyer org** for the deal (most deals have exactly one; consortium / partner / distributor scenarios need multiple).

---

## Table: `messages` — unified comms log

```sql
create table messages (
  id                    uuid primary key default uuidv7(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  contact_id            uuid references contacts(id) on delete cascade,  -- nullable; CHECK below
  channel               crm_message_channel_enum not null,
  direction             crm_message_direction_enum not null,
  external_message_id   text,                          -- provider id (Unipile, LinkedIn msg id, etc.)
  thread_external_id    text,                          -- provider thread id (NOT deal attribution)
  subject               text,                          -- null for channels without subjects (DM, SMS)
  body                  text not null,
  extraction_json       jsonb not null default '{}'::jsonb,  -- classifier output: intent, entities, signals
  sent_at               timestamptz not null,
  opened_at             timestamptz,
  clicked_at            timestamptz,
  replied_at            timestamptz,
  created_at            timestamptz not null default now()
);

-- Thread view per contact (descending sent_at for newest-first paging).
create index messages_workspace_contact_sent_idx
  on messages (workspace_id, contact_id, sent_at desc);

-- Provider-side thread lookup for upsert / resume / poll. NOT for deal attribution.
create index messages_workspace_thread_external_idx
  on messages (workspace_id, thread_external_id);

-- Provider-side upsert key — partial-unique so concurrent ingests (webhook retry +
-- backfill running together) can't produce duplicates. Partial because
-- external_message_id is nullable for system / meeting-note channels.
create unique index messages_workspace_external_message_uidx
  on messages (workspace_id, external_message_id)
  where external_message_id is not null;

-- Addressable channels require contact_id; system / meeting_note leave it NULL.
alter table messages add constraint messages_contact_required_check check (
  (channel in ('email','linkedin_dm','linkedin_inmail','web_form','sms') and contact_id is not null)
  or (channel in ('system','meeting_note'))
);
```

**Critical design note (and known limitation):** `messages` has **no direct `deal_id` FK**. The per-Deal message view is computed at query time by walking `deal_persons` / `deal_accounts` → `persons` / `accounts` → `contacts` → `messages`. The MVP limitation is that if two Deals exist at the same Account, they share comms history. [08-gaps-and-corrections.md](08-gaps-and-corrections.md) §10 recommends fixing this in the rebuild by adding a stored `deal_id` (or a `deal_messages` join table).

`extraction_json` is intended to hold Stage Classifier output (intent, entities, signals). **In the source repo this column is never written to** — the classifier runs but the result is discarded. See [08](08-gaps-and-corrections.md) §1.

---

## Table: `crm_object_events` — append-only audit log

```sql
create table crm_object_events (
  id                     uuid primary key default uuidv7(),
  workspace_id           uuid not null references workspaces(id) on delete cascade,
  event_type             crm_object_event_type_enum not null,
  target_type            crm_object_target_type_enum not null,
  target_id              uuid not null,                  -- NO hard FK — must survive row deletion
  source_type            crm_object_source_type_enum,    -- lead | unipile_webhook | classifier | manual | api | csv_import
  source_ref_id          uuid,                           -- e.g., leads.id when source_type='lead'. NO FK.
  source_ref_text        text,                           -- arbitrary external ref (URL, file path) when no uuid
  triggered_by_user_id   uuid references users(id) on delete set null,  -- NULL for classifier / system
  classifier_confidence  numeric(3, 2),                  -- 0.00–1.00, populated when source_type='classifier'
  notes                  text,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

-- "Show me the history of this CRM row" — Account / Person / Deal detail timelines.
create index crm_object_events_workspace_target_idx
  on crm_object_events (workspace_id, target_type, target_id, created_at desc);

-- "What did this lead produce?" — reverse lookup from a source.
create index crm_object_events_workspace_source_idx
  on crm_object_events (workspace_id, source_type, source_ref_id);

-- "Show me all deal_stage_changed events in the last 7 days."
create index crm_object_events_workspace_event_type_idx
  on crm_object_events (workspace_id, event_type, created_at desc);
```

**Why no FK on `target_id`**: the log must survive row deletion. Only `workspace_id` is FK'd so a workspace teardown still cleans up cleanly. Inserts happen in the same DB transaction as the CRM row create/merge.

---

## Table: `crm_backfill_progress` — per-(workspace, email_account) cursor

```sql
create table crm_backfill_progress (
  id                    uuid primary key default uuidv7(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  email_account_id      uuid not null references user_email_accounts(id) on delete cascade,
  status                crm_backfill_status_enum not null default 'pending',
  cursor                text,                           -- opaque Unipile pagination cursor
  months_back           integer not null default 12,
  pages_processed       integer not null default 0,
  messages_processed    integer not null default 0,    -- emails examined (includes idempotent skips)
  messages_ingested     integer not null default 0,    -- subset that produced a new messages row
  last_error            text,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  reclassified_at       timestamptz,                   -- last Stage Classifier sweep (see notes)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index crm_backfill_progress_workspace_email_account_uidx
  on crm_backfill_progress (workspace_id, email_account_id);

create index crm_backfill_progress_workspace_status_idx
  on crm_backfill_progress (workspace_id, status);
```

**`reclassified_at` semantics**: NULL = never classified. The deploy hook enqueues classify jobs for every distinct thread in this row's workspace, then stamps `reclassified_at` so a redeploy doesn't re-blast LLM cost. Bumping env var `CRM_RECLASSIFY_VERSION` forces a global re-run.

---

## Foreign-key reference graph

```
workspaces
   └─► accounts ◄────┐
                     │
   └─► persons ──────┤  (account_id nullable, set null on delete)
                     │
   └─► contacts ─────┤  (person_id required, cascade on delete)
                     │
   └─► deals         │
        ├─► deal_persons  ───► persons
        ├─► deal_accounts ───► accounts
        └─ no FK to messages (derived via contacts)

   └─► messages ─────┐  (contact_id nullable for system/meeting_note)
                     ▼
                   contacts

   └─► crm_object_events  (target_id has NO FK; workspace_id only)

   └─► crm_backfill_progress ─► user_email_accounts
```

---

## Migration order

Source repo evolved through multiple migrations on 2026-05-14 (a same-day reshape). For a clean rebuild, emit these as **one initial migration** containing every table above. The reshape history in the source is only relevant if you're migrating an existing DB.

Source migration markers (for reference only):
- `0364_whole_iron_patriot.sql` — initial CRM core tables
- `0374_concerned_genesis.sql` — collapsed `account_contacts` + `person_contacts` into unified `contacts`; messages `person_contact_id` + `account_contact_id` XOR → single `contact_id`
- `0378_recover_crm_slice_a.sql` — idempotent recovery after migration 0374 was silently skipped on alpha

**For the rebuild: just write `0001_crm_core.sql` with the final shape above.** Don't replay the reshape.

---

## Dedup invariants (race-safety summary)

| Invariant | Enforced by | What collides |
|---|---|---|
| One Account per (workspace, domain) | `accounts_workspace_domain_lower_uidx` (partial) | Lead conversion + Unipile ingest hitting same domain simultaneously |
| One Contact per (workspace, kind, lower(value)) | `contacts_workspace_kind_value_uidx` | Same email arriving via webhook + backfill |
| One Deal per (workspace, thread) | `deals_workspace_thread_uidx` (partial) | Classifier retry / webhook re-fire on same thread |
| One Message per (workspace, external_message_id) | `messages_workspace_external_message_uidx` (partial) | Webhook retry storm + backfill in parallel |
| One champion per Deal | `deal_persons_workspace_deal_primary_uidx` (partial) | Two reps marking different people as primary |
| One primary buyer Account per Deal | `deal_accounts_workspace_deal_primary_uidx` (partial) | Same |
| One backfill progress row per (workspace, email account) | `crm_backfill_progress_workspace_email_account_uidx` | Two backfill jobs enqueued for same account |

**Pattern**: every upsert in the ingestion service uses `ON CONFLICT (workspace_id, …) DO UPDATE` or catches the unique violation and re-reads. See [03-ingestion-pipeline.md](03-ingestion-pipeline.md) §3 for the per-entity upsert logic.

---

## Row-count expectations (Slice A workloads)

- `accounts`: ~10² – 10⁴ per workspace
- `persons`: ~10² – 10⁵ per workspace (10× accounts)
- `contacts`: ~10² – 10⁵ per workspace (1–2× persons)
- `deals`: ~10² – 10⁴ per workspace
- `messages`: ~10⁴ – 10⁶ per workspace (high — 12-month backfill at 100+ msgs/day)
- `crm_object_events`: ~10⁴ – 10⁶ per workspace (1 event per CRM mutation)
- `crm_backfill_progress`: 1 row per connected email account

The descending-`sent_at` index on `messages` is the hot one — kanban detail sheet thread view + ingestion duplicate-check both hit it.
