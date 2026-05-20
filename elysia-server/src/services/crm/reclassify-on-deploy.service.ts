/**
 * Reclassify-on-deploy — one-shot sweep that classifies threads in workspaces
 * whose backfill completed BEFORE the Stage Classifier shipped.
 *
 * Lifted verbatim from send-grid-test/elysia-server/src/services/crm/reclassify-on-deploy.service.ts.
 *
 * Trigger: invoked from `worker.ts` after BullMQ workers are up. Reads every
 * `crm_backfill_progress` row where `status='completed' AND reclassified_at IS
 * NULL`, finds threads in that workspace that have no Deal yet, enqueues
 * classify jobs at ≤4/sec/workspace.
 *
 * Idempotent at three layers: (1) reclassified_at timestamp, (2) BullMQ jobId
 * dedupe, (3) the partial-unique on `crm_deals`.
 */

import { and, eq, isNull, or, sql } from "drizzle-orm"
import { db } from "../../db"
import { crmBackfillProgress } from "../../db/schema/crm-backfill-progress"
import { deals, messages } from "../../db/schema/crm-deals"
import { addCrmStageClassifyJob } from "../../lib/queue/queues"
import logger from "../../utils/logger"

/** ≤4 classify jobs per second per workspace to keep Anthropic budget linear. */
const ENQUEUE_STAGGER_MS = 250

export async function runReclassifyOnDeploy(): Promise<{
  workspacesScanned: number
  threadsEnqueued: number
}> {
  const candidates = await db
    .select({ workspaceId: crmBackfillProgress.workspaceId })
    .from(crmBackfillProgress)
    .where(
      and(eq(crmBackfillProgress.status, "completed"), isNull(crmBackfillProgress.reclassifiedAt)),
    )

  if (candidates.length === 0) {
    logger.info("[reclassify-on-deploy] No candidate workspaces — nothing to do")
    return { workspacesScanned: 0, threadsEnqueued: 0 }
  }

  const workspaceIds = Array.from(new Set(candidates.map((c) => c.workspaceId)))

  logger.info(
    { workspacesScanned: workspaceIds.length },
    "[reclassify-on-deploy] Scanning workspaces for unclassified threads",
  )

  let totalEnqueued = 0
  for (const workspaceId of workspaceIds) {
    try {
      const enqueued = await reclassifyWorkspace(workspaceId)
      totalEnqueued += enqueued
    } catch (err) {
      logger.error(
        { workspaceId, err: err instanceof Error ? err.message : String(err) },
        "[reclassify-on-deploy] Failed to reclassify workspace",
      )
    }
  }

  return { workspacesScanned: workspaceIds.length, threadsEnqueued: totalEnqueued }
}

export async function reclassifyWorkspace(workspaceId: string): Promise<number> {
  // Distinct threads in this workspace that need (re-)classification.
  // Includes:
  //   (a) threads with NO Deal — first-time classification
  //   (b) threads whose Deal was classifier-created (is_backfilled=true)
  // Excludes manual Deals (is_backfilled=false).
  const unclassifiedThreads = await db
    .selectDistinct({ threadExternalId: messages.threadExternalId })
    .from(messages)
    .leftJoin(
      deals,
      and(
        eq(deals.workspaceId, messages.workspaceId),
        eq(deals.threadExternalId, messages.threadExternalId),
      ),
    )
    .where(
      and(
        eq(messages.workspaceId, workspaceId),
        sql`${messages.threadExternalId} IS NOT NULL`,
        or(isNull(deals.id), eq(deals.isBackfilled, true)),
      ),
    )

  if (unclassifiedThreads.length === 0) {
    // Stamp anyway so we don't re-scan forever.
    await db
      .update(crmBackfillProgress)
      .set({ reclassifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmBackfillProgress.workspaceId, workspaceId))
    logger.info(
      { workspaceId },
      "[reclassify-on-deploy] Workspace has no unclassified threads — stamped",
    )
    return 0
  }

  let enqueued = 0
  let i = 0
  for (const row of unclassifiedThreads) {
    const tid = row.threadExternalId
    if (!tid) continue
    try {
      await addCrmStageClassifyJob(
        { workspaceId, threadExternalId: tid, reason: "reclassify_deploy" },
        { delayMs: i * ENQUEUE_STAGGER_MS },
      )
      enqueued += 1
      i += 1
    } catch (err) {
      logger.warn(
        {
          workspaceId,
          threadExternalId: tid,
          err: err instanceof Error ? err.message : String(err),
        },
        "[reclassify-on-deploy] Failed to enqueue thread",
      )
    }
  }

  await db
    .update(crmBackfillProgress)
    .set({ reclassifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(crmBackfillProgress.workspaceId, workspaceId))

  logger.info(
    { workspaceId, threadsFound: unclassifiedThreads.length, enqueued },
    "[reclassify-on-deploy] Enqueued classify jobs for workspace",
  )
  return enqueued
}
