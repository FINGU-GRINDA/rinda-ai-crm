import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_enrichments_customer").on(table.customerId)],
)

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  (table) => [index("idx_proposals_customer").on(table.customerId)],
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type CustomerEnrichment = typeof customerEnrichments.$inferSelect
export type Proposal = typeof proposals.$inferSelect
