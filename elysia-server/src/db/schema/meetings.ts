import { bigint, index, integer, pgTable, text } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const meetingSummaries = pgTable(
  "meeting_summaries",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    meetingDate: bigint("meeting_date", { mode: "number" }).notNull(),
    audioFileUrl: text("audio_file_url"),
    duration: integer("duration"),
    summary: text("summary"),
    keyDiscussions: text("key_discussions"), // JSON array
    actionItems: text("action_items"), // JSON array
    customerNeeds: text("customer_needs"), // JSON array
    budgetMentions: text("budget_mentions"),
    timelineMentions: text("timeline_mentions"),
    nextSteps: text("next_steps"), // JSON array
    transcription: text("transcription"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_meetings_customer").on(table.customerId),
    index("idx_meetings_date").on(table.meetingDate),
  ],
)

export type MeetingSummary = typeof meetingSummaries.$inferSelect
export type NewMeetingSummary = typeof meetingSummaries.$inferInsert
