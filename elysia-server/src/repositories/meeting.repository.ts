import { and, desc, eq, gte, lte } from "drizzle-orm"
import { db } from "../db"
import { type MeetingSummary, meetingSummaries, type NewMeetingSummary } from "../db/schema"
import { generateId } from "../utils/id-generator"

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

  findByDateRange: async (startDate: number, endDate: number): Promise<MeetingSummary[]> => {
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

  create: async (data: Partial<NewMeetingSummary>): Promise<MeetingSummary> => {
    const id = generateId()
    const now = Date.now()
    const [meeting] = await db
      .insert(meetingSummaries)
      .values({
        id,
        customerId: data.customerId || "",
        title: data.title || "",
        meetingDate: data.meetingDate || 0,
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
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!meeting) throw new Error("Failed to create meeting summary")
    return meeting
  },

  update: async (id: string, data: Partial<NewMeetingSummary>): Promise<MeetingSummary | null> => {
    const [meeting] = await db
      .update(meetingSummaries)
      .set({ ...data, updatedAt: Date.now() })
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
      .set({ ...summaryData, updatedAt: Date.now() })
      .where(eq(meetingSummaries.id, id))
      .returning()
    return meeting || null
  },
}
