import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { prospects } from "./prospects"

export const slackMessages = pgTable(
  "slack_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slackTs: text("slack_ts").unique(),
    channelId: text("channel_id"),
    userId: text("user_id"),
    userName: text("user_name"),
    text: text("text"),
    threadTs: text("thread_ts"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
    processed: integer("processed").default(0),
    deleted: integer("deleted").default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    // Error tracking fields
    processingError: text("processing_error"),
    retryCount: integer("retry_count").default(0),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_slack_customer").on(table.customerId),
    index("idx_slack_prospect").on(table.prospectId),
    index("idx_slack_processed").on(table.processed),
    index("idx_slack_deleted").on(table.deleted),
    index("idx_slack_received").on(table.receivedAt),
  ],
)

export type SlackMessage = typeof slackMessages.$inferSelect
export type NewSlackMessage = typeof slackMessages.$inferInsert
