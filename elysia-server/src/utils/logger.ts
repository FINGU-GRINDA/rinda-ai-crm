import pino from "pino"
import { config, isProduction, NODE_ENV } from "../config"

/**
 * ============================================================================
 * LOGGING STANDARDS - Based on Global IT Best Practices
 * ============================================================================
 *
 * References:
 * - Google Cloud Logging: https://cloud.google.com/logging/docs/structured-logging
 * - Uber's logging practices: https://eng.uber.com/distributed-tracing/
 * - Datadog logging best practices
 * - OpenTelemetry semantic conventions
 *
 * ============================================================================
 * LOG LEVELS GUIDELINE
 * ============================================================================
 *
 * | Level  | When to Use                                              | Production |
 * |--------|----------------------------------------------------------|------------|
 * | fatal  | System is unusable, immediate attention required         | Always     |
 * | error  | Operation failed, requires investigation                 | Always     |
 * | warn   | Unexpected behavior, but operation continues             | Always     |
 * | info   | Business-critical events only (start/end of operations)  | Always     |
 * | debug  | Detailed operational info for troubleshooting            | On-demand  |
 * | trace  | Very detailed debugging, high-volume data                | Never      |
 *
 * ============================================================================
 * REQUIRED FIELDS (Always include in structured logs)
 * ============================================================================
 *
 * | Field          | Description                    | Example                    |
 * |----------------|--------------------------------|----------------------------|
 * | traceId        | Distributed trace ID           | "abc123-def456"            |
 * | spanId         | Current operation span         | "span-001"                 |
 * | service        | Service name                   | "elysia-server"            |
 * | component      | Component/module name          | "email-worker"             |
 * | operation      | Operation being performed      | "send_email"               |
 * | status         | success/failure/pending        | "success"                  |
 * | durationMs     | Operation duration             | 150                        |
 *
 * ============================================================================
 * WHAT TO LOG vs WHAT NOT TO LOG
 * ============================================================================
 *
 * DO LOG (info level):
 * - Operation start/completion with summary
 * - Business metrics (counts, totals)
 * - State transitions
 * - External API calls (summarized)
 * - Errors and warnings
 *
 * DON'T LOG (or use debug/trace):
 * - Intermediate processing steps
 * - Full request/response bodies
 * - Individual items in batch operations
 * - Cache hits (unless debugging)
 * - Successful DB queries (unless slow)
 *
 * ============================================================================
 * BATCH OPERATION LOGGING PATTERN
 * ============================================================================
 *
 * BAD (too verbose):
 *   Processing item 1... done
 *   Processing item 2... done
 *   ... (x100)
 *
 * GOOD (summary only):
 *   Batch processed: 100 items, 95 success, 5 failed, 1500ms
 *
 * ============================================================================
 */

// ============================================================================
// CORE LOGGER SETUP
// ============================================================================

export const logger = pino({
  level: config.LOGGING_LEVEL,

  // Docker-style compact logging in development, JSON in production
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: true,
          messageFormat: "{msg}",
        },
      }
    : undefined,

  // Add service context (only in production)
  base: isProduction
    ? {
        env: NODE_ENV,
        service: "elysia-server",
      }
    : undefined,

  // Format log levels
  formatters: {
    level: (label) => ({ level: label }),
  },

  // Redact sensitive information
  redact: {
    paths: [
      "password",
      "passwordHash",
      "apiKey",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "*.password",
      "*.passwordHash",
      "*.apiKey",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.authorization",
      "req.headers.authorization",
      "headers.authorization",
      // Email content should not be logged
      "*.html",
      "*.htmlBody",
      "*.textBody",
      "email",
      "fullBody",
      "rawEmail",
    ],
    censor: "[REDACTED]",
  },
})

// ============================================================================
// TRACE CONTEXT MANAGEMENT
// ============================================================================

/**
 * Generate a unique trace ID for distributed tracing
 */
export const generateTraceId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Generate a span ID for operation tracking
 */
