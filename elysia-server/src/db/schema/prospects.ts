import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const signalStrengthEnum = pgEnum("signal_strength", ["high", "medium", "low"])

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyName: text("company_name").notNull(),
    website: text("website"),
    industry: text("industry"),
    sourceTitle: text("source_title"),
    sourceUri: text("source_uri"),
    sourcePublishedAt: text("source_published_at"),
    signalStrength: signalStrengthEnum("signal_strength").default("medium"),
    icpMatch: text("icp_match"),
    notes: text("notes"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    convertedToCustomerId: uuid("converted_to_customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_prospects_company").on(table.companyName),
    index("idx_prospects_signal").on(table.signalStrength),
    index("idx_prospects_detected").on(table.detectedAt),
  ],
)

export type Prospect = typeof prospects.$inferSelect
export type NewProspect = typeof prospects.$inferInsert
