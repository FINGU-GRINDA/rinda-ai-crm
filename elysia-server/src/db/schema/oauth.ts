import { bigint, index, integer, pgTable, text } from "drizzle-orm/pg-core"

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    provider: text("provider").notNull().unique(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: bigint("expires_at", { mode: "number" }),
    scope: text("scope"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("idx_oauth_provider").on(table.provider)],
)

export type OAuthToken = typeof oauthTokens.$inferSelect
export type NewOAuthToken = typeof oauthTokens.$inferInsert