export const generateSpanId = (): string => {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * Create a child logger with trace context
 */
export const createTracedLogger = (traceId: string, component: string) => {
  return logger.child({
    traceId,
    component,
  })
}

/**
 * Create a child logger with request-specific context
 */
export const createRequestLogger = (requestId: string, userId?: string) => {
  return logger.child({
    traceId: requestId,
    ...(userId && { userId }),
  })
}

// ============================================================================
// OPERATION LOGGER - For tracking operations with timing
// ============================================================================

interface OperationContext {
  component: string
  operation: string
  traceId?: string
  metadata?: Record<string, unknown>
}

interface OperationResult {
  success: boolean
  itemsProcessed?: number
  itemsFailed?: number
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Operation Logger - Logs only start and end of operations
 *
 * Usage:
 * ```ts
 * const op = operationLogger.start({
 *   component: 'email-worker',
 *   operation: 'send_batch',
 *   traceId: executionId,
 *   metadata: { batchSize: 50 }
 * })
 *
 * // ... do work ...
 *
 * op.success({ itemsProcessed: 48, itemsFailed: 2 })
 * // or
 * op.failure('Connection timeout')
 * ```
 */
export const operationLogger = {
  start: (ctx: OperationContext) => {
    const startTime = Date.now()
    const spanId = generateSpanId()

    logger.info(
      {
        traceId: ctx.traceId,
        spanId,
        component: ctx.component,
        operation: ctx.operation,
        status: "started",
        ...ctx.metadata,
      },
      `[${ctx.component}] ${ctx.operation} started`,
    )

    return {
      success: (result?: Omit<OperationResult, "success">) => {
        const durationMs = Date.now() - startTime
        logger.info(
          {
            traceId: ctx.traceId,
            spanId,
            component: ctx.component,
            operation: ctx.operation,
            status: "success",
            durationMs,
            ...result?.metadata,
            ...(result?.itemsProcessed !== undefined && { itemsProcessed: result.itemsProcessed }),
            ...(result?.itemsFailed !== undefined && { itemsFailed: result.itemsFailed }),
          },
          `[${ctx.component}] ${ctx.operation} completed (${formatDuration(durationMs)})`,
        )
      },
      failure: (error: string | Error, result?: Omit<OperationResult, "success" | "error">) => {
        const durationMs = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : error
        logger.error(
          {
            traceId: ctx.traceId,
            spanId,
            component: ctx.component,
            operation: ctx.operation,
            status: "failure",
            durationMs,
            error: errorMsg,
            ...result?.metadata,
          },
          `[${ctx.component}] ${ctx.operation} failed: ${errorMsg} (${formatDuration(durationMs)})`,
        )
      },
      // For debug-level intermediate logging
      debug: (msg: string, metadata?: Record<string, unknown>) => {
        logger.debug(
          {
            traceId: ctx.traceId,
            spanId,
            component: ctx.component,
            operation: ctx.operation,
            ...metadata,
          },
          `[${ctx.component}] ${msg}`,
        )
      },
    }
  },
}

// ============================================================================
// BATCH LOGGER - For batch operations with aggregated results
// ============================================================================

interface BatchContext {
  component: string
  operation: string
  traceId?: string
  totalItems: number
}

/**
 * Batch Logger - Aggregates results and logs summary only
 *
 * Usage:
 * ```ts
 * const batch = batchLogger.start({
 *   component: 'email-worker',
 *   operation: 'send_emails',
 *   traceId: executionId,
 *   totalItems: 50
 * })
 *
 * for (const item of items) {
 *   try {
 *     await process(item)
 *     batch.recordSuccess()
 *   } catch (e) {
 *     batch.recordFailure(e.message)
 *   }
 * }
 *
 * batch.complete() // Logs summary
 * ```
 */
export const batchLogger = {
  start: (ctx: BatchContext) => {
    const startTime = Date.now()
    const spanId = generateSpanId()
    let successCount = 0
    let failureCount = 0
    const errors: string[] = []

    logger.debug(
      {
        traceId: ctx.traceId,
        spanId,
        component: ctx.component,
        operation: ctx.operation,
        totalItems: ctx.totalItems,
      },
      `[${ctx.component}] ${ctx.operation} batch started (${ctx.totalItems} items)`,
    )

    return {
      recordSuccess: () => {
        successCount++
      },
      recordFailure: (error?: string) => {
        failureCount++
        if (error && errors.length < 5) {
          // Keep only first 5 errors
          errors.push(error)
        }
      },
      complete: () => {
        const durationMs = Date.now() - startTime
        const hasFailures = failureCount > 0

        const logFn = hasFailures ? logger.warn : logger.info
        logFn.call(
          logger,
          {
            traceId: ctx.traceId,
            spanId,
            component: ctx.component,
            operation: ctx.operation,
            status: hasFailures ? "partial_success" : "success",
            durationMs,
            totalItems: ctx.totalItems,
            successCount,
            failureCount,
            ...(errors.length > 0 && { sampleErrors: errors }),
          },
          `[${ctx.component}] ${ctx.operation} completed: ${successCount}/${ctx.totalItems} success${failureCount > 0 ? `, ${failureCount} failed` : ""} (${formatDuration(durationMs)})`,
        )

        return { successCount, failureCount, durationMs }
      },
    }
  },
}

// ============================================================================
// EXTERNAL SERVICE LOGGER - For API calls to external services
// ============================================================================

interface ExternalCallContext {
  service: string
  operation: string
  traceId?: string
  endpoint?: string
}

/**
 * External Service Logger - For tracking external API calls
 *
 * Usage:
 * ```ts
 * const call = externalLogger.start({
 *   service: 'sendgrid',
 *   operation: 'send_email',
 *   traceId: executionId
 * })
 *
 * try {
 *   const result = await sendgrid.send(email)
 *   call.success({ messageId: result.id })
 * } catch (e) {
 *   call.failure(e, { statusCode: e.code })
 * }
 * ```
 */
export const externalLogger = {
  start: (ctx: ExternalCallContext) => {
    const startTime = Date.now()

    // Only log start in debug mode
    logger.debug(
      {
        traceId: ctx.traceId,
        service: ctx.service,
        operation: ctx.operation,
        endpoint: ctx.endpoint,
      },
      `[${ctx.service}] ${ctx.operation} calling...`,
    )

    return {
      success: (metadata?: Record<string, unknown>) => {
        const durationMs = Date.now() - startTime
        logger.debug(
          {
            traceId: ctx.traceId,
            service: ctx.service,
            operation: ctx.operation,
            status: "success",
            durationMs,
            ...metadata,
          },
          `[${ctx.service}] ${ctx.operation} OK (${formatDuration(durationMs)})`,
        )
      },
      failure: (error: string | Error, metadata?: Record<string, unknown>) => {
        const durationMs = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : error
        logger.warn(
          {
            traceId: ctx.traceId,
            service: ctx.service,
            operation: ctx.operation,
            status: "failure",
            durationMs,
            error: errorMsg,
            ...metadata,
          },
          `[${ctx.service}] ${ctx.operation} failed: ${errorMsg} (${formatDuration(durationMs)})`,
        )
      },
      // For rate limiting, retries, etc.
      retry: (attempt: number, reason: string) => {
        logger.debug(
          {
            traceId: ctx.traceId,
            service: ctx.service,
            operation: ctx.operation,
            attempt,
            reason,
          },
          `[${ctx.service}] ${ctx.operation} retry #${attempt}: ${reason}`,
        )
      },
    }
  },
}

// ============================================================================
// WEBHOOK LOGGER - Optimized for webhook processing
// ============================================================================

interface WebhookContext {
  source: string
  eventType: string
  traceId?: string
}

/**
 * Webhook Logger - For incoming webhook processing
 *
 * Logs only essential info, not full payloads
 */
export const webhookLogger = {
  received: (ctx: WebhookContext, metadata?: Record<string, unknown>) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "webhook",
        source: ctx.source,
        eventType: ctx.eventType,
        ...metadata,
      },
      `[webhook:${ctx.source}] ${ctx.eventType} received`,
    )
  },

  processed: (
    ctx: WebhookContext,
    result: { success: boolean; durationMs: number; metadata?: Record<string, unknown> },
  ) => {
    const logFn = result.success ? logger.info : logger.warn
    logFn.call(
      logger,
      {
        traceId: ctx.traceId,
        component: "webhook",
        source: ctx.source,
        eventType: ctx.eventType,
        status: result.success ? "success" : "failure",
        durationMs: result.durationMs,
        ...result.metadata,
      },
      `[webhook:${ctx.source}] ${ctx.eventType} ${result.success ? "processed" : "failed"} (${formatDuration(result.durationMs)})`,
    )
  },

  // For batch webhook events (like SendGrid events)
  batchReceived: (ctx: Omit<WebhookContext, "eventType">, count: number) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "webhook",
        source: ctx.source,
        eventCount: count,
      },
      `[webhook:${ctx.source}] batch received (${count} events)`,
    )
  },
}

