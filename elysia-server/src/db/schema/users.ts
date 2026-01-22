import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    picture: text("picture"),
    googleId: text("google_id").unique(),

    // Token versioning for revocation
    tokenVersion: integer("token_version").notNull().default(0),

    // Email verification
    emailVerified: integer("email_verified").notNull().default(0),
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpiry: timestamp("email_verification_expiry", { withTimezone: true }),

    // Password reset
    passwordResetToken: text("password_reset_token"),
    passwordResetExpiry: timestamp("password_reset_expiry", { withTimezone: true }),

    // Account status
    isActive: integer("is_active").notNull().default(1),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_google_id").on(table.googleId),
    index("idx_users_token_version").on(table.tokenVersion),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
