import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Append-only mutation log. Required for GDPR Article 30 and enterprise sales.
// Every mutating route writes here through the workspace middleware in future phases.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    // Where did this mutation originate (api/agent/system/import/webhook)
    actorType: text("actor_type").notNull().default("user"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    // Diff payloads (null for create/delete depending on direction)
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_log_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_audit_log_entity").on(table.workspaceId, table.entityType, table.entityId),
    index("idx_audit_log_actor").on(table.actorId),
  ],
)

export type AuditLogEntry = typeof auditLog.$inferSelect
export type NewAuditLogEntry = typeof auditLog.$inferInsert
