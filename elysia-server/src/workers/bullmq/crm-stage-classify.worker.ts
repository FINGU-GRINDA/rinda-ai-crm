/**
 * CRM Stage Classifier Worker — drains the `crm-stage-classify` queue.
 *
 * Lifted from send-grid-test/elysia-server/src/workers/bullmq/crm-stage-classify.worker.ts.
 * Stripped telemetry (lib/health, services/job-log) — slice 1 logs via pino only.
 *
 * One job per (workspace, thread): runs Claude Sonnet 4.6 against the thread,
 * then materializes a `crm_deals` row (idempotent on the partial unique).
 * Concurrency=4 keeps Anthropic burst budget under control.
 */

import { type Job, Worker } from "bullmq"
import {
  type CrmStageClassifyJob,
  type CrmStageClassifyResult,
  QUEUE_NAMES,
} from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import {
  cleanupRejectedDeal,
  materializeDealFromClassification,
} from "../../services/crm/deal-materializer.service"
import { classifyThread } from "../../services/crm/stage-classifier.service"
import logger from "../../utils/logger"

const QUEUE_NAME = QUEUE_NAMES.CRM_STAGE_CLASSIFY
const WORKER_NAME = "crm-stage-classify-worker"
const WORKER_CONCURRENCY = 4

let worker: Worker<CrmStageClassifyJob, CrmStageClassifyResult> | null = null

export async function processCrmStageClassifyJob(
  job: Job<CrmStageClassifyJob, CrmStageClassifyResult>,
): Promise<CrmStageClassifyResult> {
  const jobId = job.id || "unknown"
  const { workspaceId, threadExternalId, reason } = job.data

  logger.info(
    { jobId, workspaceId, threadExternalId, reason },
    `[${WORKER_NAME}] Classifying thread`,
  )

  const classification = await classifyThread({ workspaceId, threadExternalId })

  if (classification.assignedStage === null) {
    // classifier_error → throw so BullMQ retry kicks in.
    if (classification.skipReason === "classifier_error") {
      logger.warn(
        {
          workspaceId,
          threadExternalId,
          reason,
          skipReason: classification.skipReason,
          message: classification.message,
        },
        `[${WORKER_NAME}] Transient classifier failure — throwing for BullMQ retry`,
      )
      throw new Error(`classifier_error: ${classification.message}`)
    }

    // For thread-eligibility rejections, clean up any pre-existing backfilled deal.
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

    logger.info(
      {
        workspaceId,
        threadExternalId,
        reason,
        skipReason: classification.skipReason,
        message: classification.message,
        cleanupDeleted,
      },
      `[${WORKER_NAME}] Skipped — ${classification.skipReason}`,
    )
    return {
      success: true,
      workspaceId,
      threadExternalId,
      dealId: null,
      dealCreated: false,
      assignedStage: null,
      skipReason: classification.skipReason,
    }
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
    `[${WORKER_NAME}] Materialized deal`,
  )

  return {
    success: true,
    workspaceId,
    threadExternalId,
    dealId,
    dealCreated: created,
    assignedStage: classification.assignedStage,
  }
}

export function startCrmStageClassifyWorker(): Worker<
  CrmStageClassifyJob,
  CrmStageClassifyResult
> | null {
  if (worker) {
    logger.warn(`[${WORKER_NAME}] Worker already running`)
    return worker
  }

  try {
    worker = new Worker<CrmStageClassifyJob, CrmStageClassifyResult>(
      QUEUE_NAME,
      processCrmStageClassifyJob,
      {
        connection: createRedisConnection(),
        concurrency: WORKER_CONCURRENCY,
      },
    )

    worker.on("completed", (job, result) => {
      logger.info({ jobId: job.id, result }, `[${WORKER_NAME}] Job completed`)
    })

    worker.on("failed", (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          error: err.message,
          workspaceId: job?.data?.workspaceId,
          threadExternalId: job?.data?.threadExternalId,
        },
        `[${WORKER_NAME}] Job failed`,
      )
    })

    worker.on("error", (err) => {
      logger.error({ error: err.message, stack: err.stack }, `[${WORKER_NAME}] Worker error`)
    })

    logger.info(
      { queueName: QUEUE_NAME, concurrency: WORKER_CONCURRENCY },
      `[${WORKER_NAME}] Worker started`,
    )
    return worker
  } catch (error) {
    logger.error({ error }, `[${WORKER_NAME}] Failed to start worker`)
    return null
  }
}

export async function stopCrmStageClassifyWorker(): Promise<void> {
  if (!worker) return
  await worker.close()
  worker = null
  logger.info(`[${WORKER_NAME}] Worker stopped`)
}