// ============================================================================
// EMAIL WORKER LOGGER - Specific to email operations
// ============================================================================

interface EmailOperationContext {
  traceId: string
  enrollmentId?: string
  sequenceId?: string
  stepOrder?: number
  leadCompany?: string
}

/**
 * Email Worker Logger - Optimized for email sequence operations
 */
export const emailWorkerLogger = {
  // Log only when batch starts processing
  batchStart: (traceId: string, count: number, sequenceName?: string) => {
    logger.info(
      {
        traceId,
        component: "email-worker",
        operation: "process_batch",
        count,
        ...(sequenceName && { sequenceName }),
      },
      `[email-worker] Processing ${count} pending emails`,
    )
  },

  // Log individual email only on success (debug) or failure (warn)
  emailSent: (ctx: EmailOperationContext, messageId: string) => {
    logger.debug(
      {
        ...ctx,
        component: "email-worker",
        operation: "send_email",
        status: "success",
        messageId,
      },
      `[email-worker] Email sent to ${ctx.leadCompany}`,
    )
  },

  emailFailed: (ctx: EmailOperationContext, error: string) => {
    logger.warn(
      {
        ...ctx,
        component: "email-worker",
        operation: "send_email",
        status: "failure",
        error,
      },
      `[email-worker] Email failed for ${ctx.leadCompany}: ${error}`,
    )
  },

  // Summary after batch completes
  batchComplete: (
    traceId: string,
    stats: { total: number; sent: number; failed: number; durationMs: number },
  ) => {
    const { total, sent, failed, durationMs } = stats
    const logFn = failed > 0 ? logger.warn : logger.info
    logFn.call(
      logger,
      {
        traceId,
        component: "email-worker",
        operation: "process_batch",
        status: failed > 0 ? "partial_success" : "success",
        ...stats,
      },
      `[email-worker] Batch complete: ${sent}/${total} sent${failed > 0 ? `, ${failed} failed` : ""} (${formatDuration(durationMs)})`,
    )
  },

  // Enrollment state changes (important business events)
  enrollmentCompleted: (enrollmentId: string, sequenceId: string, stepsCompleted: number) => {
    logger.info(
      {
        component: "email-worker",
        operation: "enrollment_complete",
        enrollmentId,
        sequenceId,
        stepsCompleted,
      },
      `[email-worker] Enrollment completed (${stepsCompleted} steps)`,
    )
  },

  enrollmentStopped: (enrollmentId: string, reason: string) => {
    logger.info(
      {
        component: "email-worker",
        operation: "enrollment_stop",
        enrollmentId,
        reason,
      },
      `[email-worker] Enrollment stopped: ${reason}`,
    )
  },
}

