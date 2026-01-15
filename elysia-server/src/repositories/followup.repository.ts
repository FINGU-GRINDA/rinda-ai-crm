import { and, desc, eq, gte, lte } from "drizzle-orm"
import { db } from "../db"
import {
  type FollowUpHistory,
  followUpHistory,
  type ScheduledFollowUp,
  scheduledFollowUps,
} from "../db/schema"
import { generateId } from "../utils/id-generator"

export const followUpRepository = {
  // Follow-up History
  findHistoryByCustomerId: async (customerId: string): Promise<FollowUpHistory[]> => {
    return db
      .select()
      .from(followUpHistory)
      .where(eq(followUpHistory.customerId, customerId))
      .orderBy(desc(followUpHistory.createdAt))
  },

  createHistory: async (data: {
    customerId: string
    type: "email" | "call" | "meeting" | "message"
    content?: string
    status?: "planned" | "completed" | "cancelled"
  }): Promise<FollowUpHistory> => {
    const [history] = await db
      .insert(followUpHistory)
      .values({
        id: generateId(),
        customerId: data.customerId,
        type: data.type,
        content: data.content,
        status: data.status || "planned",
        createdAt: Date.now(),
      })
      .returning()
    if (!history) throw new Error("Failed to create follow-up history")
    return history
  },

  updateHistoryStatus: async (
    id: string,
    status: "planned" | "completed" | "cancelled",
  ): Promise<FollowUpHistory | null> => {
    const [history] = await db
      .update(followUpHistory)
      .set({ status })
      .where(eq(followUpHistory.id, id))
      .returning()
    return history || null
  },

  // Scheduled Follow-ups
  findScheduledByCustomerId: async (customerId: string): Promise<ScheduledFollowUp[]> => {
    return db
      .select()
      .from(scheduledFollowUps)
      .where(eq(scheduledFollowUps.customerId, customerId))
      .orderBy(scheduledFollowUps.scheduledFor)
  },

  findPendingScheduled: async (): Promise<ScheduledFollowUp[]> => {
    return db
      .select()
      .from(scheduledFollowUps)
      .where(eq(scheduledFollowUps.status, "pending"))
      .orderBy(scheduledFollowUps.scheduledFor)
  },

  findDueScheduled: async (beforeTime?: number): Promise<ScheduledFollowUp[]> => {
    const time = beforeTime || Date.now()
    return db
      .select()
      .from(scheduledFollowUps)
      .where(
        and(eq(scheduledFollowUps.status, "pending"), lte(scheduledFollowUps.scheduledFor, time)),
      )
      .orderBy(scheduledFollowUps.scheduledFor)
  },

  findScheduledByDateRange: async (
    startDate: number,
    endDate: number,
  ): Promise<ScheduledFollowUp[]> => {
    return db
      .select()
      .from(scheduledFollowUps)
      .where(
        and(
          gte(scheduledFollowUps.scheduledFor, startDate),
          lte(scheduledFollowUps.scheduledFor, endDate),
        ),
      )
      .orderBy(scheduledFollowUps.scheduledFor)
  },

  createScheduled: async (data: {
    customerId: string
    scheduledFor: number
    type: "email" | "call" | "meeting" | "message"
    content?: string
    priority?: "high" | "medium" | "low"
    reason?: string
  }): Promise<ScheduledFollowUp> => {
    const [scheduled] = await db
      .insert(scheduledFollowUps)
      .values({
        id: generateId(),
        customerId: data.customerId,
        scheduledFor: data.scheduledFor,
        type: data.type,
        content: data.content,
        status: "pending",
        priority: data.priority || "medium",
        reason: data.reason,
        createdAt: Date.now(),
      })
      .returning()
    if (!scheduled) throw new Error("Failed to create scheduled follow-up")
    return scheduled
  },

  updateScheduledStatus: async (
    id: string,
    status: "pending" | "completed" | "cancelled",
  ): Promise<ScheduledFollowUp | null> => {
    const [scheduled] = await db
      .update(scheduledFollowUps)
      .set({ status })
      .where(eq(scheduledFollowUps.id, id))
      .returning()
    return scheduled || null
  },

  completeScheduled: async (id: string): Promise<ScheduledFollowUp | null> => {
    return followUpRepository.updateScheduledStatus(id, "completed")
  },

  cancelScheduled: async (id: string): Promise<ScheduledFollowUp | null> => {
    return followUpRepository.updateScheduledStatus(id, "cancelled")
  },

  deleteScheduled: async (id: string): Promise<boolean> => {
    await db.delete(scheduledFollowUps).where(eq(scheduledFollowUps.id, id))
    return true
  },
}
