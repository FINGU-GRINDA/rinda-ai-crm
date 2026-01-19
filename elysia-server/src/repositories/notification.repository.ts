import { and, desc, eq, lt, sql } from "drizzle-orm"
import { db } from "../db"
import { type NewNotification, type Notification, notifications } from "../db/schema"

export const notificationRepository = {
  findAll: async (limit: number = 50): Promise<Notification[]> => {
    return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit)
  },

  findById: async (id: string): Promise<Notification | null> => {
    const result = await db.select().from(notifications).where(eq(notifications.id, id))
    return result[0] || null
  },

  findUnread: async (limit: number = 50): Promise<Notification[]> => {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.read, 0))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
  },

  findByType: async (type: Notification["type"]): Promise<Notification[]> => {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.type, type))
      .orderBy(desc(notifications.createdAt))
  },

  findByCustomerId: async (customerId: string): Promise<Notification[]> => {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.customerId, customerId))
      .orderBy(desc(notifications.createdAt))
  },

  findByProspectId: async (prospectId: string): Promise<Notification[]> => {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.prospectId, prospectId))
      .orderBy(desc(notifications.createdAt))
  },

  create: async (data: Partial<NewNotification>): Promise<Notification> => {
    const [notification] = await db
      .insert(notifications)
      .values({
        type: data.type || "news",
        title: data.title || "",
        message: data.message || "",
        customerId: data.customerId,
        prospectId: data.prospectId,
        priority: data.priority || "medium",
        read: 0,
        actionUrl: data.actionUrl,
        metadata: data.metadata,
      })
      .returning()
    if (!notification) throw new Error("Failed to create notification")
    return notification
  },

  markAsRead: async (id: string): Promise<Notification | null> => {
    const [notification] = await db
      .update(notifications)
      .set({ read: 1 })
      .where(eq(notifications.id, id))
      .returning()
    return notification || null
  },

  markAllAsRead: async (): Promise<number> => {
    const _result = await db.update(notifications).set({ read: 1 }).where(eq(notifications.read, 0))
    return 0 // Drizzle doesn't return count easily, would need raw query
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(notifications).where(eq(notifications.id, id))
    return true
  },

  deleteOld: async (olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> => {
    const threshold = new Date(Date.now() - olderThanMs)
    await db
      .delete(notifications)
      .where(and(eq(notifications.read, 1), lt(notifications.createdAt, threshold)))
    return 0
  },

  getUnreadCount: async (): Promise<number> => {
    const result = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(eq(notifications.read, 0))
    return result[0]?.count || 0
  },
}
