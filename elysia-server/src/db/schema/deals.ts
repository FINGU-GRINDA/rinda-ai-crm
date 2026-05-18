import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { customerContacts } from "./contacts"
import { customers } from "./customers"
import { pipelineStages, pipelines } from "./pipelines"
import { users } from "./users"
import { workspaces } from "./workspaces"

export const forecastCategoryEnum = pgEnum("deal_forecast_category", [
  "pipeline",
  "best_case",
  "commit",
  "closed",
  "omitted",
])

export const dealContactRoleEnum = pgEnum("deal_contact_role", [
  "champion",
  "economic_buyer",
  "decision_maker",
  "user",
  "blocker",
  "influencer",
])

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Human readable identifier (e.g. DEAL-2026-00123); generated from sequences table
    humanId: text("human_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // Store money as minor units (cents/won/yen) to avoid float rounding errors
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull().default(0n),
    currency: text("currency").notNull().default("USD"),
    // Snapshot of amount converted to workspace base currency at create/close time
    baseAmountMinor: bigint("base_amount_minor", { mode: "bigint" }).notNull().default(0n),
    fxRateAtClose: numeric("fx_rate_at_close", { precision: 18, scale: 8 }),
    // Override of stage default probability (0-100)
    probability: numeric("probability", { precision: 5, scale: 2 }),
    forecastCategory: forecastCategoryEnum("forecast_category").notNull().default("pipeline"),
    expectedCloseDate: date("expected_close_date"),
    actualCloseDate: date("actual_close_date"),
    // Timestamp of last stage move — primary key for rotting-deal queries
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).notNull().defaultNow(),
    lostReason: text("lost_reason"),
    source: text("source"),
    // External identifier (for Salesforce/HubSpot sync or webhooks)
    externalId: text("external_id"),
    // Custom fields keyed by definitions in `custom_field_definitions` (future phase)
    customFields: jsonb("custom_fields").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_deals_workspace_human_id").on(table.workspaceId, table.humanId),
    uniqueIndex("idx_deals_workspace_external_id")
      .on(table.workspaceId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    index("idx_deals_workspace_stage_open")
      .on(table.workspaceId, table.stageId)
      .where(sql`${table.actualCloseDate} IS NULL`),
    index("idx_deals_workspace_owner_close").on(
      table.workspaceId,
      table.ownerId,
      table.expectedCloseDate,
    ),
    index("idx_deals_workspace_customer").on(table.workspaceId, table.customerId),
    index("idx_deals_workspace_pipeline").on(table.workspaceId, table.pipelineId),
    index("idx_deals_stage_entered").on(table.workspaceId, table.stageEnteredAt),
    check(
      "deals_probability_range",
      sql`${table.probability} IS NULL OR (${table.probability} >= 0 AND ${table.probability} <= 100)`,
    ),
    check("deals_currency_iso", sql`char_length(${table.currency}) = 3`),
    check("deals_amount_positive", sql`${table.amountMinor} >= 0`),
  ],
)

export const dealStageHistory = pgTable(
  "deal_stage_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    fromStageId: uuid("from_stage_id").references(() => pipelineStages.id, {
      onDelete: "set null",
    }),
    toStageId: uuid("to_stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    durationInFromStageSeconds: bigint("duration_in_from_stage_seconds", { mode: "bigint" }),
    note: text("note"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_deal_stage_history_deal").on(table.workspaceId, table.dealId, table.changedAt),
    index("idx_deal_stage_history_workspace_changed").on(table.workspaceId, table.changedAt),
  ],
)

export const dealContacts = pgTable(
  "deal_contacts",
  {
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => customerContacts.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: dealContactRoleEnum("role").notNull().default("user"),
    isPrimary: numeric("is_primary", { precision: 1, scale: 0 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.dealId, table.contactId] }),
    index("idx_deal_contacts_workspace").on(table.workspaceId),
    index("idx_deal_contacts_contact").on(table.contactId),
  ],
)

export type Deal = typeof deals.$inferSelect
export type NewDeal = typeof deals.$inferInsert
export type DealStageHistory = typeof dealStageHistory.$inferSelect
export type NewDealStageHistory = typeof dealStageHistory.$inferInsert
export type DealContact = typeof dealContacts.$inferSelect
export type NewDealContact = typeof dealContacts.$inferInsert
export type ForecastCategory = (typeof forecastCategoryEnum.enumValues)[number]
export type DealContactRole = (typeof dealContactRoleEnum.enumValues)[number]