// ============================================================================
// LEAD ENRICHMENT LOGGER - For lead enrichment operations
// ============================================================================

interface EnrichmentContext {
  traceId?: string
  domain: string
  companyName?: string
}

/**
 * Lead Enrichment Logger - Aggregated logging for enrichment
 */
export const enrichmentLogger = {
  // Start of enrichment batch
  batchStart: (traceId: string, count: number) => {
    logger.info(
      {
        traceId,
        component: "lead-enrichment",
        operation: "enrich_batch",
        count,
      },
      `[lead-enrichment] Enriching ${count} leads`,
    )
  },

  // Individual enrichment - debug only
  enriching: (ctx: EnrichmentContext) => {
    logger.debug(
      {
        ...ctx,
        component: "lead-enrichment",
        operation: "enrich_lead",
      },
      `[lead-enrichment] Enriching ${ctx.companyName || ctx.domain}`,
    )
  },

  // Batch complete with summary
  batchComplete: (
    traceId: string,
    stats: {
      total: number
      withEmail: number
      withDescription: number
      failed: number
      durationMs: number
    },
  ) => {
    logger.info(
      {
        traceId,
        component: "lead-enrichment",
        operation: "enrich_batch",
        status: "success",
        ...stats,
      },
      `[lead-enrichment] Batch complete: ${stats.withEmail}/${stats.total} with emails (${formatDuration(stats.durationMs)})`,
    )
  },

  // External API issues (rate limit, timeout)
  apiIssue: (service: string, issue: "rate_limit" | "timeout" | "error", count?: number) => {
    logger.warn(
      {
        component: "lead-enrichment",
        service,
        issue,
        ...(count && { affectedCount: count }),
      },
      `[lead-enrichment] ${service} ${issue}${count ? ` (${count} affected)` : ""}`,
    )
  },
}

// ============================================================================
// INBOUND EMAIL LOGGER - For processing incoming emails
// ============================================================================

