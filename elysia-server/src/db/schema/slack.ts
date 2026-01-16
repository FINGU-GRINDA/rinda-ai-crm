import { bigint, index, integer, pgTable, text } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { prospects } from "./prospects"

export const slackMessages = pgTable(
  "slack_messages",
  {
    id: text("id").primaryKey(),
    slackTs: text("slack_ts").unique(),
    channelId: text("channel_id"),
    userId: text("user_id"),
    userName: text("user_name"),
    text: text("text"),
    threadTs: text("thread_ts"),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    prospectId: text("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
    processed: integer("processed").default(0),
    deleted: integer("deleted").default(0),
    deletedAt: text("deleted_at"),
    receivedAt: bigint("received_at", { mode: "number" }).notNull(),
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
