import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const mixpanelEvents = pgTable(
  "mixpanel_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventName: text("event_name").notNull(),
    distinctId: text("distinct_id"),
    properties: text("properties"), // JSON
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processed: integer("processed").default(0),
    customerId: uuid("customer_id").references(() => customers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mixpanel_events_distinct_id").on(table.distinctId),
    index("idx_mixpanel_events_processed").on(table.processed),
    index("idx_mixpanel_events_event_name").on(table.eventName),
  ],
)

export type MixpanelEvent = typeof mixpanelEvents.$inferSelect
export type NewMixpanelEvent = typeof mixpanelEvents.$inferInsert
