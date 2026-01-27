import { config } from "../config"
import { slackRepository } from "../repositories"
import type { SlackChannelMessage, SlackEvent } from "../types"
import { logger } from "../utils/logger"
import { slackApiService } from "./slack-api.service"
import { slackEventService } from "./slack-event.service"

export interface BackfillOptions {
  channelType?: "cs" | "sales" | "meeting-notes"
  channelId?: string
  startDate: Date
  endDate?: Date
  limit?: number
  dryRun?: boolean
  batchSize?: number // Messages per API call (default: 100)
  delayBetweenBatches?: number // Rate limiting delay in ms (default: 1000)
  delayBetweenMessages?: number // Delay between message processing in ms (default: 100)
}

export interface BackfillResult {
  totalFetched: number
  totalProcessed: number
  totalSkipped: number
  totalErrors: number
  errors: Array<{ slackTs: string; error: string }>
  dryRunMessages?: Array<{
    slackTs: string
    user: string
    text: string
    wouldProcess: boolean
  }>
  durationMs: number
}

export type BackfillProgressCallback = (progress: {
  phase: "fetching" | "processing"
  current: number
  total: number
  message: string
}) => void

class SlackBackfillService {
  /**
   * Convert channel type to channel ID using config
   */
  private resolveChannelId(channelType?: string, channelId?: string): string {
    if (channelId) {
      return channelId
    }

    if (!channelType) {
      throw new Error("Either channelType or channelId is required")
    }

    switch (channelType) {
      case "cs":
        if (!config.CS_CHANNEL_ID) {
          throw new Error("CS_CHANNEL_ID not configured")
        }
        return config.CS_CHANNEL_ID
      case "sales":
        if (!config.SALES_CHANNEL_ID) {
          throw new Error("SALES_CHANNEL_ID not configured")
        }
        return config.SALES_CHANNEL_ID
      case "meeting-notes":
        if (!config.MEETING_NOTES_CHANNEL_ID) {
          throw new Error("MEETING_NOTES_CHANNEL_ID not configured")
        }
        return config.MEETING_NOTES_CHANNEL_ID
      default:
        throw new Error(`Unknown channel type: ${channelType}`)
    }
  }

  /**
   * Convert Date to Slack timestamp format (Unix seconds as string)
   */
  private dateToSlackTs(date: Date): string {
    return (date.getTime() / 1000).toString()
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Check if a message already exists in the database by its Slack timestamp
   */
  private async messageExists(slackTs: string): Promise<boolean> {
    const existing = await slackRepository.findBySlackTs(slackTs)
    return !!existing
  }

  /**
   * Fetch all messages in date range with pagination
   */
  private async fetchMessagesInRange(
    channelId: string,
    startDate: Date,
    endDate: Date,
    options: {
      batchSize: number
      delayBetweenBatches: number
    },
    onProgress?: BackfillProgressCallback,
  ): Promise<SlackChannelMessage[]> {
    const allMessages: SlackChannelMessage[] = []
    let cursor: string | undefined
    let batchNumber = 0

    const oldest = this.dateToSlackTs(startDate)
    const latest = this.dateToSlackTs(endDate)

    logger.info(
      { channelId, oldest, latest, startDate, endDate },
      "Starting to fetch messages in date range",
    )

    do {
      batchNumber++
      onProgress?.({
        phase: "fetching",
        current: allMessages.length,
        total: 0, // Unknown total during fetch
        message: `Fetching batch ${batchNumber}... (${allMessages.length} messages so far)`,
      })

      const result = await slackApiService.getChannelMessages(channelId, {
        limit: options.batchSize,
        oldest,
        latest,
        cursor,
        includeReplies: false, // We'll process thread messages separately
      })

      allMessages.push(...result.messages)
      cursor = result.nextCursor

      logger.info(
        {
          batch: batchNumber,
          fetched: result.messages.length,
          total: allMessages.length,
          hasMore: result.hasMore,
        },
        "Fetched batch of messages",
      )

      if (result.hasMore && cursor) {
        // Rate limit protection - delay between API calls
        await this.delay(options.delayBetweenBatches)
      }
    } while (cursor)

    // Sort by timestamp (oldest first) for chronological processing
    allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))

    logger.info(
      { totalMessages: allMessages.length, channelId },
      "Finished fetching all messages in date range",
    )

