import { bigint, index, pgTable, text } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const emailMessages = pgTable(
  "email_messages",
  {
    id: text("id").primaryKey(),
    gmailMessageId: text("gmail_message_id").unique(),
    threadId: text("thread_id"),
    subject: text("subject"),
    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    body: text("body"),
    date: bigint("date", { mode: "number" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    syncedAt: bigint("synced_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_emails_customer").on(table.customerId),
    index("idx_emails_gmail_id").on(table.gmailMessageId),
    index("idx_emails_date").on(table.date),
  ],
)

export type EmailMessage = typeof emailMessages.$inferSelect
export type NewEmailMessage = typeof emailMessages.$inferInsert
