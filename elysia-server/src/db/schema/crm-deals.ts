/**
 * CRM Deals Schema — deals, deal_persons, deal_accounts, messages
 *
 * Lifted from `send-grid-test/elysia-server/src/db/schema/crm-deals.ts`. SQL
 * table names prefixed `crm_*` to avoid collision with the legacy `deals` table.
 * TS exports kept canonical.
 */

import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { uuidV7 } from "../helpers/uuid-v7"
import { accounts, contacts, persons } from "./crm-core"
import { workspaces } from "./workspaces"

// ============================================================================
// Enums
// ============================================================================

export const dealStageEnum = pgEnum("deal_stage_enum", [
  "engaged",
  "in_conversation",
  "negotiating",
  "confirmed",
  "contract",
])

export const crmMessageChannelEnum = pgEnum("crm_message_channel_enum", [
  "email",
  "linkedin_dm",
  "linkedin_inmail",
  "web_form",
  "meeting_note",
  "sms",
  "system",
])

export const crmMessageDirectionEnum = pgEnum("crm_message_direction_enum", ["inbound", "outbound"])

// ============================================================================
// deals — sales opportunities
// ============================================================================

/** `{ [fieldName: string]: { userId: uuid, timestamp: ISO8601 } }`. Locked fields survive classifier re-runs. */
export interface DealFieldOverrides {
  [fieldName: string]: { userId: string; timestamp: string }
}

export const deals = pgTable(
  "crm_deals",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    dealStage: dealStageEnum("deal_stage").notNull().default("engaged"),
    dealSize: numeric("deal_size", { precision: 14, scale: 2 }),
    currency: text("currency"),
    expectedCloseDate: date("expected_close_date"),
    /**
     * Soft-archive flag. NULL = active; non-NULL = lost. Orthogonal to
     * `deal_stage` (the deal keeps its last historical stage for clarity).
     * Server stamps `NOW()` on lost-write to avoid client clock drift.
     */
    lostAt: timestamp("lost_at", { withTimezone: true }),
    incoterms: text("incoterms"),
    paymentTerms: text("payment_terms"),

    fieldOverrides: jsonb("field_overrides")
      .$type<DealFieldOverrides>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isBackfilled: boolean("is_backfilled").notNull().default(false),
    /**
     * Provider thread id this Deal materialized from. NULL for manual deals.
     * Partial-unique guarantees one Deal per (workspace, thread).
     */
    threadExternalId: text("thread_external_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceStageIdx: index("crm_deals_workspace_stage_idx").on(
      table.workspaceId,
      table.dealStage,
    ),
    workspaceThreadUidx: uniqueIndex("crm_deals_workspace_thread_uidx")
      .on(table.workspaceId, table.threadExternalId)
      .where(sql`${table.threadExternalId} IS NOT NULL`),
  }),
)

// ============================================================================
// deal_persons — M:M Deal ↔ Person
// ============================================================================

export const dealPersonRoleEnum = pgEnum("deal_person_role_enum", [
  "champion",
  "decision_maker",
  "influencer",
  "gatekeeper",
  "user",
  "other",
])

export const dealPersons = pgTable(
  "crm_deal_persons",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    role: dealPersonRoleEnum("role"),
    isPrimary: boolean("is_primary").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceDealPersonUidx: uniqueIndex("crm_deal_persons_workspace_deal_person_uidx").on(
      table.workspaceId,
      table.dealId,
      table.personId,
    ),
    /** Max one primary champion per Deal. */
    workspaceDealPrimaryUidx: uniqueIndex("crm_deal_persons_workspace_deal_primary_uidx")
      .on(table.workspaceId, table.dealId)
      .where(sql`${table.isPrimary}`),
    workspaceDealIdx: index("crm_deal_persons_workspace_deal_idx").on(
      table.workspaceId,
      table.dealId,
    ),
    workspacePersonIdx: index("crm_deal_persons_workspace_person_idx").on(
      table.workspaceId,
      table.personId,
    ),
  }),
)

// ============================================================================
// deal_accounts — M:M Deal ↔ Account
// ============================================================================

export const dealAccountRoleEnum = pgEnum("deal_account_role_enum", [
  "buyer",
  "partner",
  "distributor",
  "end_customer",
  "other",
])