    return allMessages
  }

  /**
   * Convert SlackChannelMessage to SlackEvent format for processing
   */
  private messageToEvent(message: SlackChannelMessage, channelId: string): SlackEvent {
    return {
      type: "message",
      channel: channelId,
      user: message.user,
      text: message.text,
      ts: message.ts,
      thread_ts: message.threadTs,
      files: message.files?.map((f) => ({
        id: f.id,
        name: f.name,
        mimetype: f.mimetype,
        url: f.url,
        url_private_download: f.url_private_download,
        size: f.size,
      })),
    }
  }

  /**
   * Process a single message through the appropriate channel handler
   */
  private async processMessage(
    message: SlackChannelMessage,
    channelId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert to SlackEvent format
      const event = this.messageToEvent(message, channelId)

      // Get username from Slack if available
      let userName: string | undefined
      if (message.user) {
        try {
          const userInfo = await slackApiService.getUserInfo(message.user)
          userName = userInfo?.realName || userInfo?.name
        } catch {
          // Ignore user fetch errors, use ID instead
          userName = message.user
        }
      }

      // Save message to DB first
      const { message: savedMessage, isNew } = await slackRepository.saveMessage({
        slackTs: message.ts,
        channelId,
        userId: message.user,
        userName,
        text: message.text,
        threadTs: message.threadTs || undefined,
      })

      if (!isNew) {
        // Message already exists and was processed before
        return { success: true }
      }

      // Process through the channel handler
      await slackEventService.processMonitoredChannelMessage(savedMessage, event)

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ slackTs: message.ts, error: errorMsg }, "Error processing backfill message")
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Main backfill method - fetches and processes messages in a date range
   */
  async backfill(
    options: BackfillOptions,
    onProgress?: BackfillProgressCallback,
  ): Promise<BackfillResult> {
    const startTime = Date.now()
    const {
      channelType,
      channelId: rawChannelId,
      startDate,
      endDate = new Date(),
      limit,
      dryRun = false,
      batchSize = 100,
      delayBetweenBatches = 1000,
      delayBetweenMessages = 100,
    } = options

    // Resolve channel ID
    const channelId = this.resolveChannelId(channelType, rawChannelId)

    logger.info(
      {
        channelId,
        channelType,
        startDate,
        endDate,
        limit,
        dryRun,
        batchSize,
      },
      "Starting backfill",
    )

    // Fetch all messages in date range
    let allMessages = await this.fetchMessagesInRange(
      channelId,
      startDate,
      endDate,
      { batchSize, delayBetweenBatches },
      onProgress,
    )

    // Apply limit if specified
    if (limit && allMessages.length > limit) {
      logger.info({ totalFetched: allMessages.length, limit }, "Applying limit to fetched messages")
      allMessages = allMessages.slice(0, limit)
    }

    // Dry run mode - just return what would be processed
    if (dryRun) {
      const dryRunMessages = await Promise.all(
        allMessages.map(async (msg) => ({
          slackTs: msg.ts,
          user: msg.user,
          text: msg.text.length > 100 ? `${msg.text.substring(0, 100)}...` : msg.text,
          wouldProcess: !(await this.messageExists(msg.ts)),
        })),
      )

      const wouldProcess = dryRunMessages.filter((m) => m.wouldProcess).length
      const wouldSkip = dryRunMessages.filter((m) => !m.wouldProcess).length

      logger.info({ totalFetched: allMessages.length, wouldProcess, wouldSkip }, "Dry run complete")

      return {
        totalFetched: allMessages.length,
        totalProcessed: 0,
        totalSkipped: 0,
        totalErrors: 0,
        errors: [],
        dryRunMessages,
        durationMs: Date.now() - startTime,
      }
    }

    // Process messages sequentially to avoid overwhelming the system
    let processed = 0
    let skipped = 0
    const errors: Array<{ slackTs: string; error: string }> = []

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i]
      if (!msg) continue

      onProgress?.({
        phase: "processing",
        current: i + 1,
        total: allMessages.length,
        message: `Processing message ${i + 1}/${allMessages.length}`,
      })

      // Check if already exists in DB
      if (await this.messageExists(msg.ts)) {
        skipped++
        logger.debug({ slackTs: msg.ts }, "Message already exists, skipping")
        continue
      }

      // Process the message
      const result = await this.processMessage(msg, channelId)

      if (result.success) {
        processed++
      } else {
        errors.push({ slackTs: msg.ts, error: result.error || "Unknown error" })
      }

      // Small delay between processing to avoid overwhelming AI service
      if (i < allMessages.length - 1) {
        await this.delay(delayBetweenMessages)
      }
    }

    const durationMs = Date.now() - startTime

    logger.info(
      {
        totalFetched: allMessages.length,
        totalProcessed: processed,
        totalSkipped: skipped,
        totalErrors: errors.length,
        durationMs,
      },
      "Backfill complete",
    )

    return {
      totalFetched: allMessages.length,
      totalProcessed: processed,
      totalSkipped: skipped,
      totalErrors: errors.length,
      errors,
      durationMs,
    }
  }
}

export const slackBackfillService = new SlackBackfillService()