/**
 * Inbound Email Logger - Essential info only
 */
export const inboundEmailLogger = {
  received: (traceId: string, from: string, to: string, subject: string) => {
    logger.info(
      {
        traceId,
        component: "inbound-email",
        operation: "receive",
        from: maskEmail(from),
        to: maskEmail(to),
        subject: truncate(subject, 50),
      },
      `[inbound-email] Received from ${maskEmail(from)}`,
    )
  },

  processed: (
    traceId: string,
    result: {
      emailId: string
      isReply: boolean
      classification?: string
      durationMs: number
    },
  ) => {
    logger.info(
      {
        traceId,
        component: "inbound-email",
        operation: "process",
        status: "success",
        ...result,
      },
      `[inbound-email] Processed${result.isReply ? " (reply)" : ""}${result.classification ? `: ${result.classification}` : ""} (${formatDuration(result.durationMs)})`,
    )
  },

  failed: (traceId: string, error: string) => {
    logger.error(
      {
        traceId,
        component: "inbound-email",
        operation: "process",
        status: "failure",
        error,
      },
      `[inbound-email] Processing failed: ${error}`,
    )
  },
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Mask email for privacy in logs
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain || !local) return email
  const maskedLocal =
    local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`
  return `${maskedLocal}@${domain}`
}

/**
 * Truncate string for logging
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.substring(0, maxLength)}...`
}

// ============================================================================
// LEAD SEARCH LOGGER - For lead discovery and search operations
// ============================================================================

interface LeadSearchContext {
  traceId?: string
  query?: string
  country?: string
  industry?: string
}

/**
 * Lead Search Logger - For tracking lead discovery operations
 * Always uses INFO level for visibility in production
 */
export const leadSearchLogger = {
  // Phase start
  phaseStart: (phase: string, ctx: LeadSearchContext, metadata?: Record<string, unknown>) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase,
        query: ctx.query,
        country: ctx.country,
        industry: ctx.industry,
        ...metadata,
      },
      `[LeadSearch] 🚀 Phase started: ${phase}`,
    )
  },

  // Phase complete
  phaseComplete: (
    phase: string,
    ctx: LeadSearchContext,
    stats: Record<string, unknown>,
    durationMs: number,
  ) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase,
        status: "complete",
        durationMs,
        ...stats,
      },
      `[LeadSearch] ✅ Phase complete: ${phase} (${formatDuration(durationMs)})`,
    )
  },

  // Search source result
  sourceResult: (
    source: string,
    count: number,
    ctx: LeadSearchContext,
    metadata?: Record<string, unknown>,
  ) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        source,
        resultCount: count,
        ...metadata,
      },
      `[LeadSearch] 📊 ${source}: ${count} leads found`,
    )
  },

  // Filter/skip events
  filtered: (reason: string, count: number, ctx: LeadSearchContext) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        filterReason: reason,
        filteredCount: count,
      },
      `[LeadSearch] 🔍 Filtered: ${count} leads (${reason})`,
    )
  },

  // Enrichment progress
  enrichmentProgress: (
    current: number,
    total: number,
    withEmails: number,
    ctx: LeadSearchContext,
  ) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase: "enrichment",
        current,
        total,
        withEmails,
      },
      `[LeadSearch] 📧 Enrichment: ${current}/${total} processed, ${withEmails} with emails`,
    )
  },

  // Final summary
  summary: (
    ctx: LeadSearchContext,
    stats: {
      totalFound: number
      fromBigQuery: number
      fromPerplexity: number
      fromBeautyDB: number
      fromHunterIO: number
      withEmails: number
      skippedDuplicates: number
      skippedLargeCompanies: number
      skippedLowScoring: number
      durationMs: number
    },
  ) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase: "complete",
        status: "success",
        ...stats,
      },
      `[LeadSearch] 🎯 COMPLETE: ${stats.totalFound} leads (BQ:${stats.fromBigQuery}, PX:${stats.fromPerplexity}, Beauty:${stats.fromBeautyDB}, HIO:${stats.fromHunterIO}) ` +
        `Emails:${stats.withEmails}, Filtered: dup=${stats.skippedDuplicates}, large=${stats.skippedLargeCompanies}, lowScore=${stats.skippedLowScoring} ` +
        `(${formatDuration(stats.durationMs)})`,
    )
  },

  // Error
  error: (phase: string, error: string | Error, ctx: LeadSearchContext) => {
    const errorMsg = error instanceof Error ? error.message : error
    logger.error(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase,
        status: "error",
        error: errorMsg,
      },
      `[LeadSearch] ❌ Error in ${phase}: ${errorMsg}`,
    )
  },

  // Debug info (always shown as info in production for debugging)
  debug: (message: string, ctx: LeadSearchContext, metadata?: Record<string, unknown>) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        ...metadata,
      },
      `[LeadSearch] ${message}`,
    )
  },

  // ICP generation
  icpGenerated: (ctx: LeadSearchContext, customerTypes: string[]) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase: "icp",
        customerTypes: customerTypes.slice(0, 5),
      },
      `[LeadSearch] 🎯 ICP generated: ${customerTypes.slice(0, 3).join(", ")}...`,
    )
  },

  // Beauty DB specific
  beautyDBSearch: (ctx: LeadSearchContext, found: number, country: string) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        source: "beauty_db",
        country,
        resultCount: found,
      },
      `[LeadSearch] 💄 Beauty DB: ${found} leads found for ${country}`,
    )
  },

  // Strategy selection
  strategySelected: (
    strategy: "bigquery-first" | "perplexity-first",
    country: string,
    ctx: LeadSearchContext,
  ) => {
    logger.info(
      {
        traceId: ctx.traceId,
        component: "lead-search",
        phase: "strategy",
        strategy,
        country,
      },
      `[LeadSearch] 🔄 Strategy: ${strategy} for ${country}`,
    )
  },
}

