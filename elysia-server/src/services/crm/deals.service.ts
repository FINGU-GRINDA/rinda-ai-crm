/**
 * CRM Deals Service — pure functions backing /api/v1/crm/deals* routes.
 *
 * Lifted from send-grid-test/elysia-server/src/services/crm/deals.service.ts.
 *
 * Read-side: keyset-paginated list / detail with primary account, primary
 * person, and last-message joins. Walks `crm_deal_persons ∪ crm_deal_accounts
 * → crm_persons → crm_contacts → crm_messages` for messages.
 *
 * Write-side: `updateDeal` runs UPDATE (deal_stage and/or lost_at) +
 * crm_object_events INSERT in one transaction. JSONB `field_overrides` is
 * mutated read-modify-write in JS (no `jsonb_set` wrapper exists in this repo).
 *
 * Workspace scoping is the caller's responsibility — every public function
 * takes `workspaceId` explicitly and filters all queries on it.
 */

import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm"
import { db } from "../../db"
import { crmBackfillProgress } from "../../db/schema/crm-backfill-progress"
import { accounts, contacts, persons } from "../../db/schema/crm-core"
import {
  type Deal,
  type DealFieldOverrides,
  type DealStage,
  dealAccounts,
  dealPersons,
  deals,
  messages,
} from "../../db/schema/crm-deals"
import { crmObjectEvents } from "../../db/schema/crm-events"
import { NotFoundError } from "../../utils/errors"

// ============================================================================
// Cursor helpers — composite `${ISOTimestamp}__${UUID}`.
// ============================================================================

export function parseDealsCursor(
  cursor: string | null | undefined,
): { ts: Date; id: string } | null {
  if (!cursor) return null
  if (!cursor.includes("__")) return null
  const [tsStr, idStr] = cursor.split("__")
  if (!(tsStr && idStr)) return null
  const ts = new Date(tsStr)
  if (Number.isNaN(ts.getTime())) return null
  return { ts, id: idStr }
}

function encodeDealsCursor(ts: Date, id: string): string {
  return `${ts.toISOString()}__${id}`
}

function clampLimit(raw: number | undefined): number {
  return Math.min(Math.max(raw ?? 50, 1), 200)
}

// ============================================================================
// Response shapes
// ============================================================================

export interface DealPrimaryAccount {
  id: string
  name: string
  domain: string | null
  country: string | null
  industry: string | null
  companySize: string | null
  buyerType: string | null
}

export interface DealPrimaryPerson {
  id: string
  fullName: string
  title: string | null
}

export interface DealLastMessage {
  id: string
  channel: string
  direction: "inbound" | "outbound"
  subject: string | null
  sentAt: string
}

export interface DealListItem {
  id: string
  dealStage: DealStage
  dealSize: string | null
  currency: string | null
  expectedCloseDate: string | null
  lostAt: string | null
  isBackfilled: boolean
  fieldOverrides: DealFieldOverrides
  createdAt: string
  updatedAt: string
  primaryAccount: DealPrimaryAccount | null
  primaryPerson: DealPrimaryPerson | null
  lastMessage: DealLastMessage | null
}

export interface DealAccountLink extends DealPrimaryAccount {
  role: string | null
  isPrimary: boolean
}

export interface DealPersonLink extends DealPrimaryPerson {
  role: string | null
  isPrimary: boolean
}

export interface MessageListItem {
  id: string
  channel: string
  direction: "inbound" | "outbound"
  subject: string | null
  body: string
  sentAt: string
  openedAt: string | null
  clickedAt: string | null
  repliedAt: string | null
  extractionJson: Record<string, unknown>
  contactId: string | null
  externalMessageId: string | null
  threadExternalId: string | null
  /** Slice 1: always null — externalThreadUrl requires a provider-thread-id column on emails. */
  externalThreadUrl: string | null
  contactName: string | null
  contactEmail: string | null
}

export interface DealDetail extends DealListItem {
  accounts: DealAccountLink[]
  persons: DealPersonLink[]
  recentMessages: MessageListItem[]
}

// ============================================================================
// List
// ============================================================================

export type DealLostFilter = "active" | "all" | "only"

export interface ListDealsParams {
  workspaceId: string
  dealStage?: DealStage
  isBackfilled?: boolean
  lostFilter?: DealLostFilter
  cursor?: string | null
  limit?: number
}

export interface ListDealsResult {
  items: DealListItem[]
  nextCursor: string | null
}

