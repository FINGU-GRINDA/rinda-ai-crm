import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers, proposals } from "./customers"
import { workspaces } from "./workspaces"

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    gmailMessageId: text("gmail_message_id").unique(),
    threadId: text("thread_id"),
    subject: text("subject"),
    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    body: text("body"),
    date: timestamp("date", { withTimezone: true }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    // Email type and proposal tracking
    emailType: text("email_type"), // "draft", "sent", "received"
    relatedProposalId: uuid("related_proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_emails_customer").on(table.customerId),
    index("idx_emails_gmail_id").on(table.gmailMessageId),
    index("idx_emails_date").on(table.date),
    index("idx_emails_workspace").on(table.workspaceId),
  ],
)

export type EmailMessage = typeof emailMessages.$inferSelect
export type NewEmailMessage = typeof emailMessages.$inferInsert
