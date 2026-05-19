/**
 * CRM Core Schema — Accounts, Persons, Contacts
 *
 * Lifted from `send-grid-test/elysia-server/src/db/schema/crm-core.ts`.
 * SQL table names are prefixed `crm_*` in this repo to avoid collision with the
 * legacy CRM tables (e.g. `customers`, `contacts`). TS export names are kept
 * canonical so lifted services compile unchanged.
 */

import { relations, sql } from "drizzle-orm"
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { uuidV7 } from "../helpers/uuid-v7"
import { workspaces } from "./workspaces"

// ============================================================================
// Shared CRM Enums
// ============================================================================

export const companySizeEnum = pgEnum("company_size_enum", [
  "1_10",
  "11_50",
  "51_200",
  "201_500",
  "501_1000",
  "1000_plus",
])

export const buyerTypeEnum = pgEnum("buyer_type_enum", [
  "buyer",
  "distributor",
  "reseller",
  "oem",
  "unknown",
])

export const crmContactKindEnum = pgEnum("crm_contact_kind_enum", [
  "email",
  "phone",
  "linkedin",
  "other",
])

// ============================================================================
// accounts — buyer companies
// ============================================================================

export const accounts = pgTable(
  "crm_accounts",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    domain: text("domain"),
    country: text("country"),
    industry: text("industry"),
    legalName: text("legal_name"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    stateRegion: text("state_region"),
    postalCode: text("postal_code"),
    taxId: text("tax_id"),
    defaultCurrency: text("default_currency"),
    websiteUrl: text("website_url"),
    description: text("description"),
    companySize: companySizeEnum("company_size"),
    buyerType: buyerTypeEnum("buyer_type"),
    timezone: text("timezone"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceNameIdx: index("crm_accounts_workspace_name_idx").on(table.workspaceId, table.name),
    /**
     * One Account per workspace per email domain. Partial so domain-less rows
     * don't collide on NULL. Catches the M:1 race on lead conversion.
     */
    workspaceDomainLowerUidx: uniqueIndex("crm_accounts_workspace_domain_lower_uidx")
      .on(table.workspaceId, sql`lower(${table.domain})`)
      .where(sql`${table.domain} IS NOT NULL`),
  }),
)

// ============================================================================
// persons — humans at an account
// ============================================================================

export const persons = pgTable(
  "crm_persons",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Nullable — a Person may exist without an Account (sender from a public-
     * domain mailbox, or a manually-created Person not yet at an org).
     */
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),

    fullName: text("full_name").notNull(),
    title: text("title"),
    department: text("department"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceAccountIdx: index("crm_persons_workspace_account_idx").on(
      table.workspaceId,
      table.accountId,
    ),
  }),
)

// ============================================================================
// contacts — channel identifiers belonging to a Person
// ============================================================================

export const contacts = pgTable(
  "crm_contacts",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),

    kind: crmContactKindEnum("kind").notNull(),
    value: text("value").notNull(),
    label: text("label"),
    isPrimary: boolean("is_primary").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    sources: text("sources").array().notNull().default(sql`ARRAY[]::text[]`),
    doNotContact: boolean("do_not_contact").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspacePersonIdx: index("crm_contacts_workspace_person_idx").on(
      table.workspaceId,
      table.personId,
    ),
    workspaceKindValueUidx: uniqueIndex("crm_contacts_workspace_kind_value_uidx").on(
      table.workspaceId,
      table.kind,
      sql`lower(${table.value})`,
    ),
  }),
)

// ============================================================================
// Relations
// ============================================================================

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [accounts.workspaceId],
    references: [workspaces.id],
  }),
  persons: many(persons),
}))

export const personsRelations = relations(persons, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [persons.workspaceId],
    references: [workspaces.id],
  }),
  account: one(accounts, {
    fields: [persons.accountId],
    references: [accounts.id],
  }),
  contacts: many(contacts),
}))

export const contactsRelations = relations(contacts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [contacts.workspaceId],
    references: [workspaces.id],
  }),
  person: one(persons, {
    fields: [contacts.personId],
    references: [persons.id],
  }),
}))

// ============================================================================
// Type Exports
// ============================================================================

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert
export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert

export type CompanySize = (typeof companySizeEnum.enumValues)[number]
export type BuyerType = (typeof buyerTypeEnum.enumValues)[number]
export type CrmContactKind = (typeof crmContactKindEnum.enumValues)[number]