export async function listDeals(params: ListDealsParams): Promise<ListDealsResult> {
  const { workspaceId, dealStage, isBackfilled, cursor } = params
  const lostFilter: DealLostFilter = params.lostFilter ?? "active"
  const limit = clampLimit(params.limit)

  const conditions = [eq(deals.workspaceId, workspaceId)]
  if (dealStage) conditions.push(eq(deals.dealStage, dealStage))
  if (typeof isBackfilled === "boolean") conditions.push(eq(deals.isBackfilled, isBackfilled))
  if (lostFilter === "active") conditions.push(isNull(deals.lostAt))
  else if (lostFilter === "only") conditions.push(isNotNull(deals.lostAt))

  const parsed = parseDealsCursor(cursor)
  if (parsed) {
    const tieBreaker = or(
      lt(deals.createdAt, parsed.ts),
      and(eq(deals.createdAt, parsed.ts), lt(deals.id, parsed.id)),
    )
    if (tieBreaker) conditions.push(tieBreaker)
  }

  const rows = await db
    .select()
    .from(deals)
    .where(and(...conditions))
    .orderBy(desc(deals.createdAt), desc(deals.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows
  const last = trimmed[trimmed.length - 1]
  const nextCursor = hasMore && last ? encodeDealsCursor(last.createdAt, last.id) : null

  const items = await hydrateDealListItems(workspaceId, trimmed)
  return { items, nextCursor }
}

// ============================================================================
// Hydration — primary account / person / last message for a batch.
// ============================================================================

async function hydrateDealListItems(workspaceId: string, rows: Deal[]): Promise<DealListItem[]> {
  if (rows.length === 0) return []
  const dealIds = rows.map((r) => r.id)

  const primaryAccountRows = await db
    .select({
      dealId: dealAccounts.dealId,
      id: accounts.id,
      name: accounts.name,
      domain: accounts.domain,
      country: accounts.country,
      industry: accounts.industry,
      companySize: accounts.companySize,
      buyerType: accounts.buyerType,
    })
    .from(dealAccounts)
    .innerJoin(accounts, eq(accounts.id, dealAccounts.accountId))
    .where(
      and(
        eq(dealAccounts.workspaceId, workspaceId),
        inArray(dealAccounts.dealId, dealIds),
        eq(dealAccounts.isPrimary, true),
      ),
    )
  const primaryAccountByDeal = new Map<string, DealPrimaryAccount>()
  for (const r of primaryAccountRows) {
    primaryAccountByDeal.set(r.dealId, {
      id: r.id,
      name: r.name,
      domain: r.domain,
      country: r.country,
      industry: r.industry,
      companySize: r.companySize,
      buyerType: r.buyerType,
    })
  }

  const primaryPersonRows = await db
    .select({
      dealId: dealPersons.dealId,
      id: persons.id,
      fullName: persons.fullName,
      title: persons.title,
    })
    .from(dealPersons)
    .innerJoin(persons, eq(persons.id, dealPersons.personId))
    .where(
      and(
        eq(dealPersons.workspaceId, workspaceId),
        inArray(dealPersons.dealId, dealIds),
        eq(dealPersons.isPrimary, true),
      ),
    )
  const primaryPersonByDeal = new Map<string, DealPrimaryPerson>()
  for (const r of primaryPersonRows) {
    primaryPersonByDeal.set(r.dealId, { id: r.id, fullName: r.fullName, title: r.title })
  }

  const lastMessageByDeal = await fetchLastMessagePerDeal(workspaceId, dealIds)

  return rows.map((d) => ({
    id: d.id,
    dealStage: d.dealStage,
    dealSize: d.dealSize,
    currency: d.currency,
    expectedCloseDate: d.expectedCloseDate,
    lostAt: d.lostAt ? d.lostAt.toISOString() : null,
    isBackfilled: d.isBackfilled,
    fieldOverrides: d.fieldOverrides,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    primaryAccount: primaryAccountByDeal.get(d.id) ?? null,
    primaryPerson: primaryPersonByDeal.get(d.id) ?? null,
    lastMessage: lastMessageByDeal.get(d.id) ?? null,
  }))
}

// ============================================================================
// Last message per deal — walks deal_persons ∪ deal_accounts → persons → contacts → messages.
// ============================================================================

async function fetchLastMessagePerDeal(
  workspaceId: string,
  dealIds: string[],
): Promise<Map<string, DealLastMessage>> {
  if (dealIds.length === 0) return new Map()

  const dpRows = await db
    .select({ dealId: dealPersons.dealId, personId: dealPersons.personId })
    .from(dealPersons)
    .where(and(eq(dealPersons.workspaceId, workspaceId), inArray(dealPersons.dealId, dealIds)))

  const daRows = await db
    .select({ dealId: dealAccounts.dealId, accountId: dealAccounts.accountId })
    .from(dealAccounts)
    .where(and(eq(dealAccounts.workspaceId, workspaceId), inArray(dealAccounts.dealId, dealIds)))

  const accountIdsToDeals = new Map<string, string[]>()
  for (const r of daRows) {
    const list = accountIdsToDeals.get(r.accountId) ?? []
    list.push(r.dealId)
    accountIdsToDeals.set(r.accountId, list)
  }
  const accountIds = Array.from(accountIdsToDeals.keys())

  const accountPersonRows = accountIds.length
    ? await db
        .select({ id: persons.id, accountId: persons.accountId })
        .from(persons)
        .where(and(eq(persons.workspaceId, workspaceId), inArray(persons.accountId, accountIds)))
    : []

  const personsByDeal = new Map<string, Set<string>>()
  for (const r of dpRows) {
    const set = personsByDeal.get(r.dealId) ?? new Set<string>()
    set.add(r.personId)
    personsByDeal.set(r.dealId, set)
  }
  for (const r of accountPersonRows) {
    if (!r.accountId) continue
    const dealsForAccount = accountIdsToDeals.get(r.accountId) ?? []
    for (const dealId of dealsForAccount) {
      const set = personsByDeal.get(dealId) ?? new Set<string>()
      set.add(r.id)
      personsByDeal.set(dealId, set)
    }
  }

  const allPersonIds = Array.from(new Set([...personsByDeal.values()].flatMap((s) => [...s])))
  if (allPersonIds.length === 0) return new Map()

  const contactRows = await db
    .select({ id: contacts.id, personId: contacts.personId })
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), inArray(contacts.personId, allPersonIds)))
  const contactsByPerson = new Map<string, string[]>()
  for (const r of contactRows) {
    const list = contactsByPerson.get(r.personId) ?? []
    list.push(r.id)
    contactsByPerson.set(r.personId, list)
  }

  const allContactIds = contactRows.map((r) => r.id)
  if (allContactIds.length === 0) return new Map()

  const messageRows = await db
    .select({
      id: messages.id,
      contactId: messages.contactId,
      channel: messages.channel,
      direction: messages.direction,
      subject: messages.subject,
      sentAt: messages.sentAt,
    })
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), inArray(messages.contactId, allContactIds)))
    .orderBy(desc(messages.sentAt))

  const lastByDeal = new Map<string, DealLastMessage>()
  for (const m of messageRows) {
    if (!m.contactId) continue
    const personIdForContact = contactRows.find((c) => c.id === m.contactId)?.personId
    if (!personIdForContact) continue
    for (const [dealId, personSet] of personsByDeal.entries()) {
      if (!personSet.has(personIdForContact)) continue
      if (lastByDeal.has(dealId)) continue
      lastByDeal.set(dealId, {
        id: m.id,
        channel: m.channel,
        direction: m.direction,
        subject: m.subject,
        sentAt: m.sentAt.toISOString(),
      })
    }
  }
  return lastByDeal
}

