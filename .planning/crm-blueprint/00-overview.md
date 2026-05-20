# 00 — Overview

## What this is

A CRM module for a B2B sales-outreach platform. Sits alongside (not replaces) the existing **leads** (prospect discovery), **sequences** (automated outreach), **email** (inbox + sending), and **linkedin-sdr** (LinkedIn automation) modules. The CRM is the "where the deal lives" layer — the place a thread graduates to when it's no longer a cold prospect but a real conversation.

## The core promise

**A salesperson never has to manually create a deal.** When an outbound email gets a reply, the system automatically:
1. Identifies the buyer company (Account) by sender domain
2. Identifies the human (Person) by sender address
3. Creates a Deal in stage **engaged**
4. Drops the Deal card onto a 5-stage kanban board

The salesperson's only job is to drag the card across the board (or let the Stage Classifier do that for them).

## Five-stage pipeline

```
engaged → in_conversation → negotiating → confirmed → contract
```

| Stage | Meaning | Created by |
|---|---|---|
| **engaged** | First inbound reply received. Deal exists but conversation has barely started. | Signal engine gate (mechanical) |
| **in_conversation** | Multi-message thread, real back-and-forth. | Stage classifier (LLM) |
| **negotiating** | Terms / price / scope are being discussed. | Stage classifier (LLM) |
| **confirmed** | Buyer has said yes verbally or in writing; contract not yet signed. | Stage classifier (LLM) |
| **contract** | Contract is being drafted / signed. After this the deal exits the pipeline to a downstream PO flow. | Stage classifier (LLM) or manual |

A deal can be **lost** from any stage. Lost deals keep their last stage for historical clarity; `lost_at` is a separate nullable timestamp column (orthogonal to `deal_stage`).

## Architecture sketch

```
        ┌─────────────────────────────────────────────────────────────┐
        │                       INGESTION                              │
        │                                                              │
        │   Unipile email account ──► backfill worker ──► messages    │
        │           │                  (12-month pull)        │         │
        │           └─► webhooks ─────────────────────────────┘         │
        │                                                              │
        │   inbox email ──► parse participants ──► upsert Account     │
        │                                          │                   │
        │                                          ▼                   │
        │                                       upsert Person          │
        │                                          │                   │
        │                                          ▼                   │
        │                                       upsert Contact         │
        │                                          │                   │
        │                                          ▼                   │
        │                                        Message               │
        └─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                  DEAL MATERIALIZATION                        │
        │                                                              │
        │   Signal Engine                                              │
        │     • outbound→inbound thread shape gate                     │
        │     • engagement floor (min messages)                        │
        │           │                                                  │
        │           ▼ (gate passes)                                    │
        │                                                              │
        │   Deal Materializer (mechanical, deterministic)              │
        │     • dedup on thread_external_id                            │
        │     • create deal in 'engaged'                               │
        │     • link deal_persons (champion = primary inbound human)   │
        │     • link deal_accounts (buyer = primary inbound domain)    │
        │     • crm_object_events: deal_created                        │
        │           │                                                  │
        │           ▼                                                  │
        │                                                              │
        │   Stage Classifier (LLM, refines stage only)                 │
        │     • Claude Sonnet 4.6 over message extraction              │
        │     • writes extraction_json on each message                 │
        │     • PATCH deal_stage if field_overrides doesn't lock it    │
        │     • crm_object_events: deal_stage_changed + confidence     │
        └─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                      KANBAN UI                               │
        │   5 columns • @dnd-kit drag • detail sheet                  │
        │   KPI strip • funnel histogram • lost / restore             │
        └─────────────────────────────────────────────────────────────┘
```

## Workspace-scoping invariant

Every CRM row carries `workspace_id`. Every query filters by it. Every unique index is partial-scoped to it. There is **no** row-level security in the source repo — isolation is enforced purely by application code, with the FK + cascade as the only DB-level guarantee. ([08-gaps-and-corrections.md](08-gaps-and-corrections.md) §2 recommends adding RLS in the rebuild.)

## What's in scope here vs. what isn't

**In scope (this blueprint covers):**
- Accounts / Persons / Contacts / Deals data model
- Email ingestion via Unipile (12-month backfill + webhook live ingest)
- Mechanical deal creation gated by signal engine
- LLM-driven stage classification
- Read-only 5-stage kanban with drag-and-drop stage changes
- Mark-as-lost / restore

**Not in scope (was planned but never shipped in source):**
- Sales Agent orchestrator + 6 sub-agents (`agent_actions`, `agent_audit_log` tables don't exist)
- 4 tabs (Today's Desk, Sent·Awaiting, Hold·Nurture — only Deal Pipeline tab exists)
- Inline edit on deal fields (BE only accepts `dealStage` mutations)
- Deal-level notes / assignee / tags / custom fields
- Segmentation filters beyond search + stage
- Bulk operations

**Should be added in rebuild (see [08](08-gaps-and-corrections.md)):**
- `deal.assignee_user_id`
- `deal.notes` text
- `deal_tags` join table
- Stage-classifier `extraction_json` writes (wired but never executes in source)
- RLS / IAM resources / tier_boundaries entries for CRM tables
- Stored `deal_id` on messages (instead of contact-traversal) so concurrent deals at one account don't share comms history
