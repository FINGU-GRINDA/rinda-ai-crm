/**
 * CRM Email Backfill — pulls N months of email from the configured provider
 * (Gmail in slice 1) and feeds them through the CRM ingestion service.
 *
 * Runs entirely in-process. `runBackfill(progressId)` is fire-and-forget
 * (callers don't await); state lives on the `crm_backfill_progress` row
 * (`status`, `cursor`, counters). Resumable on process restart via
 * `resumeRunningBackfills()` — finds `status='running'` rows whose worker
 * died and re-spawns them.
 *
 * Originally lifted from send-grid-test as a BullMQ worker; refactored away
 * from the queue per slice 1 Part IV migration plan.
 */

import { and, eq, inArray } from "drizzle-orm"
import { db } from "../../db"
import { crmBackfillProgress } from "../../db/schema/crm-backfill-progress"
import { messages } from "../../db/schema/crm-deals"
import { crmEmailConnections } from "../../db/schema/crm-email-connections"
import { fireAndForget } from "../../lib/job-runner"
import logger from "../../utils/logger"
import { enqueueClassify } from "./classify-runner"
import { getEmailProvider, type MailboxEmail } from "./email-provider"
import { ingestEmail } from "./ingestion.service"

const RUNNER_NAME = "crm-email-backfill"
const PAGE_SIZE = 100
const MAX_PAGES_PER_RUN = 200
const MIN_MONTHS = 1
const MAX_MONTHS = 3

/** Per-process dedup: one active run per `crm_backfill_progress.id`. */
const activeBackfills: Map<string, Promise<unknown>> = new Map()

export interface RunBackfillResult {
  success: boolean
  progressId: string
  pagesProcessed: number
  messagesProcessed: number
  messagesIngested: number
  error?: string
}

/**
 * Schedule a backfill run for an existing progress row, fire-and-forget.
 * Returns false if a run is already active for this progress row.
 */
export function scheduleBackfill(progressId: string): boolean {
  if (activeBackfills.has(progressId)) return false
  const promise = runBackfill(progressId).finally(() => {
    activeBackfills.delete(progressId)
  })
  activeBackfills.set(progressId, promise)
  fireAndForget(promise, `${RUNNER_NAME}:${progressId}`)
  return true
}

/**
 * Find any `crm_backfill_progress` rows still in `status='running'` (likely
 * orphaned by a previous process crash) and resume each one. Called from
 * `src/index.ts` after the server starts listening.
 */
export async function resumeRunningBackfills(): Promise<{ resumed: number }> {
  const rows = await db
    .select({ id: crmBackfillProgress.id })
    .from(crmBackfillProgress)
    .where(eq(crmBackfillProgress.status, "running"))

  let resumed = 0
  for (const row of rows) {
    if (scheduleBackfill(row.id)) resumed += 1
  }
  if (rows.length > 0) {
    logger.info({ found: rows.length, resumed }, `[${RUNNER_NAME}] Resumed running backfills`)
  }
  return { resumed }
}

