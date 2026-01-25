import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm"
import { db } from "../db"
import { type NewSlackMessage, type SlackMessage, slackMessages } from "../db/schema"
import { logger } from "../utils/logger"

export const slackRepository = {
  saveMessage: async (
    message: Partial<NewSlackMessage>,
  ): Promise<{ message: SlackMessage; isNew: boolean }> => {
    // Check for duplicate
    if (message.slackTs) {
      const existing = await db
        .select({ id: slackMessages.id })
        .from(slackMessages)
        .where(eq(slackMessages.slackTs, message.slackTs))

      if (existing[0]) {
        logger.info(`Duplicate Slack message ignored: ${message.slackTs}`)
        const existingMessage = await slackRepository.findById(existing[0].id)
        if (existingMessage) {
          return { message: existingMessage, isNew: false }
        }
      }
    }

    const [saved] = await db
      .insert(slackMessages)
      .values({
        slackTs: message.slackTs,
        channelId: message.channelId,
        userId: message.userId,
        userName: message.userName,
        text: message.text,
        threadTs: message.threadTs,
        customerId: message.customerId,
        prospectId: message.prospectId,
        processed: message.processed || 0,
        deleted: 0,
      })
      .returning()

    if (!saved) throw new Error("Failed to save Slack message")
    logger.info(`Slack message saved: ${saved.id}`)
    return { message: saved, isNew: true }
  },

  findById: async (id: string): Promise<SlackMessage | null> => {
    const result = await db.select().from(slackMessages).where(eq(slackMessages.id, id))
    return result[0] || null
  },

  findBySlackTs: async (slackTs: string): Promise<SlackMessage | null> => {
    const result = await db.select().from(slackMessages).where(eq(slackMessages.slackTs, slackTs))
    return result[0] || null
  },

  findByCustomerId: async (customerId: string): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(eq(slackMessages.customerId, customerId))
      .orderBy(desc(slackMessages.receivedAt))
  },

  findByProspectId: async (prospectId: string): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(eq(slackMessages.prospectId, prospectId))
      .orderBy(desc(slackMessages.receivedAt))
  },

  findUnprocessed: async (limit: number = 50): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(eq(slackMessages.processed, 0))
      .orderBy(slackMessages.receivedAt)
      .limit(limit)
  },

  markProcessed: async (
    id: string,
    updates: { customerId?: string; prospectId?: string } = {},
  ): Promise<SlackMessage | null> => {
    const [message] = await db
      .update(slackMessages)
      .set({
        processed: 1,
        customerId: updates.customerId,
        prospectId: updates.prospectId,
      })
      .where(eq(slackMessages.id, id))
      .returning()
    return message || null
  },

  findRecent: async (
    options: { channelId?: string; limit?: number; offset?: number } = {},
  ): Promise<SlackMessage[]> => {
    const { channelId, limit = 50, offset = 0 } = options

    let query = db.select().from(slackMessages)

    if (channelId) {
      query = query.where(eq(slackMessages.channelId, channelId)) as typeof query
    }

    return query.orderBy(desc(slackMessages.receivedAt)).limit(limit).offset(offset)
  },

  getCount: async (processedOnly: boolean = false): Promise<number> => {
    let query = db.select({ count: sql<number>`count(*)::int` }).from(slackMessages)

    if (processedOnly) {
      query = query.where(eq(slackMessages.processed, 1)) as typeof query
    }

    const result = await query
    return result[0]?.count || 0
  },

  deleteOld: async (olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> => {
    const threshold = new Date(Date.now() - olderThanMs)

    await db
      .delete(slackMessages)
      .where(and(eq(slackMessages.processed, 1), lt(slackMessages.receivedAt, threshold)))

    return 0
  },

  markDeleted: async (slackTs: string, channelId: string): Promise<boolean> => {
    const _result = await db
      .update(slackMessages)
      .set({ deleted: 1, deletedAt: new Date() })
      .where(and(eq(slackMessages.slackTs, slackTs), eq(slackMessages.channelId, channelId)))

    logger.info(`Message ${slackTs} marked as deleted in channel ${channelId}`)
    return true
  },

  updateMessageText: async (
    slackTs: string,
    channelId: string,
    newText: string,
  ): Promise<boolean> => {
    await db
      .update(slackMessages)
      .set({ text: newText })
      .where(and(eq(slackMessages.slackTs, slackTs), eq(slackMessages.channelId, channelId)))

    logger.info(`Message ${slackTs} text updated in channel ${channelId}`)
    return true
  },

  findDeleted: async (): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(eq(slackMessages.deleted, 1))
      .orderBy(desc(slackMessages.deletedAt))
  },

  findActive: async (): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(or(eq(slackMessages.deleted, 0), isNull(slackMessages.deleted)))
      .orderBy(desc(slackMessages.receivedAt))
  },

  findByThreadTs: async (threadTs: string): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(
        and(
          eq(slackMessages.threadTs, threadTs),
          or(eq(slackMessages.deleted, 0), isNull(slackMessages.deleted)),
        ),
      )
      .orderBy(slackMessages.receivedAt)
  },

  /**
   * Mark a message as failed with error details
   * Increments retry count and stores error message
   */
  markFailed: async (id: string, errorMessage: string): Promise<SlackMessage | null> => {
    const [message] = await db
      .update(slackMessages)
      .set({
        processingError: errorMessage,
        retryCount: sql`COALESCE(${slackMessages.retryCount}, 0) + 1`,
        lastErrorAt: new Date(),
      })
      .where(eq(slackMessages.id, id))
      .returning()
    logger.info({ messageId: id, retryCount: message?.retryCount }, "Message marked as failed")
    return message || null
  },

  /**
   * Find messages that can be retried (haven't exceeded max retries)
   */
  findRetryable: async (maxRetries: number = 3, limit: number = 10): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(
        and(
          eq(slackMessages.processed, 0),
          sql`COALESCE(${slackMessages.retryCount}, 0) < ${maxRetries}`,
        ),
      )
      .orderBy(slackMessages.receivedAt)
      .limit(limit)
  },

  /**
   * Find messages that have permanently failed (exceeded max retries)
   */
  findPermanentlyFailed: async (maxRetries: number = 3): Promise<SlackMessage[]> => {
    return db
      .select()
      .from(slackMessages)
      .where(
        and(
          eq(slackMessages.processed, 0),
          sql`COALESCE(${slackMessages.retryCount}, 0) >= ${maxRetries}`,
        ),
      )
      .orderBy(desc(slackMessages.lastErrorAt))
  },

  /**
   * Clear error state for a message (for manual reset)
   */
  clearError: async (id: string): Promise<SlackMessage | null> => {
    const [message] = await db
      .update(slackMessages)
      .set({
        processingError: null,
        retryCount: 0,
        lastErrorAt: null,
      })
      .where(eq(slackMessages.id, id))
      .returning()
    return message || null
  },
}