export const dealAccounts = pgTable(
  "crm_deal_accounts",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: dealAccountRoleEnum("role"),
    isPrimary: boolean("is_primary").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceDealAccountUidx: uniqueIndex("crm_deal_accounts_workspace_deal_account_uidx").on(
      table.workspaceId,
      table.dealId,
      table.accountId,
    ),
    workspaceDealPrimaryUidx: uniqueIndex("crm_deal_accounts_workspace_deal_primary_uidx")
      .on(table.workspaceId, table.dealId)
      .where(sql`${table.isPrimary}`),
    workspaceDealIdx: index("crm_deal_accounts_workspace_deal_idx").on(
      table.workspaceId,
      table.dealId,
    ),
    workspaceAccountIdx: index("crm_deal_accounts_workspace_account_idx").on(
      table.workspaceId,
      table.accountId,
    ),
  }),
)

// ============================================================================
// messages — unified comms log
// ============================================================================

export const messages = pgTable(
  "crm_messages",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * The specific channel id this message addressed. NULL only for `system` /
     * `meeting_note` channels — enforced by the CHECK below. `ON DELETE cascade`
     * (CHECK requires `contact_id NOT NULL` for real channels, so `set null`
     * would refuse to delete the contact).
     */
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),

    channel: crmMessageChannelEnum("channel").notNull(),
    direction: crmMessageDirectionEnum("direction").notNull(),

    externalMessageId: text("external_message_id"),
    /** Provider thread id — NOT for Deal attribution; Deal derived via Person/Account walk. */
    threadExternalId: text("thread_external_id"),

    subject: text("subject"),
    body: text("body").notNull(),
    /** Classifier outputs: intent, entities, signals. */
    extractionJson: jsonb("extraction_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceContactSentIdx: index("crm_messages_workspace_contact_sent_idx").on(
      table.workspaceId,
      table.contactId,
      table.sentAt.desc(),
    ),
    workspaceThreadExternalIdx: index("crm_messages_workspace_thread_external_idx").on(
      table.workspaceId,
      table.threadExternalId,
    ),
    /**
     * Partial-unique so concurrent ingests (webhook retry storm + backfill in
     * parallel) can't produce duplicate Message rows.
     */
    workspaceExternalMessageUidx: uniqueIndex("crm_messages_workspace_external_message_uidx")
      .on(table.workspaceId, table.externalMessageId)
      .where(sql`${table.externalMessageId} IS NOT NULL`),
    /** Addressable channels require `contact_id`; system/meeting_note leave it NULL. */
    contactRequiredCheck: check(
      "crm_messages_contact_required_check",
      sql`(
        (${table.channel} IN ('email', 'linkedin_dm', 'linkedin_inmail', 'web_form', 'sms')
          AND ${table.contactId} IS NOT NULL)
        OR (${table.channel} IN ('system', 'meeting_note'))
      )`,
    ),
  }),
)

// ============================================================================
// Relations
// ============================================================================

export const dealsRelations = relations(deals, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [deals.workspaceId],
    references: [workspaces.id],
  }),
  persons: many(dealPersons),
  accounts: many(dealAccounts),
}))

export const dealPersonsRelations = relations(dealPersons, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dealPersons.workspaceId],
    references: [workspaces.id],
  }),
  deal: one(deals, {
    fields: [dealPersons.dealId],
    references: [deals.id],
  }),
  person: one(persons, {
    fields: [dealPersons.personId],
    references: [persons.id],
  }),
}))

export const dealAccountsRelations = relations(dealAccounts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dealAccounts.workspaceId],
    references: [workspaces.id],
  }),
  deal: one(deals, {
    fields: [dealAccounts.dealId],
    references: [deals.id],
  }),
  account: one(accounts, {
    fields: [dealAccounts.accountId],
    references: [accounts.id],
  }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [messages.workspaceId],
    references: [workspaces.id],
  }),
  contact: one(contacts, {
    fields: [messages.contactId],
    references: [contacts.id],
  }),
}))

// ============================================================================
// Type Exports
// ============================================================================

export type Deal = typeof deals.$inferSelect
export type NewDeal = typeof deals.$inferInsert
export type DealPerson = typeof dealPersons.$inferSelect
export type NewDealPerson = typeof dealPersons.$inferInsert
export type DealAccount = typeof dealAccounts.$inferSelect
export type NewDealAccount = typeof dealAccounts.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type DealStage = (typeof dealStageEnum.enumValues)[number]
export type DealPersonRole = (typeof dealPersonRoleEnum.enumValues)[number]
export type DealAccountRole = (typeof dealAccountRoleEnum.enumValues)[number]
export type CrmMessageChannel = (typeof crmMessageChannelEnum.enumValues)[number]
export type CrmMessageDirection = (typeof crmMessageDirectionEnum.enumValues)[number]
