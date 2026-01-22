import { and, desc, eq, gte, lte } from "drizzle-orm"
import { db } from "../db"
import { type MeetingSummary, meetingSummaries, type NewMeetingSummary } from "../db/schema"

export const meetingRepository = {
  findByCustomerId: async (customerId: string): Promise<MeetingSummary[]> => {
    return db
      .select()
      .from(meetingSummaries)
      .where(eq(meetingSummaries.customerId, customerId))
      .orderBy(desc(meetingSummaries.meetingDate))
  },

  findById: async (id: string): Promise<MeetingSummary | null> => {
    const result = await db.select().from(meetingSummaries).where(eq(meetingSummaries.id, id))
    return result[0] || null
  },

  findRecent: async (limit: number = 10): Promise<MeetingSummary[]> => {
    return db
      .select()
      .from(meetingSummaries)
      .orderBy(desc(meetingSummaries.meetingDate))
      .limit(limit)
  },

  findByDateRange: async (startDate: Date, endDate: Date): Promise<MeetingSummary[]> => {
    return db
      .select()
      .from(meetingSummaries)
      .where(
        and(
          gte(meetingSummaries.meetingDate, startDate),
          lte(meetingSummaries.meetingDate, endDate),
        ),
      )
      .orderBy(desc(meetingSummaries.meetingDate))
  },

  // Find by Slack timestamp for duplicate detection
  findBySlackTs: async (slackTs: string): Promise<MeetingSummary | null> => {
    const result = await db
      .select()
      .from(meetingSummaries)
      .where(eq(meetingSummaries.slackTs, slackTs))
    return result[0] || null
  },

  // Find meeting for a customer on the same day (for Slack dedup)
  findByCustomerAndDate: async (customerId: string, date: Date): Promise<MeetingSummary | null> => {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const result = await db
      .select()
      .from(meetingSummaries)
      .where(
        and(
          eq(meetingSummaries.customerId, customerId),
          gte(meetingSummaries.meetingDate, startOfDay),
          lte(meetingSummaries.meetingDate, endOfDay),
        ),
      )
      .orderBy(desc(meetingSummaries.meetingDate))
      .limit(1)

    return result[0] || null
  },

  create: async (data: Partial<NewMeetingSummary>): Promise<MeetingSummary> => {
    const [meeting] = await db
      .insert(meetingSummaries)
      .values({
        customerId: data.customerId || "",
        title: data.title || "",
        meetingDate: data.meetingDate || new Date(),
        audioFileUrl: data.audioFileUrl,
        duration: data.duration,
        summary: data.summary,
        keyDiscussions: data.keyDiscussions,
        actionItems: data.actionItems,
        customerNeeds: data.customerNeeds,
        budgetMentions: data.budgetMentions,
        timelineMentions: data.timelineMentions,
        nextSteps: data.nextSteps,
        transcription: data.transcription,
        source: data.source || "manual",
        slackTs: data.slackTs,
        slackChannelId: data.slackChannelId,
      })
      .returning()
    if (!meeting) throw new Error("Failed to create meeting summary")
    return meeting
  },

  update: async (id: string, data: Partial<NewMeetingSummary>): Promise<MeetingSummary | null> => {
    const [meeting] = await db
      .update(meetingSummaries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(meetingSummaries.id, id))
      .returning()
    return meeting || null
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(meetingSummaries).where(eq(meetingSummaries.id, id))
    return true
  },

  updateSummary: async (
    id: string,
    summaryData: {
      summary?: string
      keyDiscussions?: string
      actionItems?: string
      customerNeeds?: string
      budgetMentions?: string
      timelineMentions?: string
      nextSteps?: string
    },
  ): Promise<MeetingSummary | null> => {
    const [meeting] = await db
      .update(meetingSummaries)
      .set({ ...summaryData, updatedAt: new Date() })
      .where(eq(meetingSummaries.id, id))
      .returning()
    return meeting || null
  },
}
