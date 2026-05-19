// BullMQ job and result types for the CRM queues.

export const QUEUE_NAMES = {
  CRM_EMAIL_BACKFILL: "crm-email-backfill",
  CRM_STAGE_CLASSIFY: "crm-stage-classify",
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// ---------- CRM Email Backfill ----------

export interface CrmEmailBackfillJob {
  workspaceId: string
  emailAccountId: string
  /** How many months back to pull. Default 12. */
  monthsBack?: number
}

export interface CrmEmailBackfillResult {
  success: boolean
  workspaceId: string
  emailAccountId: string
  pagesProcessed: number
  messagesProcessed: number
  messagesIngested: number
  error?: string
}

// ---------- CRM Stage Classify ----------

export interface CrmStageClassifyJob {
  workspaceId: string
  /** Provider thread id — the unit of classification. */
  threadExternalId: string
  /** Where the job was enqueued from. */
  reason: "backfill" | "reclassify_deploy" | "webhook"
}

export interface CrmStageClassifyResult {
  success: boolean
  workspaceId: string
  threadExternalId: string
  /** Newly created or existing deal id; null only when the thread was skipped. */
  dealId: string | null
  /** True when a fresh `deals` row was created on this run. */
  dealCreated: boolean
  /** One of the 5 pipeline stages, or null when skipped. */
  assignedStage: string | null
  /** Reason for skip when `dealId` is null. */
  skipReason?: string
  error?: string
}