// ============================================================================
// Detail
// ============================================================================

export async function getDealDetail(params: {
  workspaceId: string
  dealId: string
}): Promise<DealDetail> {
  const { workspaceId, dealId } = params
  const [row] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
    .limit(1)
  if (!row) throw new NotFoundError("deal_not_found")

  const [listItem] = await hydrateDealListItems(workspaceId, [row])
  if (!listItem) throw new NotFoundError("deal_not_found")

  const accountRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      domain: accounts.domain,
      country: accounts.country,
      industry: accounts.industry,
      companySize: accounts.companySize,
      buyerType: accounts.buyerType,
      role: dealAccounts.role,
      isPrimary: dealAccounts.isPrimary,
    })
    .from(dealAccounts)
    .innerJoin(accounts, eq(accounts.id, dealAccounts.accountId))
    .where(and(eq(dealAccounts.workspaceId, workspaceId), eq(dealAccounts.dealId, dealId)))

  const personRows = await db
    .select({
      id: persons.id,
      fullName: persons.fullName,
      title: persons.title,
      role: dealPersons.role,
      isPrimary: dealPersons.isPrimary,
    })
    .from(dealPersons)
    .innerJoin(persons, eq(persons.id, dealPersons.personId))
    .where(and(eq(dealPersons.workspaceId, workspaceId), eq(dealPersons.dealId, dealId)))

  const recentRaw = await listDealMessages({
    workspaceId,
    dealId,
    limit: 50,
  })

  return {
    ...listItem,
    accounts: accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
      country: a.country,
      industry: a.industry,
      companySize: a.companySize,
      buyerType: a.buyerType,
      role: a.role,
      isPrimary: a.isPrimary,
    })),
    persons: personRows.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      title: p.title,
      role: p.role,
      isPrimary: p.isPrimary,
    })),
    recentMessages: recentRaw.items,
  }
}

