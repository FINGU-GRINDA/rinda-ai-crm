import { bigint, index, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core"

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
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    notes: text("notes"),
    status: customerStatusEnum("status").default("new"),
    lostReason: text("lost_reason"),
    lostAt: bigint("lost_at", { mode: "number" }),
    lastFollowUpAt: bigint("last_follow_up_at", { mode: "number" }),
    lastEnrichedAt: bigint("last_enriched_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
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
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    summary: text("summary"),
    ceo: text("ceo"),
    foundedYear: text("founded_year"),
    recentNews: text("recent_news"),
    competitors: text("competitors"),
    salesOpportunity: text("sales_opportunity"),
    sources: text("sources"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("idx_enrichments_customer").on(table.customerId)],
)

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("idx_proposals_customer").on(table.customerId)],
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type CustomerEnrichment = typeof customerEnrichments.$inferSelect
export type Proposal = typeof proposals.$inferSelect
