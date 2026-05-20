/**
 * CRM Email Backfill — pulls the last N months of email from the configured
 * provider (Gmail in slice 1) and feeds them through the CRM ingestion
 * service. Resumable: the worker stores a cursor on `crm_backfill_progress`
 * and resumes on retry.
 *
 * Lifted from send-grid-test/elysia-server/src/services/crm/crm-email-backfill.service.ts.
 * Adapted: `userEmailAccounts` lookups → `crmEmailConnections`; Unipile-specific
 * `listAccountEmailsPage` → provider-agnostic `EmailProvider.listPage()`.
 */

import { and, eq, inArray } from "drizzle-orm"
import { db } from "../../db"
import { crmBackfillProgress } from "../../db/schema/crm-backfill-progress"
import { messages } from "../../db/schema/crm-deals"
import { crmEmailConnections } from "../../db/schema/crm-email-connections"
import { addCrmStageClassifyJob } from "../../lib/queue/queues"
import type { CrmEmailBackfillJob, CrmEmailBackfillResult } from "../../lib/queue/types"
import logger from "../../utils/logger"
import { getEmailProvider, type MailboxEmail } from "./email-provider"
import { ingestEmail } from "./ingestion.service"

const PAGE_SIZE = 100
const MAX_PAGES_PER_RUN = 200

export async function processCrmEmailBackfill(
  data: CrmEmailBackfillJob,
): Promise<CrmEmailBackfillResult> {
  const { workspaceId, emailAccountId } = data
  // Match the route cap. Jobs enqueued without `monthsBack` (or with values
  // outside [1, 3]) get clamped here so the worker can't run a 12-month pull
  // that bypasses /backfill/start's Zod validation.
  const MIN_MONTHS = 1
  const MAX_MONTHS = 3
  const monthsBack = Math.max(MIN_MONTHS, Math.min(data.monthsBack ?? MAX_MONTHS, MAX_MONTHS))

  // 1. Load the connection so we know the provider + external account id.
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
    throw new Error(`crm-email-backfill: email connection ${emailAccountId} not found in workspace`)
  }
  const provider = getEmailProvider(connection.provider)

  // All rep email addresses in this workspace — used to label direction.
  // For Gmail-as-provider the externalAccountId IS the rep's email address.
  const repAccountRows = await db
    .select({ externalAccountId: crmEmailConnections.externalAccountId })
    .from(crmEmailConnections)
    .where(eq(crmEmailConnections.workspaceId, workspaceId))
  const repEmails = new Set(repAccountRows.map((r) => r.externalAccountId.toLowerCase()))

  // 2. Upsert progress row; resume cursor if it exists.
  const [progress] = await db
    .insert(crmBackfillProgress)
    .values({
      workspaceId,
      emailAccountId,
      status: "running",
      monthsBack,
      startedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [crmBackfillProgress.workspaceId, crmBackfillProgress.emailAccountId],
      set: {
        status: "running",
        lastError: null,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!progress) {
    throw new Error(`crm-email-backfill: progress upsert returned no row`)
  }

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
        .where(eq(crmBackfillProgress.id, progress.id))

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
      .where(eq(crmBackfillProgress.id, progress.id))

    // Fan out Stage Classifier jobs.
    if (threadsTouchedThisRun.size > 0) {
      let enqueued = 0
      for (const threadExternalId of threadsTouchedThisRun) {
        try {
          await addCrmStageClassifyJob({
            workspaceId,
            threadExternalId,
            reason: "backfill",
          })
          enqueued += 1
        } catch (err) {
          logger.warn(
            {
              workspaceId,
              threadExternalId,
              err: err instanceof Error ? err.message : String(err),
            },
            "[crm-email-backfill] Failed to enqueue stage-classify job",
          )
        }
      }
      logger.info(
        { workspaceId, emailAccountId, threadsTouched: threadsTouchedThisRun.size, enqueued },
        "[crm-email-backfill] Fanned out stage-classify jobs",
      )
    }

    return {
      success: true,
      workspaceId,
      emailAccountId,
      pagesProcessed: totalPagesProcessed,
      messagesProcessed: totalMessagesProcessed,
      messagesIngested: totalMessagesIngested,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(
      { workspaceId, emailAccountId, err: message },
      "[crm-email-backfill] processCrmEmailBackfill failed",
    )
    await db
      .update(crmBackfillProgress)
      .set({
        status: "failed",
        lastError: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(crmBackfillProgress.id, progress.id))
    return {
      success: false,
      workspaceId,
      emailAccountId,
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

  // Bulk-skip already-ingested provider ids.
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
        "[crm-email-backfill] ingestEmail failed for single email",
      )
    }
  }
  return { ingested, threadsTouched }
}
