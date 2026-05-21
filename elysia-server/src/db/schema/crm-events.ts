/**
 * CRM Object Events — append-only provenance / lifecycle log.
 *
 * Lifted from `send-grid-test/elysia-server/src/db/schema/crm-events.ts`.
 * Intentionally has NO hard FKs to CRM rows: the log must survive row deletion.
 * Only `workspace_id` is FK'd (cascade) so a workspace teardown still cleans up
 * cleanly. Inserts happen in the same DB transaction as the CRM row mutation.
 */

import { relations, sql } from "drizzle-orm"
import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { uuidV7 } from "../helpers/uuid-v7"
import { users } from "./users"
import { workspaces } from "./workspaces"

// ============================================================================
// Enums
// ============================================================================

/**
 * Note: `person_contact_added` and `account_contact_added` are dead values
 * retained for Postgres compatibility (can't drop enum values once added).
 * New code emits `contact_added` against the unified `contacts` table.
 */
export const crmObjectEventTypeEnum = pgEnum("crm_object_event_type_enum", [
  "account_created",
  "account_merged_into",
  "person_created",
  "person_merged_into",
  "person_contact_added",
  "account_contact_added",
  "contact_added",
  "deal_created",
  "deal_stage_changed",
  "deal_lost_changed",
  "lead_converted",
])

/** `person_contact` and `account_contact` are dead values retained for PG compat. */
export const crmObjectTargetTypeEnum = pgEnum("crm_object_target_type_enum", [
  "account",
  "person",
  "person_contact",
  "account_contact",
  "contact",
  "deal",
])

export const crmObjectSourceTypeEnum = pgEnum("crm_object_source_type_enum", [
  "lead",
  "unipile_webhook",
  "classifier",
  "manual",
  "api",
  "csv_import",
])

// ============================================================================
// Table
// ============================================================================

export const crmObjectEvents = pgTable(
  "crm_object_events",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    eventType: crmObjectEventTypeEnum("event_type").notNull(),
    targetType: crmObjectTargetTypeEnum("target_type").notNull(),
    /** The CRM row this event is about. NO hard FK — see file header. */
    targetId: uuid("target_id").notNull(),

    sourceType: crmObjectSourceTypeEnum("source_type"),
    /** e.g., `leads.id` when `source_type = 'lead'`. No FK (decoupled by design). */
    sourceRefId: uuid("source_ref_id"),
    sourceRefText: text("source_ref_text"),

    /** NULL for system / classifier events. */
    triggeredByUserId: uuid("triggered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Populated when `source_type = 'classifier'` (0.00–1.00). */
    classifierConfidence: numeric("classifier_confidence", { precision: 3, scale: 2 }),

    notes: text("notes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceTargetIdx: index("crm_object_events_workspace_target_idx").on(
      table.workspaceId,
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
    ),
    workspaceSourceIdx: index("crm_object_events_workspace_source_idx").on(
      table.workspaceId,
      table.sourceType,
      table.sourceRefId,
    ),
    workspaceEventTypeIdx: index("crm_object_events_workspace_event_type_idx").on(
      table.workspaceId,
      table.eventType,
      table.createdAt.desc(),
    ),
  }),
)

// ============================================================================
// Relations
// ============================================================================

export const crmObjectEventsRelations = relations(crmObjectEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmObjectEvents.workspaceId],
    references: [workspaces.id],
  }),
  triggeredByUser: one(users, {
    fields: [crmObjectEvents.triggeredByUserId],
    references: [users.id],
  }),
}))

// ============================================================================
// Type Exports
// ============================================================================

export type CrmObjectEvent = typeof crmObjectEvents.$inferSelect
export type NewCrmObjectEvent = typeof crmObjectEvents.$inferInsert

export type CrmObjectEventType = (typeof crmObjectEventTypeEnum.enumValues)[number]
export type CrmObjectTargetType = (typeof crmObjectTargetTypeEnum.enumValues)[number]
export type CrmObjectSourceType = (typeof crmObjectSourceTypeEnum.enumValues)[number]
