import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    state: text("state").notNull().unique(),
    provider: text("provider").notNull(),
    flowType: text("flow_type").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_oauth_states_state").on(table.state),
    index("idx_oauth_states_expires_at").on(table.expiresAt),
  ],
)

export type OAuthState = typeof oauthStates.$inferSelect
export type NewOAuthState = typeof oauthStates.$inferInsert
