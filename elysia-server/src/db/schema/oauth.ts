import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    provider: text("provider").notNull().unique(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_oauth_provider").on(table.provider)],
)

export type OAuthToken = typeof oauthTokens.$inferSelect
export type NewOAuthToken = typeof oauthTokens.$inferInsert
