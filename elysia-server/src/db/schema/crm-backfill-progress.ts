/**
 * CRM Email Backfill Progress — per-(workspace, email connection) cursor.
 *
 * Lifted from source with the FK repointed from the source's `userEmailAccounts`
 * to our new `crmEmailConnections`. The BullMQ worker resumes from `cursor`
 * across retries.
 */

import { relations } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { uuidV7 } from "../helpers/uuid-v7"
import { crmEmailConnections } from "./crm-email-connections"
import { workspaces } from "./workspaces"

export const crmBackfillStatusEnum = pgEnum("crm_backfill_status_enum", [
  "pending",
  "running",
  "completed",
  "failed",
])

export const crmBackfillProgress = pgTable(
  "crm_backfill_progress",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => crmEmailConnections.id, { onDelete: "cascade" }),
    status: crmBackfillStatusEnum("status").notNull().default("pending"),
    /** Opaque provider pagination cursor — null on completion / before first page. */
    cursor: text("cursor"),
    monthsBack: integer("months_back").notNull().default(12),
    pagesProcessed: integer("pages_processed").notNull().default(0),
    messagesProcessed: integer("messages_processed").notNull().default(0),
    messagesIngested: integer("messages_ingested").notNull().default(0),
    lastError: text("last_error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /**
     * NULL = never classified. Reclassify-on-deploy stamps this on each sweep
     * so a redeploy doesn't re-blast LLM cost. Bumping `CRM_RECLASSIFY_VERSION`
     * forces a global re-run.
     */
    reclassifiedAt: timestamp("reclassified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** One progress row per (workspace, email connection). */
    workspaceEmailAccountUidx: uniqueIndex("crm_backfill_progress_workspace_email_account_uidx").on(
      table.workspaceId,
      table.emailAccountId,
    ),
    workspaceStatusIdx: index("crm_backfill_progress_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),
  }),
)

export const crmBackfillProgressRelations = relations(crmBackfillProgress, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmBackfillProgress.workspaceId],
    references: [workspaces.id],
  }),
  emailAccount: one(crmEmailConnections, {
    fields: [crmBackfillProgress.emailAccountId],
    references: [crmEmailConnections.id],
  }),
}))

export type CrmBackfillProgress = typeof crmBackfillProgress.$inferSelect
export type NewCrmBackfillProgress = typeof crmBackfillProgress.$inferInsert
export type CrmBackfillStatus = (typeof crmBackfillStatusEnum.enumValues)[number]
