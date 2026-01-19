import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { priorityEnum } from "./followups"
import { prospects } from "./prospects"

export const notificationTypeEnum = pgEnum("notification_type", [
  "news",
  "followup",
  "lost_deal",
  "prospect",
  "meeting",
  "email",
  "risk",
  "slack",
])

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
    priority: priorityEnum("priority").default("medium"),
    read: integer("read").default(0),
    actionUrl: text("action_url"),
    metadata: text("metadata"), // JSON
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notifications_read").on(table.read),
    index("idx_notifications_created").on(table.createdAt),
    index("idx_notifications_type").on(table.type),
  ],
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
