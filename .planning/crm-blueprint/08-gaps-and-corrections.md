# 08 — Gaps & Corrections

What's missing, broken, or done-but-better-done-differently in the source. **Grounded** in the source repo's own audit at [`docs/plans/rinda-sales-agent-deal-pipeline-gaps.md`](../plans/rinda-sales-agent-deal-pipeline-gaps.md) plus my read of the code. If you build all of these into the rebuild, you'll skip 3 weeks of follow-up cycles.

Priority tags follow the source's:
- **P0** — blocks Phase 1 user value (do this in the rebuild, don't defer)
- **P1** — blocks the "Sales Agent" framing
- **P2** — UX polish, can wait

---

## 1. Stage Classifier needs message bodies, but backfill doesn't fetch them

**P0.** Source: [`crm-email-backfill.service.ts:290`](../../elysia-server/src/services/crm/crm-email-backfill.service.ts#L290) — backfill passes `body: ""` because Unipile's listing endpoint returns metadata only and per-message body fetch would 100× the API cost.

**Effect**: the Stage Classifier sees subject + sender only on backfilled threads. It can't read "what's the MOQ?" inside a body and promote to `negotiating`. The §3.3+ stub flags stay false, the engine floor caps at `in_conversation`, and the classifier defaults to the floor.

**Fix in rebuild**: implement two-pass backfill:
1. Pass 1 (current behavior): list metadata-only, write `messages` rows with empty body.
2. Pass 2 (new): after each backfill page, enqueue a `crm-fetch-body` job per message id; the body-fetch worker calls Unipile's per-message endpoint and updates `messages.body`.

Rate-limit pass 2 at the Unipile per-account ceiling. For an existing workspace with 5,000 emails: 8 minutes at 10 req/sec.

Alternative: skip listing entirely; use Unipile's full-thread fetch which includes bodies. Higher cost per request but fewer total requests.

---

## 2. No IAM / RLS / tier_boundaries for CRM tables

**P0.** Source: zero `iam_resources` mappings for CRM; the `CRM` IAM resource constant exists but isn't seeded as a row policy. Migration 0374 explicitly *disabled* RLS on the deprecated `account_contacts` / `person_contacts` tables before dropping them. **No RLS exists on the live tables.**

**Effect**: workspace isolation is enforced 100% in application code. Any `WHERE workspace_id = $1` clause that gets forgotten leaks data across workspaces. The FK + cascade is the only DB-level guard.

**Fix in rebuild**: add RLS in [07 Phase 5b](07-build-order.md#5b-iam--rls) — enable RLS on every CRM table, write `using (workspace_id = current_setting('app.workspace_id')::uuid)` policies, set the session GUC from the auth context. Backstop the app-level filtering.

Also seed IAM policy rows for `CRM`, `CRM_DEAL`, `CRM_ACCOUNT` resources × `READ` / `WRITE` / `MANAGE` actions × `admin` / `member` / `viewer` roles. Source assumes them but they don't exist.

---

## 3. `deals` has no `assignee_user_id`

**P0.** No per-rep deal ownership in source. Every deal is visible to every workspace member with the appropriate tab access; there's no "my deals" view.

**Fix in rebuild**: add `deals.assignee_user_id uuid references users(id) on delete set null` in the initial migration. Wire `GET /crm/deals?assigneeUserId=me` (FE resolves "me" to current user id). Add a per-card avatar pill showing the assignee.

Auto-assign rule on deal materialization: assign to the rep whose email account the inbound message arrived on. The materializer can look this up by walking back from the outbound message to `user_email_accounts.user_id`.

---

## 4. PATCH endpoint only accepts `dealStage` + `lostAt`

**P0.** Source: [`crm-deals.routes.ts:120`](../../elysia-server/src/routes/crm/crm-deals.routes.ts#L120) — the body schema is `{ dealStage?, lostAt? }`. Detail sheet TODO at [`LeadDetailSheet.tsx:22`](../../admin/src/pages/leads/views/components/pipeline/LeadDetailSheet.tsx#L22):

```
TODO(PRD §6): re-enable inline edit for owner / notes / amount once the
Deal patch endpoint accepts those fields (currently dealStage only).
```

**Fix in rebuild**: from day one, accept `{ dealStage?, lostAt?, dealSize?, currency?, expectedCloseDate?, incoterms?, paymentTerms?, notes?, assigneeUserId?, tagIds? }`. Every editable field writes a `field_overrides[<field>] = { userId, timestamp }` entry, and the materializer's WHERE-clause safety check generalizes from `not (field_overrides ? 'deal_stage')` to "skip any field present in field_overrides".

Also expose `bulkUpdate` as `PATCH /crm/deals` with `{ ids: uuid[], patch: { ... } }`. Source has no bulk operations at all.

---

## 5. `CRM_RECLASSIFY_VERSION` env var is documented but never read

**P1.** Source: [`crm-backfill-progress.ts:64`](../../elysia-server/src/db/schema/crm-backfill-progress.ts#L64) header comment claims bumping `CRM_RECLASSIFY_VERSION` forces a global re-run, but the reclassify-on-deploy hook gates only on `reclassified_at IS NULL` — there's no version comparison.

**Fix in rebuild**: pick a mechanism, and actually wire it:
- Either: stamp `reclassified_at_version int` on the progress row, and gate `where reclassified_at_version < (env CRM_RECLASSIFY_VERSION)::int`
- Or: simpler — bump the env, and have the worker startup hook compare `process.env.CRM_RECLASSIFY_VERSION` against a `system_settings.crm_reclassify_version` row, reset all `reclassified_at` to null if it changed, then proceed.

---

## 6. Account history is fetched but not sent to the LLM prompt

**P1.** Source: [`stage-classifier.service.ts:219`](../../elysia-server/src/services/crm/stage-classifier.service.ts#L219) — `allAccountPersonIds` and `allAccountContactIds` are computed but the result is never injected into the LLM prompt. The prompt only contains the thread under classification.

**Effect**: per spec §7.11 #9, "a new Deal at an established Account should inherit pipeline maturity." Without account history in the prompt, the classifier treats every new thread at a known account as fresh.

**Fix in rebuild**: build an "Account history" section into the user prompt:

```
ACCOUNT: Acme Inc. (acme.com)
ACCOUNT HISTORY:
  - 3 existing deals (1 negotiating, 2 confirmed)
  - 5 prior threads with this account, total 47 messages
  - Last commercial signal across account: MOQ 5000 (2026-04-03)

THREAD UNDER CLASSIFICATION:
  ...
```

LLM cost increase is minor (a couple hundred extra tokens); classification quality at established accounts improves materially.

---

## 7. No folder filter (Spam / Promotions / Updates / Forums)

**P0.** Source ingests every Gmail folder. Newsletters and promotional emails create Accounts + Persons + Contacts they shouldn't.

**Fix in rebuild**: in the backfill page-fetch and webhook handler, skip messages whose Gmail label set intersects `{Spam, Promotions, Updates, Forums}`. Unipile passes labels through in the listing response.

---

## 8. No first-pass LLM filter (the "is this even a business conversation" classifier)

**P0.** Spec §4.2 Step 2.2 calls for a lightweight 3-label classifier (`business_conversation` / `newsletter_or_automated` / `personal_or_internal`) running BEFORE the engagement gate, to drop transactional / personal noise. Not built.

**Fix in rebuild**: a Haiku 4.5 call against subject + first 500 chars of body returning one of three labels. Caches per (workspace, thread) so subsequent messages on the same thread skip the re-classification.

Run before the engagement gate in `ingestEmail()`. `personal_or_internal` and `newsletter_or_automated` → return empty result, no CRM rows written.

Source's "Open Question Q1" is whether to use Haiku 4.5 vs Sonnet 4.6 for this; Haiku is the right answer (10× cheaper, accuracy gap is small for binary-ish classification).

---

## 9. Wave 2 schema (`agent_actions`, `agent_audit_log`) doesn't exist

**P1.** Spec §7.12–§7.13. Source has no tables, no service, no FE. The "Sales Agent" framing in the spec is entirely aspirational at v2.7.2.0 ship.

**Fix in rebuild**: include in initial schema migration so you don't have to retrofit. Even if you defer the orchestrator + sub-agents to Phase 6, having the tables present from day one means the audit log layer (every classifier verdict, every action) starts collecting data immediately.

See [07 Phase 6](07-build-order.md#phase-6--wave-2-sales-agent-was-never-built-in-source) for the deliverable list.

---

## 10. Concurrent deals at one Account share comms history

**P0–P1.** Source design decision: `messages` has no `deal_id` FK; per-deal message lists are computed by walking `deal_persons` / `deal_accounts` → `persons` / `accounts` → `contacts` → `messages`. When two Deals exist at the same Account (consortium, second-cycle re-engagement), they show the same message list.

[`crm-deals.ts:13–17`](../../elysia-server/src/db/schema/crm-deals.ts#L13) header explicitly documents this as a known MVP limitation.

**Fix in rebuild**: pick one:

**Option A** (cleanest): add `messages.deal_id uuid references deals(id) on delete set null`. The materializer sets it when materializing a Deal (back-fill all messages on the thread). Messages on a thread before a Deal is materialized have `deal_id = null`; the classifier sets them when it creates the Deal.

**Option B** (preserve message-shared semantics for some channels): add a `deal_messages` join table `(deal_id, message_id, workspace_id)`. Each Message can belong to multiple Deals — useful if a single email is genuinely about two deals.

Option A is simpler and matches industry conventions (Salesforce, HubSpot both put deal_id directly on activity records). Pick this unless you have a specific multi-deal-per-message use case.

---

## 11. Open / click webhooks don't re-invoke `ingestEmail()`

**P1.** Source: [`crm-ingestion.service.ts:261`](../../elysia-server/src/services/crm/crm-ingestion.service.ts#L261) header comment notes: "An open-tracking ping later in the lifecycle (after a cold send was skipped here) won't auto-retrigger ingestion."

**Effect**: a cold outbound that gets opened weeks later is permanently dropped from the CRM. The engagement gate locked out at send-time and never re-evaluates.

**Fix in rebuild**: when the open/click webhook fires for an outbound message that has no `messages` row yet (because it was filtered at send-time), invoke `ingestEmail()` retroactively. The original outbound's metadata is in the send-side `emails` table; the webhook handler reconstructs the DTO from there.

Alternative: don't gate at send-time at all — always write `messages` rows for outbound, and let the engagement gate apply only to the **deal materialization** step. Simpler, but produces more no-engagement messages in `messages` (acceptable storage cost).

---

## 12. No deal-level tags

**P2.** Source has `lead_tags` + `lead_tag_assignments` for leads, nothing for deals. Reps would tag deals as "Q3", "high-priority", "demo-done", etc.

**Fix in rebuild**: add `deal_tags` (workspace-scoped tag definitions) + `deal_tag_assignments` (M:M deal ↔ tag). Wire into:
- Detail sheet tag editor
- Kanban card tag pills
- Filter chip strip on kanban (`?tagId=...` server-side)

---

## 13. No deal custom fields

**P2.** Source has `field_overrides` (jsonb) for *standard* field protection but no concept of workspace-defined custom fields. A workspace can't add "regulatory body" or "competitor" as a tracked deal field.

**Fix in rebuild**: pick:

**Option A** (typed registry): `deal_custom_field_definitions` table `(id, workspace_id, key, label, field_type)` + `deal_custom_field_values` `(deal_id, definition_id, value_text / value_number / value_date)`. Strongly typed, queryable, more code.

**Option B** (JSONB): `deals.custom_fields jsonb default '{}'`. Workspace defines a schema doc in `workspace_settings`; FE renders fields from that schema. Less code, no queryability.

For Slice A scope, Option B is fine. If you want to filter the kanban by custom field values, you need Option A.

---

## 14. The "Lead → CRM conversion" path doesn't exist

**P0.** Source: not implemented. The current model is "all CRM rows come from email ingestion." There's no manual `POST /leads/:id/convert-to-crm` flow.

**Fix in rebuild**: add a conversion service that, in one transaction:
1. Reads the Lead row (`leads.id`)
2. Upserts an Account by lead's company domain
3. Upserts Persons + Contacts for each known channel on the lead
4. Inserts a Deal (initial stage from Stage Classifier over the Lead's prior comms history, or `engaged` if none)
5. Writes `crm_object_events` with `source_type = "lead"`, `source_ref_id = lead.id`
6. Stamps `leads.lead_status = 'converted'` and `leads.converted_at = NOW()`

Expose at `POST /api/v1/leads/:id/convert-to-crm` with `workspaceAuth`. Also auto-trigger from the Unipile webhook when an inbound message matches an unconverted lead's contact.

The reverse lookup ("what did this lead produce?") is the `crm_object_events_workspace_source_idx` index — already in source schema.

---

## 15. UX details that didn't ship (spec §8)

**P2.** Source spec lists these; source ships none of them:

- **Purple Jump button** per card (one-click execute primary agent action) — currently buried in `...` menu
- **Behavioral chips** on Engaged cards (`📧 opened 3×`, `🔗 clicked /pricing`, `📎 opened catalog.pdf`)
- **Reset-to-AI button** when `field_overrides.deal_stage` is set — clears override and triggers immediate re-classification
- **Onboarding banner**: "N deals were auto-imported from your last 12 months of email…"
- **Column header text** showing State condition + Action Plan per §8 #2

All of these depend on Phase 6 (Wave 2 / Sales Agent) being built first. Don't waste UI time on these until the orchestrator + sub-agents exist.

---

## 16. The 4-tab structure was never built

**P2.** Spec §2 calls for a `LeadsAICRMView` with four tabs: Today's Desk, Deal Pipeline, Sent·Awaiting, Hold·Nurture. Source ships only the Deal Pipeline tab (mounted at `/leads?view=deal-pipeline`).

**Fix in rebuild**: build the tab shell, but be honest about scope:
- Today's Desk = existing `SmartDailyBriefing` + `TodayActionStrip` lifted into the new shell
- Deal Pipeline = the kanban built in Phase 4
- Sent·Awaiting = list of outbound-only threads waiting for a reply (filter on `messages` direction inbound count = 0)
- Hold·Nurture = derived view of silent / long-Engaged deals (lost_at null + last inbound > N days + stage in `engaged`)

The latter two are simple queries against existing tables. Build the shell + tab metadata, then ship the empty Sent·Awaiting / Hold·Nurture as filters over the existing kanban data.

---

## Summary of what to do differently up-front

If you do nothing else from this doc, do these five things in the rebuild's initial schema and Phase 1 deliverables:

1. **Add RLS + IAM seeds** — workspace isolation as a DB invariant, not an app-code invariant
2. **Add `deals.assignee_user_id` + `deals.notes`** — per-rep ownership from day one
3. **Add `messages.deal_id`** — solve the "concurrent deals share comms" limitation upfront
4. **Add `agent_actions` + `agent_audit_log`** — even if the orchestrator comes later, the audit log starts collecting immediately
5. **Make PATCH `/crm/deals/:id` accept all editable fields** — unblocks inline edit in the detail sheet from launch

Everything else is incremental polish or feature work. These five are structural decisions that are hard to retrofit.

---

## Don't fix these — they're correct in source

For completeness, things one might think are gaps but actually aren't:

- **`extraction_json` IS written** — the earlier external audit report I read claimed it wasn't, but [`deal-materializer.service.ts:274`](../../elysia-server/src/services/crm/deal-materializer.service.ts#L274) clearly merges `classification.extractionJson` onto every message in the thread on first materialization. The source repo's own gaps doc at line 102 confirms this is shipped. (It's not written on *re-classification* of an existing deal, but that's fine — the original write was correct.)
- **`is_backfilled = true` IS set** — the materializer hardcodes `isBackfilled: true` on every classifier-created Deal ([`deal-materializer.service.ts:163`](../../elysia-server/src/services/crm/deal-materializer.service.ts#L163)). The source gaps doc claimed this was missing as of 2026-05-13; it may have been added later or simultaneously.
- **No-deal LLM exit** — earlier spec versions had the LLM return `no_deal`; final source removes that and just clamps to floor. The signal engine is sole authority; LLM never vetoes. This is correct.
- **Manual override protection** — `field_overrides.deal_stage` correctly survives classifier re-runs in all three materializer paths. Tested with WHERE-clause re-assertion to defeat read-committed races.
