import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { workspaces } from "./workspaces"

export const followUpTypeEnum = pgEnum("follow_up_type", ["email", "call", "meeting", "message"])
export const followUpStatusEnum = pgEnum("follow_up_status", ["planned", "completed", "cancelled"])
export const scheduledStatusEnum = pgEnum("scheduled_status", ["pending", "completed", "cancelled"])
export const priorityEnum = pgEnum("priority", ["high", "medium", "low"])

export const followUpHistory = pgTable(
  "follow_up_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: followUpTypeEnum("type").notNull(),
    content: text("content"),
    status: followUpStatusEnum("status").default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_followup_customer").on(table.customerId),
    index("idx_followup_status").on(table.status),
    index("idx_followup_workspace").on(table.workspaceId),
  ],
)

export const scheduledFollowUps = pgTable(
  "scheduled_follow_ups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    type: followUpTypeEnum("type").notNull(),
    content: text("content"),
    status: scheduledStatusEnum("status").default("pending"),
    priority: priorityEnum("priority").default("medium"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_scheduled_customer").on(table.customerId),
    index("idx_scheduled_status").on(table.status),
    index("idx_scheduled_for").on(table.scheduledFor),
    index("idx_scheduled_workspace").on(table.workspaceId),
  ],
)

export type FollowUpHistory = typeof followUpHistory.$inferSelect
export type ScheduledFollowUp = typeof scheduledFollowUps.$inferSelect
