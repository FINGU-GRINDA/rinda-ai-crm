import { Queue } from "bullmq"
import logger from "../../utils/logger"
import { redisConnection } from "../redis/connection"
import {
  type CrmEmailBackfillJob,
  type CrmEmailBackfillResult,
  type CrmStageClassifyJob,
  type CrmStageClassifyResult,
  QUEUE_NAMES,
} from "./types"

// ============================================================================
// CRM Email Backfill Queue
//
// Manual `/api/v1/crm/backfill/start` endpoint enqueues. Dedupe via stable
// jobId — concurrency=1 per (workspace, email account).
// ============================================================================

export const crmEmailBackfillQueue = new Queue<CrmEmailBackfillJob, CrmEmailBackfillResult>(
  QUEUE_NAMES.CRM_EMAIL_BACKFILL,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential" as const, delay: 60_000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
)

export function crmEmailBackfillJobId(workspaceId: string, emailAccountId: string): string {
  return `crm-backfill-${workspaceId}-${emailAccountId}`
}

export async function addCrmEmailBackfillJob(data: CrmEmailBackfillJob): Promise<string> {
  const jobId = crmEmailBackfillJobId(data.workspaceId, data.emailAccountId)
  const existing = await crmEmailBackfillQueue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === "active" || state === "waiting" || state === "delayed") {
      logger.info(
        { workspaceId: data.workspaceId, emailAccountId: data.emailAccountId, jobId, state },
        "[CrmEmailBackfill] Skipping enqueue — same account job already in flight",
      )
      return jobId
    }
    try {
      await existing.remove()
    } catch (error) {
      logger.warn(
        { workspaceId: data.workspaceId, jobId, error },
        "[CrmEmailBackfill] Failed to drop stale job before re-enqueue",
      )
    }
  }
  await crmEmailBackfillQueue.add("crm-backfill", data, { jobId })
  return jobId
}

// ============================================================================
// CRM Stage Classifier Queue
//
// One job per (workspace, thread). Anthropic Sonnet 4.6 → 5-stage classification
// → idempotent deal materialization. 3 attempts with exponential 30s backoff.
// Worker-side concurrency is 4.
// ============================================================================

export const crmStageClassifyQueue = new Queue<CrmStageClassifyJob, CrmStageClassifyResult>(
  QUEUE_NAMES.CRM_STAGE_CLASSIFY,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
)

export function crmStageClassifyJobId(workspaceId: string, threadExternalId: string): string {
  return `crm-stage-classify-${workspaceId}-${threadExternalId}`
}

export async function addCrmStageClassifyJob(
  data: CrmStageClassifyJob,
  options?: { delayMs?: number },
): Promise<string> {
  const jobId = crmStageClassifyJobId(data.workspaceId, data.threadExternalId)
  const existing = await crmStageClassifyQueue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === "active" || state === "waiting" || state === "delayed") {
      // Same thread already in flight — let it complete. The classifier reads
      // the latest thread state when it runs, so a new message arriving while
      // the previous job is in flight is implicitly absorbed.
      return jobId
    }
    try {
      await existing.remove()
    } catch (error) {
      logger.warn(
        { workspaceId: data.workspaceId, threadExternalId: data.threadExternalId, jobId, error },
        "[CrmStageClassify] Failed to drop stale job before re-enqueue",
      )
    }
  }
  await crmStageClassifyQueue.add("crm-stage-classify", data, {
    jobId,
    ...(options?.delayMs ? { delay: options.delayMs } : {}),
  })
  return jobId
}

// ============================================================================
// Shutdown helper
// ============================================================================

export async function closeCrmQueues(): Promise<void> {
  await Promise.all([crmEmailBackfillQueue.close(), crmStageClassifyQueue.close()])
}
