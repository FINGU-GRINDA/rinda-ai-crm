import { bigint, index, integer, pgTable, text } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const mixpanelEvents = pgTable(
  "mixpanel_events",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    distinctId: text("distinct_id"),
    properties: text("properties"), // JSON
    receivedAt: bigint("received_at", { mode: "number" }).notNull(),
    processed: integer("processed").default(0),
    customerId: text("customer_id").references(() => customers.id),
    createdAt: bigint("created_at", { mode: "number" }),
  },
  (table) => [
    index("idx_mixpanel_events_distinct_id").on(table.distinctId),
    index("idx_mixpanel_events_processed").on(table.processed),
    index("idx_mixpanel_events_event_name").on(table.eventName),
  ],
)

export type MixpanelEvent = typeof mixpanelEvents.$inferSelect
export type NewMixpanelEvent = typeof mixpanelEvents.$inferInsert