// ============================================================================
// PATCH — UPDATE (deal_stage and/or lost_at) + crm_object_events INSERT in one tx.
// ============================================================================

export async function updateDeal(params: {
  workspaceId: string
  dealId: string
  userId: string
  dealStage?: DealStage
  lostAtPatch: { value: string | null } | null
}): Promise<DealListItem> {
  const { workspaceId, dealId, userId, dealStage, lostAtPatch } = params

  await db.transaction(async (tx) => {
    // Row-lock for the duration of the transaction to serialize concurrent
    // PATCHes (rep drag + classifier-driven advance). field_overrides is JS
    // read-modify-write; without the lock, under READ COMMITTED both
    // transactions read the same baseline and the second clobbers the first.
    const [existing] = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
      .limit(1)
      .for("update")
    if (!existing) throw new NotFoundError("deal_not_found")

    const now = new Date()
    const updates: Record<string, unknown> = { updatedAt: now }
    const nextOverrides: DealFieldOverrides = { ...existing.fieldOverrides }
    const events: Array<{
      eventType: "deal_stage_changed" | "deal_lost_changed"
      metadata: Record<string, unknown>
    }> = []

    if (dealStage && dealStage !== existing.dealStage) {
      updates.dealStage = dealStage
      nextOverrides.deal_stage = { userId, timestamp: now.toISOString() }
      events.push({
        eventType: "deal_stage_changed",
        metadata: { from: existing.dealStage, to: dealStage },
      })
    }

    if (lostAtPatch) {
      const fromIso = existing.lostAt ? existing.lostAt.toISOString() : null
      if (lostAtPatch.value === null) {
        // Restore — only write if currently lost. A retried restore on an
        // already-active deal would otherwise log a bogus null→null event.
        if (existing.lostAt !== null) {
          updates.lostAt = null
          nextOverrides.lost_at = { userId, timestamp: now.toISOString() }
          events.push({
            eventType: "deal_lost_changed",
            metadata: { from: fromIso, to: null },
          })
        }
      } else {
        // Mark lost — only write if currently active. Re-marking an already
        // lost deal would otherwise re-stamp lostAt to a new time and produce
        // a spurious "lost→lost(now)" audit row. Server ignores any client
        // timestamp to prevent clock drift.
        if (existing.lostAt === null) {
          updates.lostAt = now
          nextOverrides.lost_at = { userId, timestamp: now.toISOString() }
          events.push({
            eventType: "deal_lost_changed",
            metadata: { from: fromIso, to: now.toISOString() },
          })
        }
      }
    }

    if (events.length > 0) {
      updates.fieldOverrides = nextOverrides
      await tx
        .update(deals)
        .set(updates)
        .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))

      for (const ev of events) {
        await tx.insert(crmObjectEvents).values({
          workspaceId,
          eventType: ev.eventType,
          targetType: "deal",
          targetId: dealId,
          sourceType: "manual",
          triggeredByUserId: userId,
          metadata: ev.metadata,
        })
      }
    }
  })

  // Re-query so joins reflect the new state.
  const [row] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
    .limit(1)
  if (!row) throw new NotFoundError("deal_not_found")
  const [item] = await hydrateDealListItems(workspaceId, [row])
  if (!item) throw new NotFoundError("deal_not_found")
  return item
}

// ============================================================================
// Messages by deal — walks deal_persons ∪ deal_accounts → persons → contacts → messages.
// ============================================================================

export interface ListDealMessagesParams {
  workspaceId: string
  dealId: string
  cursor?: string | null
  limit?: number
}

export interface ListDealMessagesResult {
  items: MessageListItem[]
  nextCursor: string | null
}

