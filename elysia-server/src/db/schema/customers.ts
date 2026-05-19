import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

export const customerStatusEnum = pgEnum("customer_status", [
  "prospect",
  "new",
  "contact",
  "negotiation",
  "won",
  "lost",
])

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Nullable during Phase 0 backfill; future migration enforces NOT NULL.
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    notes: text("notes"),
    status: customerStatusEnum("status").default("new"),
    lostReason: text("lost_reason"),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    lastFollowUpAt: timestamp("last_follow_up_at", { withTimezone: true }),
    lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),
    // Lead tracking fields
    leadSource: text("lead_source"), // "Meta Ads", "Instagram", "Website", "Referral"
    initialInquiry: text("initial_inquiry"), // Store first inquiry content
    sourceOfInquiry: text("source_of_inquiry"), // Detailed source info
    landingPageUrl: text("landing_page_url"), // First landing page URL from CS channel
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_customers_workspace").on(table.workspaceId),
    index("idx_customers_workspace_status").on(table.workspaceId, table.status),
    index("idx_customers_workspace_industry").on(table.workspaceId, table.industry),
    index("idx_customers_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_customers_status").on(table.status),
    index("idx_customers_name").on(table.name),
    index("idx_customers_industry").on(table.industry),
    index("idx_customers_created_at").on(table.createdAt),
  ],
)

export const customerEnrichments = pgTable(
  "customer_enrichments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    summary: text("summary"),
    ceo: text("ceo"),
    foundedYear: text("founded_year"),
    recentNews: text("recent_news"),
    competitors: text("competitors"),
    salesOpportunity: text("sales_opportunity"),
    sources: text("sources"),
    // Follow-up strategy fields (generated with enrichment)
    followUpRecommendedTiming: text("followup_recommended_timing"),
    followUpApproach: text("followup_approach"),
    followUpMessageTone: text("followup_message_tone"),
    followUpKeyPoints: text("followup_key_points"), // JSON string[]
    followUpProbability: text("followup_probability"), // high|medium|low
    followUpReasoning: text("followup_reasoning"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_enrichments_customer").on(table.customerId),
    index("idx_enrichments_workspace").on(table.workspaceId),
  ],
)

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    // Proposal status and feedback tracking
    proposalStatus: text("proposal_status"), // "draft", "sent", "accepted", "rejected"
    feedback: text("feedback"), // Customer feedback on proposal
    feedbackReceivedAt: timestamp("feedback_received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_proposals_customer").on(table.customerId),
    index("idx_proposals_workspace").on(table.workspaceId),
  ],
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type CustomerEnrichment = typeof customerEnrichments.$inferSelect
export type Proposal = typeof proposals.$inferSelect
