/**
 * In-process classifier dispatch — replaces the BullMQ classify worker.
 *
 * `enqueueClassify` is fire-and-forget. It runs `classifyThread` →
 * (materialize or cleanup) gated by a module-scope Semaphore that mirrors
 * the old worker concurrency=4. There is no outer retry; transient
 * Anthropic 5xx is already absorbed by `callAIObject`'s 2-attempt inner
 * retry. Permanent failures are logged.
 */

import { fireAndForget, Semaphore } from "../../lib/job-runner"
import logger from "../../utils/logger"
import { cleanupRejectedDeal, materializeDealFromClassification } from "./deal-materializer.service"
import { classifyThread } from "./stage-classifier.service"

const RUNNER_NAME = "crm-classify-runner"
const CONCURRENCY = 4
const classifyLimiter = new Semaphore(CONCURRENCY)

export type ClassifyReason = "backfill" | "reclassify_deploy" | "webhook"

export interface EnqueueClassifyParams {
  workspaceId: string
  threadExternalId: string
  reason: ClassifyReason
}

/**
 * Schedule classification for a thread. Returns immediately; the work runs
 * in the background under `classifyLimiter`. Tracked in `inFlight` so
 * shutdown can drain it.
 */
export function enqueueClassify(params: EnqueueClassifyParams): void {
  const { workspaceId, threadExternalId, reason } = params
  fireAndForget(
    classifyLimiter.run(() => processClassify(workspaceId, threadExternalId, reason)),
    `${RUNNER_NAME}:${workspaceId}:${threadExternalId}`,
  )
}

async function processClassify(
  workspaceId: string,
  threadExternalId: string,
  reason: ClassifyReason,
): Promise<void> {
  logger.info({ workspaceId, threadExternalId, reason }, `[${RUNNER_NAME}] Classifying thread`)

  const classification = await classifyThread({ workspaceId, threadExternalId })

  if (classification.assignedStage === null) {
    // For thread-eligibility rejections (gate changed under us), clean up
    // any pre-existing backfilled deal so the kanban doesn't show stale cards.
    let cleanupDeleted = false
    if (
      classification.skipReason === "not_outbound_initiated" ||
      classification.skipReason === "not_about_business"
    ) {
      const cleanup = await cleanupRejectedDeal({
        workspaceId,
        threadExternalId,
        rejectionReason: classification.skipReason,
      })
      cleanupDeleted = cleanup.deleted
    }

    // `classifier_error` was an outer-retry trigger under BullMQ. With the
    // in-process runner we have no outer retry — log loudly so ops can
    // re-trigger via the reclassify sweep / repair endpoint.
    if (classification.skipReason === "classifier_error") {
      logger.error(
        {
          workspaceId,
          threadExternalId,
          reason,
          skipReason: classification.skipReason,
          message: classification.message,
        },
        `[${RUNNER_NAME}] Classifier failed permanently — thread left unclassified`,
      )
      return
    }

    logger.info(
      {
        workspaceId,
        threadExternalId,
        reason,
        skipReason: classification.skipReason,
        message: classification.message,
        cleanupDeleted,
      },
      `[${RUNNER_NAME}] Skipped — ${classification.skipReason}`,
    )
    return
  }

  const { dealId, created } = await materializeDealFromClassification({
    workspaceId,
    threadExternalId,
    classification,
  })

  logger.info(
    {
      workspaceId,
      threadExternalId,
      dealId,
      created,
      stage: classification.assignedStage,
      confidence: classification.confidenceScore,
      signals: classification.detectedSignals,
      rationale: classification.rationaleText,
      reason,
    },
    `[${RUNNER_NAME}] Materialized deal`,
  )
}
