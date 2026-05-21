/**
 * CRM Email Connections — workspace-scoped mailbox bindings.
 *
 * One row per (workspace, provider, external account id). `crm_backfill_progress`
 * references this so backfill is scoped to a specific connection.
 *
 * Slice 1: only `provider = 'gmail'` is used; the Gmail EmailProvider looks up
 * the actual OAuth token via the existing `oauth_tokens` table by user id.
 * Slice 2 adds `provider = 'unipile'` and stores its account_id here.
 */

import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { uuidV7 } from "../helpers/uuid-v7"
import { workspaces } from "./workspaces"

export const crmEmailConnections = pgTable(
  "crm_email_connections",
  {
    id: uuidV7("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** "gmail" | "unipile" (slice 2). */
    provider: text("provider").notNull(),
    /** Gmail email address OR Unipile account_id — what the provider uses to identify the mailbox. */
    externalAccountId: text("external_account_id").notNull(),
    /** Human-readable label for the UI ("john@acme.com"). */
    displayName: text("display_name"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** One mailbox connection per (workspace, provider, external account). */
    workspaceProviderAccountUidx: uniqueIndex("crm_email_connections_ws_provider_account_uidx").on(
      table.workspaceId,
      table.provider,
      table.externalAccountId,
    ),
    workspaceIdx: index("crm_email_connections_workspace_idx").on(table.workspaceId),
  }),
)

export const crmEmailConnectionsRelations = relations(crmEmailConnections, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmEmailConnections.workspaceId],
    references: [workspaces.id],
  }),
}))

export type CrmEmailConnection = typeof crmEmailConnections.$inferSelect
export type NewCrmEmailConnection = typeof crmEmailConnections.$inferInsert
