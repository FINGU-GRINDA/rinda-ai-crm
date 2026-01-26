import { and, desc, eq } from "drizzle-orm"
import { db } from "../db"
import { type Attachment, attachments, type NewAttachment } from "../db/schema"
import { logger } from "../utils/logger"

export const attachmentRepository = {
  create: async (data: NewAttachment): Promise<Attachment> => {
    const [attachment] = await db.insert(attachments).values(data).returning()
    if (!attachment) throw new Error("Failed to create attachment")
    logger.info({ id: attachment.id, fileName: attachment.fileName }, "Attachment created")
    return attachment
  },

  createBulk: async (data: NewAttachment[]): Promise<Attachment[]> => {
    if (data.length === 0) return []
    const created = await db.insert(attachments).values(data).returning()
    logger.info({ count: created.length }, "Bulk attachments created")
    return created
  },

  findById: async (id: string): Promise<Attachment | null> => {
    const result = await db.select().from(attachments).where(eq(attachments.id, id))
    return result[0] || null
  },

  findByEntity: async (
    entityType: Attachment["entityType"],
    entityId: string,
  ): Promise<Attachment[]> => {
    return db
      .select()
      .from(attachments)
      .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
      .orderBy(desc(attachments.createdAt))
  },

  findBySlackMessage: async (slackMessageId: string): Promise<Attachment[]> => {
    return db
      .select()
      .from(attachments)
      .where(
        and(eq(attachments.entityType, "slack_message"), eq(attachments.entityId, slackMessageId)),
      )
      .orderBy(desc(attachments.createdAt))
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await db.delete(attachments).where(eq(attachments.id, id)).returning()
    return result.length > 0
  },

  deleteByEntity: async (
    entityType: Attachment["entityType"],
    entityId: string,
  ): Promise<number> => {
    const result = await db
      .delete(attachments)
      .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
      .returning()
    return result.length
  },
}