export async function listDealMessages(
  params: ListDealMessagesParams,
): Promise<ListDealMessagesResult> {
  const { workspaceId, dealId, cursor } = params
  const limit = clampLimit(params.limit)

  // Confirm deal exists in this workspace (don't leak cross-tenant message ids).
  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
    .limit(1)
  if (!deal) throw new NotFoundError("deal_not_found")

  const contactIds = await collectDealContactIds(workspaceId, dealId)
  if (contactIds.length === 0) return { items: [], nextCursor: null }

  const conditions = [
    eq(messages.workspaceId, workspaceId),
    inArray(messages.contactId, contactIds),
  ]
  const parsed = parseDealsCursor(cursor)
  if (parsed) {
    const tieBreaker = or(
      lt(messages.sentAt, parsed.ts),
      and(eq(messages.sentAt, parsed.ts), lt(messages.id, parsed.id)),
    )
    if (tieBreaker) conditions.push(tieBreaker)
  }

  const rows = await db
    .select({
      id: messages.id,
      contactId: messages.contactId,
      channel: messages.channel,
      direction: messages.direction,
      subject: messages.subject,
      body: messages.body,
      extractionJson: messages.extractionJson,
      sentAt: messages.sentAt,
      openedAt: messages.openedAt,
      clickedAt: messages.clickedAt,
      repliedAt: messages.repliedAt,
      externalMessageId: messages.externalMessageId,
      threadExternalId: messages.threadExternalId,
      contactKind: contacts.kind,
      contactValue: contacts.value,
      personFullName: persons.fullName,
    })
    .from(messages)
    .leftJoin(contacts, eq(contacts.id, messages.contactId))
    .leftJoin(persons, eq(persons.id, contacts.personId))
    .where(and(...conditions))
    .orderBy(desc(messages.sentAt), desc(messages.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows
  const last = trimmed[trimmed.length - 1]
  const nextCursor = hasMore && last ? encodeDealsCursor(last.sentAt, last.id) : null

  const items: MessageListItem[] = trimmed.map((m) => ({
    id: m.id,
    channel: m.channel,
    direction: m.direction,
    subject: m.subject,
    body: m.body,
    sentAt: m.sentAt.toISOString(),
    openedAt: m.openedAt ? m.openedAt.toISOString() : null,
    clickedAt: m.clickedAt ? m.clickedAt.toISOString() : null,
    repliedAt: m.repliedAt ? m.repliedAt.toISOString() : null,
    extractionJson: m.extractionJson,
    contactId: m.contactId,
    externalMessageId: m.externalMessageId,
    threadExternalId: m.threadExternalId,
    externalThreadUrl: null,
    contactName: m.personFullName,
    contactEmail: m.contactKind === "email" ? m.contactValue : null,
  }))
  return { items, nextCursor }
}

async function collectDealContactIds(workspaceId: string, dealId: string): Promise<string[]> {
  const directPersons = await db
    .select({ personId: dealPersons.personId })
    .from(dealPersons)
    .where(and(eq(dealPersons.workspaceId, workspaceId), eq(dealPersons.dealId, dealId)))

  const accountRows = await db
    .select({ accountId: dealAccounts.accountId })
    .from(dealAccounts)
    .where(and(eq(dealAccounts.workspaceId, workspaceId), eq(dealAccounts.dealId, dealId)))
  const accountIds = accountRows.map((r) => r.accountId)

  const accountPersonRows = accountIds.length
    ? await db
        .select({ id: persons.id })
        .from(persons)
        .where(and(eq(persons.workspaceId, workspaceId), inArray(persons.accountId, accountIds)))
    : []

  const personIds = Array.from(
    new Set<string>([
      ...directPersons.map((r) => r.personId),
      ...accountPersonRows.map((r) => r.id),
    ]),
  )
  if (personIds.length === 0) return []

  const contactRows = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), inArray(contacts.personId, personIds)))
  return contactRows.map((r) => r.id)
}

// ============================================================================
// Backfill runs (workspace-wide list)
// ============================================================================

export interface BackfillRunItem {
  /** crm_backfill_progress.id — opaque identifier for this run. */
  progressId: string
  status: string
  emailAccountId: string
  cursor: string | null
  monthsBack: number
  pagesProcessed: number
  messagesProcessed: number
  messagesIngested: number
  lastError: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}

export async function listBackfillRuns(params: {
  workspaceId: string
}): Promise<BackfillRunItem[]> {
  const { workspaceId } = params
  const rows = await db
    .select()
    .from(crmBackfillProgress)
    .where(eq(crmBackfillProgress.workspaceId, workspaceId))
    .orderBy(
      sql`${crmBackfillProgress.startedAt} DESC NULLS LAST`,
      desc(crmBackfillProgress.updatedAt),
    )

  return rows.map((row) => ({
    progressId: row.id,
    status: row.status,
    emailAccountId: row.emailAccountId,
    cursor: row.cursor,
    monthsBack: row.monthsBack,
    pagesProcessed: row.pagesProcessed,
    messagesProcessed: row.messagesProcessed,
    messagesIngested: row.messagesIngested,
    lastError: row.lastError,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  }))
}
