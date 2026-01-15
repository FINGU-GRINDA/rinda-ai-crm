import { desc, eq, sql } from "drizzle-orm"
import { db } from "../db"
import { type EmailMessage, emailMessages, type NewEmailMessage } from "../db/schema"
import { generateId } from "../utils/id-generator"
import { logger } from "../utils/logger"

export const emailRepository = {
  save: async (email: Partial<NewEmailMessage>): Promise<EmailMessage> => {
    const id = email.id || generateId()
    const now = Date.now()

    // Check for duplicate
    if (email.gmailMessageId) {
      const existing = await db
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(eq(emailMessages.gmailMessageId, email.gmailMessageId))

      if (existing[0]) {
        logger.info(`Duplicate email ignored: ${email.gmailMessageId}`)
        const existing_email = await emailRepository.findById(existing[0].id)
        if (existing_email) {
          return existing_email
        }
      }
    }

    const [saved] = await db
      .insert(emailMessages)
      .values({
        id,
        gmailMessageId: email.gmailMessageId,
        threadId: email.threadId,
        subject: email.subject,
        fromAddress: email.fromAddress,
        toAddress: email.toAddress,
        body: email.body,
        date: email.date,
        customerId: email.customerId,
        syncedAt: now,
      })
      .returning()

    if (!saved) throw new Error("Failed to save email")
    return saved
  },

  findById: async (id: string): Promise<EmailMessage | null> => {
    const result = await db.select().from(emailMessages).where(eq(emailMessages.id, id))
    return result[0] || null
  },

  findByGmailMessageId: async (gmailMessageId: string): Promise<EmailMessage | null> => {
    const result = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.gmailMessageId, gmailMessageId))
    return result[0] || null
  },

  findByCustomerId: async (customerId: string): Promise<EmailMessage[]> => {
    return db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.customerId, customerId))
      .orderBy(desc(emailMessages.date))
  },

  findByThreadId: async (threadId: string): Promise<EmailMessage[]> => {
    return db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, threadId))
      .orderBy(emailMessages.date)
  },

  findRecent: async (limit: number = 50): Promise<EmailMessage[]> => {
    return db.select().from(emailMessages).orderBy(desc(emailMessages.date)).limit(limit)
  },

  findUnlinked: async (): Promise<EmailMessage[]> => {
    return db
      .select()
      .from(emailMessages)
      .where(sql`${emailMessages.customerId} IS NULL`)
      .orderBy(desc(emailMessages.date))
  },

  linkToCustomer: async (emailId: string, customerId: string): Promise<EmailMessage | null> => {
    const [email] = await db
      .update(emailMessages)
      .set({ customerId })
      .where(eq(emailMessages.id, emailId))
      .returning()
    return email || null
  },

  getCount: async (): Promise<number> => {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(emailMessages)
    return result[0]?.count || 0
  },

  getLastSyncTime: async (): Promise<number | null> => {
    const result = await db
      .select({ syncedAt: emailMessages.syncedAt })
      .from(emailMessages)
      .orderBy(desc(emailMessages.syncedAt))
      .limit(1)
    return result[0]?.syncedAt || null
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(emailMessages).where(eq(emailMessages.id, id))
    return true
  },
}
