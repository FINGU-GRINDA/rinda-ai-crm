import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "../db"
import { type MixpanelEvent, mixpanelEvents, type NewMixpanelEvent } from "../db/schema"
import { generateId } from "../utils/id-generator"

export const mixpanelRepository = {
  save: async (event: Partial<NewMixpanelEvent>): Promise<MixpanelEvent> => {
    const id = event.id || generateId()
    const now = Date.now()

    const [saved] = await db
      .insert(mixpanelEvents)
      .values({
        id,
        eventName: event.eventName || "",
        distinctId: event.distinctId,
        properties: event.properties,
        receivedAt: event.receivedAt || now,
        processed: event.processed || 0,
        customerId: event.customerId,
        createdAt: now,
      })
      .returning()

    if (!saved) throw new Error("Failed to save Mixpanel event")
    return saved
  },

  findById: async (id: string): Promise<MixpanelEvent | null> => {
    const result = await db.select().from(mixpanelEvents).where(eq(mixpanelEvents.id, id))
    return result[0] || null
  },

  findByDistinctId: async (distinctId: string): Promise<MixpanelEvent[]> => {
    return db
      .select()
      .from(mixpanelEvents)
      .where(eq(mixpanelEvents.distinctId, distinctId))
      .orderBy(desc(mixpanelEvents.receivedAt))
  },

  findByCustomerId: async (customerId: string): Promise<MixpanelEvent[]> => {
    return db
      .select()
      .from(mixpanelEvents)
      .where(eq(mixpanelEvents.customerId, customerId))
      .orderBy(desc(mixpanelEvents.receivedAt))
  },

  findUnprocessed: async (limit: number = 100): Promise<MixpanelEvent[]> => {
    return db
      .select()
      .from(mixpanelEvents)
      .where(eq(mixpanelEvents.processed, 0))
      .orderBy(mixpanelEvents.receivedAt)
      .limit(limit)
  },

  findByEventName: async (eventName: string): Promise<MixpanelEvent[]> => {
    return db
      .select()
      .from(mixpanelEvents)
      .where(eq(mixpanelEvents.eventName, eventName))
      .orderBy(desc(mixpanelEvents.receivedAt))
  },

  markProcessed: async (id: string, customerId?: string): Promise<MixpanelEvent | null> => {
    const [event] = await db
      .update(mixpanelEvents)
      .set({
        processed: 1,
        customerId: customerId,
      })
      .where(eq(mixpanelEvents.id, id))
      .returning()
    return event || null
  },

  linkToCustomer: async (id: string, customerId: string): Promise<MixpanelEvent | null> => {
    const [event] = await db
      .update(mixpanelEvents)
      .set({ customerId })
      .where(eq(mixpanelEvents.id, id))
      .returning()
    return event || null
  },

  getCount: async (processedOnly: boolean = false): Promise<number> => {
    let query = db.select({ count: sql<number>`count(*)::int` }).from(mixpanelEvents)

    if (processedOnly) {
      query = query.where(eq(mixpanelEvents.processed, 1)) as typeof query
    }

    const result = await query
    return result[0]?.count || 0
  },

  getEventStats: async () => {
    const result = await db
      .select({
        eventName: mixpanelEvents.eventName,
        count: sql<number>`count(*)::int`,
      })
      .from(mixpanelEvents)
      .groupBy(mixpanelEvents.eventName)
      .orderBy(desc(sql`count(*)`))

    return result
  },

  deleteOld: async (olderThanMs: number = 90 * 24 * 60 * 60 * 1000): Promise<number> => {
    const threshold = Date.now() - olderThanMs

    await db
      .delete(mixpanelEvents)
      .where(and(eq(mixpanelEvents.processed, 1), sql`${mixpanelEvents.receivedAt} < ${threshold}`))

    return 0
  },
}
