import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { workspaces } from "./workspaces"

export const signalStrengthEnum = pgEnum("signal_strength", ["high", "medium", "low"])

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    website: text("website"),
    industry: text("industry"),
    sourceTitle: text("source_title"),
    sourceUri: text("source_uri"),
    sourcePublishedAt: text("source_published_at"),
    signalStrength: signalStrengthEnum("signal_strength").default("medium"),
    icpMatch: text("icp_match"),
    notes: text("notes"),

    // Contact information
    contactName: text("contact_name"),
    contactTitle: text("contact_title"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    landingPageUrl: text("landing_page_url"),

    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    convertedToCustomerId: uuid("converted_to_customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    dismissed: boolean("dismissed").notNull().default(false),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissReason: text("dismiss_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_prospects_company").on(table.companyName),
    index("idx_prospects_signal").on(table.signalStrength),
    index("idx_prospects_detected").on(table.detectedAt),
    index("idx_prospects_email").on(table.contactEmail),
    index("idx_prospects_workspace").on(table.workspaceId),
    index("idx_prospects_workspace_signal").on(table.workspaceId, table.signalStrength),
  ],
)

export type Prospect = typeof prospects.$inferSelect
export type NewProspect = typeof prospects.$inferInsert