// ============================================================================
// LEGACY SUPPORT - Chatbot Logger (kept for backward compatibility)
// ============================================================================

export const chatbotLogger = {
  info: (message: string) => {
    logger.info(message)
  },

  warn: (message: string) => {
    logger.warn(message)
  },

  debug: (message: string) => {
    logger.debug(message)
  },

  error: (message: string) => {
    logger.error(message)
  },

  nodeStart: (nodeName: string, context = "LangGraph") => {
    logger.info(`[${context}] Node started: ${nodeName}`)
  },

  nodeSuccess: (nodeName: string, duration: number, context = "LangGraph") => {
    logger.info(`[${context}] Node completed: ${nodeName} (${formatDuration(duration)})`)
  },

  nodeError: (nodeName: string, error: string, duration: number, context = "LangGraph") => {
    logger.error(`[${context}] Node failed: ${nodeName} - ${error} (${formatDuration(duration)})`)
  },

  routeStart: (method: string, path: string) => {
    logger.info(`[API] ${method} ${path}`)
  },

  routeSuccess: (method: string, path: string, statusCode: number, duration: number) => {
    logger.info(`[API] ${method} ${path} - ${statusCode} (${formatDuration(duration)})`)
  },

  routeError: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    error?: string,
  ) => {
    const errorMsg = error ? ` - ${error}` : ""
    logger.error(`[API] ${method} ${path} - ${statusCode}${errorMsg} (${formatDuration(duration)})`)
  },

  graphEvent: (eventType: string, nodeName: string, duration?: number) => {
    const durationStr = duration !== undefined ? ` (${formatDuration(duration)})` : ""
    logger.debug(`[Graph] ${eventType}: ${nodeName}${durationStr}`)
  },

  nodeState: (nodeName: string, stateType: "input" | "output", state: Record<string, unknown>) => {
    logger.debug(
      {
        node: nodeName,
        stateType,
        state,
      },
      `[LangGraph] ${nodeName} ${stateType} state`,
    )
  },

  routeDecision: (fromNode: string, toNode: string, reason?: string) => {
    const reasonStr = reason ? ` (${reason})` : ""
    logger.info(`[LangGraph] Route: ${fromNode} → ${toNode}${reasonStr}`)
  },

  graphStart: (conversationId: string, question: string) => {
    logger.info(`[LangGraph] Graph execution started - ConversationID: ${conversationId}`)
    logger.debug(`[LangGraph] Question: "${question}"`)
  },

  graphEnd: (conversationId: string, duration: number, success: boolean) => {
    const status = success ? "completed successfully" : "failed"
    logger.info(
      `[LangGraph] Graph execution ${status} - ConversationID: ${conversationId} (${formatDuration(duration)})`,
    )
  },

  nodeDetail: (nodeName: string, details: Record<string, unknown>) => {
    logger.debug(details, `[LangGraph] ${nodeName} details`)
  },
}

export default logger
