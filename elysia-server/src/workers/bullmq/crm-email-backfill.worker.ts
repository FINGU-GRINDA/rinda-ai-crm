/**
 * CRM Email Backfill Worker — drains the BullMQ `crm-email-backfill` queue.
 *
 * Lifted from send-grid-test/elysia-server/src/workers/bullmq/crm-email-backfill.worker.ts.
 * Stripped telemetry (lib/health, services/job-log) — slice 1 logs via pino only.
 */

import { type Job, Worker } from "bullmq"
import {
  type CrmEmailBackfillJob,
  type CrmEmailBackfillResult,
  QUEUE_NAMES,
} from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import { processCrmEmailBackfill } from "../../services/crm/email-backfill.service"
import logger from "../../utils/logger"

const QUEUE_NAME = QUEUE_NAMES.CRM_EMAIL_BACKFILL
const WORKER_NAME = "crm-email-backfill-worker"

let worker: Worker<CrmEmailBackfillJob, CrmEmailBackfillResult> | null = null

async function processJob(
  job: Job<CrmEmailBackfillJob, CrmEmailBackfillResult>,
): Promise<CrmEmailBackfillResult> {
  const jobId = job.id || "unknown"
  logger.info(
    {
      jobId,
      workspaceId: job.data.workspaceId,
      emailAccountId: job.data.emailAccountId,
      monthsBack: job.data.monthsBack,
    },
    `[${WORKER_NAME}] Processing CRM email backfill`,
  )
  return processCrmEmailBackfill(job.data)
}

export function startCrmEmailBackfillWorker(): Worker<
  CrmEmailBackfillJob,
  CrmEmailBackfillResult
> | null {
  if (worker) {
    logger.warn(`[${WORKER_NAME}] Worker already running`)
    return worker
  }

  try {
    worker = new Worker<CrmEmailBackfillJob, CrmEmailBackfillResult>(QUEUE_NAME, processJob, {
      connection: createRedisConnection(),
      concurrency: 1,
    })

    worker.on("completed", (job, result) => {
      logger.info({ jobId: job.id, result }, `[${WORKER_NAME}] Job completed`)
    })

    worker.on("failed", (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          error: err.message,
          workspaceId: job?.data?.workspaceId,
          emailAccountId: job?.data?.emailAccountId,
        },
        `[${WORKER_NAME}] Job failed`,
      )
      // Service already writes status=failed inside its try/catch.
    })

    worker.on("error", (err) => {
      logger.error({ error: err.message, stack: err.stack }, `[${WORKER_NAME}] Worker error`)
    })

    logger.info({ queueName: QUEUE_NAME }, `[${WORKER_NAME}] Worker started`)
    return worker
  } catch (error) {
    logger.error({ error }, `[${WORKER_NAME}] Failed to start worker`)
    return null
  }
}

export async function stopCrmEmailBackfillWorker(): Promise<void> {
  if (!worker) return
  await worker.close()
  worker = null
  logger.info(`[${WORKER_NAME}] Worker stopped`)
}