async function runBackfill(progressId: string): Promise<RunBackfillResult> {
  // 1. Load progress row — drives workspace/connection/cursor recovery.
  const [progress] = await db
    .select()
    .from(crmBackfillProgress)
    .where(eq(crmBackfillProgress.id, progressId))
    .limit(1)

  if (!progress) {
    throw new Error(`${RUNNER_NAME}: progress row ${progressId} not found`)
  }
  const { workspaceId, emailAccountId } = progress
  const monthsBack = Math.max(MIN_MONTHS, Math.min(progress.monthsBack ?? MAX_MONTHS, MAX_MONTHS))

  // 2. Load the connection.
  const [connection] = await db
    .select({
      id: crmEmailConnections.id,
      provider: crmEmailConnections.provider,
      externalAccountId: crmEmailConnections.externalAccountId,
    })
    .from(crmEmailConnections)
    .where(
      and(
        eq(crmEmailConnections.id, emailAccountId),
        eq(crmEmailConnections.workspaceId, workspaceId),
      ),
    )
    .limit(1)

  if (!connection) {
    throw new Error(`${RUNNER_NAME}: connection ${emailAccountId} not found in workspace`)
  }
  const provider = getEmailProvider(connection.provider)

  // All rep email addresses in this workspace — used to label direction.
  const repAccountRows = await db
    .select({ externalAccountId: crmEmailConnections.externalAccountId })
    .from(crmEmailConnections)
    .where(eq(crmEmailConnections.workspaceId, workspaceId))
  const repEmails = new Set(repAccountRows.map((r) => r.externalAccountId.toLowerCase()))

  const after = new Date(Date.now() - monthsBack * 30 * 24 * 60 * 60 * 1000).toISOString()
  let cursor: string | null = progress.cursor ?? null

  let totalPagesProcessed = progress.pagesProcessed
  let totalMessagesProcessed = progress.messagesProcessed
  let totalMessagesIngested = progress.messagesIngested
  let pagesThisRun = 0

  const threadsTouchedThisRun = new Set<string>()

  try {
    while (pagesThisRun < MAX_PAGES_PER_RUN) {
      const page = await provider.listPage({
        accountId: connection.externalAccountId,
        after,
        cursor: cursor ?? undefined,
        limit: PAGE_SIZE,
      })

      if (page.items.length > 0) {
        const { ingested, threadsTouched } = await ingestPage({
          workspaceId,
          repEmails,
          items: page.items,
        })
        totalMessagesProcessed += page.items.length
        totalMessagesIngested += ingested
        for (const tid of threadsTouched) threadsTouchedThisRun.add(tid)
      }
      totalPagesProcessed += 1
      pagesThisRun += 1
      cursor = page.cursor

      await db
        .update(crmBackfillProgress)
        .set({
          cursor,
          pagesProcessed: totalPagesProcessed,
          messagesProcessed: totalMessagesProcessed,
          messagesIngested: totalMessagesIngested,
          updatedAt: new Date(),
        })
        .where(eq(crmBackfillProgress.id, progressId))

      if (cursor === null) break
    }

    const completed = cursor === null
    await db
      .update(crmBackfillProgress)
      .set({
        status: completed ? "completed" : "running",
        completedAt: completed ? new Date() : null,
        ...(completed ? { reclassifiedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(crmBackfillProgress.id, progressId))

    // Fan out Stage Classifier work. In-process — fire-and-forget under the
    // shared classifyLimiter (concurrency=4). Stable per-(workspace, thread)
    // dedup comes from `crm_deals_workspace_thread_uidx`; running the same
    // thread twice is cheap (idempotent materializer).
    if (threadsTouchedThisRun.size > 0) {
      for (const threadExternalId of threadsTouchedThisRun) {
        enqueueClassify({ workspaceId, threadExternalId, reason: "backfill" })
      }
      logger.info(
        { workspaceId, emailAccountId, threadsTouched: threadsTouchedThisRun.size },
        `[${RUNNER_NAME}] Dispatched classify tasks`,
      )
    }

    return {
      success: true,
      progressId,
      pagesProcessed: totalPagesProcessed,
      messagesProcessed: totalMessagesProcessed,
      messagesIngested: totalMessagesIngested,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(
      { workspaceId, emailAccountId, err: message },
      `[${RUNNER_NAME}] runBackfill failed`,
    )
    await db
      .update(crmBackfillProgress)
      .set({
        status: "failed",
        lastError: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(crmBackfillProgress.id, progressId))
    return {
      success: false,
      progressId,
      pagesProcessed: totalPagesProcessed,
      messagesProcessed: totalMessagesProcessed,
      messagesIngested: totalMessagesIngested,
      error: message,
    }
  }
}

async function ingestPage(args: {
  workspaceId: string
  repEmails: Set<string>
  items: MailboxEmail[]
}): Promise<{ ingested: number; threadsTouched: Set<string> }> {
  const { workspaceId, repEmails, items } = args

  const providerIds = items.map((it) => it.id).filter((v): v is string => Boolean(v))
  const existing = providerIds.length
    ? await db
        .select({ externalMessageId: messages.externalMessageId })
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            inArray(messages.externalMessageId, providerIds),
          ),
        )
    : []
  const existingIds = new Set(
    existing.map((r) => r.externalMessageId).filter((v): v is string => Boolean(v)),
  )

  let ingested = 0
  const threadsTouched = new Set<string>()
  for (const item of items) {
    const providerId = item.id
    if (!providerId) continue
    if (existingIds.has(providerId)) {
      if (item.threadId) threadsTouched.add(item.threadId)
      continue
    }
    const fromAddr = item.from?.identifier?.toLowerCase()?.trim()
    if (!fromAddr) continue
    const direction: "inbound" | "outbound" = repEmails.has(fromAddr) ? "outbound" : "inbound"
    const toAddr = item.to[0]?.identifier?.toLowerCase()?.trim() ?? null
    const ccAddrs = item.cc
      .map((a) => a.identifier?.toLowerCase()?.trim())
      .filter((v): v is string => Boolean(v))

    if (!toAddr) continue
    const sentAt = item.date ? new Date(item.date) : new Date()

    try {
      const result = await ingestEmail({
        workspaceId,
        message: {
          externalMessageId: providerId,
          threadExternalId: item.threadId ?? null,
          direction,
          fromEmail: fromAddr,
          toEmail: toAddr,
          ccEmails: ccAddrs.length > 0 ? ccAddrs : null,
          subject: item.subject ?? null,
          // Slice A — body not fetched during backfill.
          body: "",
          sentAt,
        },
      })
      if (result.messageId !== null) ingested += 1
      if (item.threadId) threadsTouched.add(item.threadId)
    } catch (err) {
      logger.warn(
        { workspaceId, providerId, err: err instanceof Error ? err.message : String(err) },
        `[${RUNNER_NAME}] ingestEmail failed for single email`,
      )
    }
  }
  return { ingested, threadsTouched }
}
