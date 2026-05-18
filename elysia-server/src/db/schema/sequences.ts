import { bigint, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

// Per-workspace counters used to issue human-readable identifiers
// (e.g. DEAL-2026-00123). Postgres SERIAL leaks counts across tenants
// when shared, so each workspace owns its own sequence rows.
export const sequences = pgTable(
  "sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // e.g. 'deal', 'invoice', 'quote'
    key: text("key").notNull(),
    // Optional scope (e.g. year) — generally null
    scope: text("scope"),
    nextValue: bigint("next_value", { mode: "bigint" }).notNull().default(1n),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_sequences_workspace_key_scope").on(table.workspaceId, table.key, table.scope),
  ],
)

export type Sequence = typeof sequences.$inferSelect
export type NewSequence = typeof sequences.$inferInsert
