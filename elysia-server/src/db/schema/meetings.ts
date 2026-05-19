import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { workspaces } from "./workspaces"

export const meetingSummaries = pgTable(
  "meeting_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
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
    source: text("source").default("manual"), // 'manual' | 'slack'
    slackTs: text("slack_ts"), // Slack message timestamp for traceability
    slackChannelId: text("slack_channel_id"), // Slack channel ID
    salesProposal: text("sales_proposal"), // Sales proposal from meeting note
    customerMatchConfidence: text("customer_match_confidence"), // JSON: match metadata and confidence score
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_meetings_customer").on(table.customerId),
    index("idx_meetings_date").on(table.meetingDate),
    index("idx_meetings_slack_ts").on(table.slackTs),
    index("idx_meetings_workspace").on(table.workspaceId),
    index("idx_meetings_workspace_date").on(table.workspaceId, table.meetingDate),
  ],
)

export type MeetingSummary = typeof meetingSummaries.$inferSelect
export type NewMeetingSummary = typeof meetingSummaries.$inferInsert
