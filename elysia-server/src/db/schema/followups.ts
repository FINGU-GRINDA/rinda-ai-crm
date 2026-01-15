import { bigint, index, pgEnum, pgTable, text } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const followUpTypeEnum = pgEnum("follow_up_type", ["email", "call", "meeting", "message"])
export const followUpStatusEnum = pgEnum("follow_up_status", ["planned", "completed", "cancelled"])
export const scheduledStatusEnum = pgEnum("scheduled_status", ["pending", "completed", "cancelled"])
export const priorityEnum = pgEnum("priority", ["high", "medium", "low"])

export const followUpHistory = pgTable(
  "follow_up_history",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: followUpTypeEnum("type").notNull(),
    content: text("content"),
    status: followUpStatusEnum("status").default("planned"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_followup_customer").on(table.customerId),
    index("idx_followup_status").on(table.status),
  ],
)

export const scheduledFollowUps = pgTable(
  "scheduled_follow_ups",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    scheduledFor: bigint("scheduled_for", { mode: "number" }).notNull(),
    type: followUpTypeEnum("type").notNull(),
    content: text("content"),
    status: scheduledStatusEnum("status").default("pending"),
    priority: priorityEnum("priority").default("medium"),
    reason: text("reason"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_scheduled_customer").on(table.customerId),
    index("idx_scheduled_status").on(table.status),
    index("idx_scheduled_for").on(table.scheduledFor),
  ],
)

export type FollowUpHistory = typeof followUpHistory.$inferSelect
export type ScheduledFollowUp = typeof scheduledFollowUps.$inferSelect
