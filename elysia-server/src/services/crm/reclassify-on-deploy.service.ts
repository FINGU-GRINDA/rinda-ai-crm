/**
 * Reclassify-on-deploy — one-shot sweep that classifies threads in workspaces
 * whose backfill completed BEFORE the Stage Classifier shipped.
 *
 * In-process variant of the original BullMQ-enqueueing sweep. Each thread
 * dispatch goes through `enqueueClassify`, which is concurrency-bounded
 * (Semaphore<4>) — so the 250ms stagger here is mostly cosmetic now, but
 * preserves the original ≤4/sec/workspace shape so we don't blast Anthropic
 * with bursts when a workspace has thousands of unclassified threads.
 *
 * Idempotent: `reclassified_at` timestamp gates re-runs; the partial-unique
 * on `crm_deals(workspace_id, thread_external_id)` makes the actual
 * materialization idempotent regardless.
 */

import { and, eq, isNull, or, sql } from "drizzle-orm"
import { db } from "../../db"
import { crmBackfillProgress } from "../../db/schema/crm-backfill-progress"
import { deals, messages } from "../../db/schema/crm-deals"
import logger from "../../utils/logger"
import { enqueueClassify } from "./classify-runner"

/** ≤4 classify jobs per second per workspace. Stagger gap, in ms. */
const ENQUEUE_STAGGER_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  for (const row of unclassifiedThreads) {
    const tid = row.threadExternalId
    if (!tid) continue
    try {
      enqueueClassify({ workspaceId, threadExternalId: tid, reason: "reclassify_deploy" })
      enqueued += 1
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
    // Stagger dispatch so we don't blast Anthropic with N parallel calls
    // before the classify limiter applies backpressure.
    if (enqueued % 4 === 0) await sleep(ENQUEUE_STAGGER_MS)
  }

  await db
    .update(crmBackfillProgress)
    .set({ reclassifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(crmBackfillProgress.workspaceId, workspaceId))

  logger.info(
    { workspaceId, threadsFound: unclassifiedThreads.length, enqueued },
    "[reclassify-on-deploy] Dispatched classify tasks for workspace",
  )
  return enqueued
}
