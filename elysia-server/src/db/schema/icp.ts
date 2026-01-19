import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const icpProfiles = pgTable("icp_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  industries: text("industries"), // JSON array
  keywords: text("keywords"), // JSON array
  companySize: text("company_size"),
  targetRegions: text("target_regions"), // JSON array
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type IcpProfile = typeof icpProfiles.$inferSelect
export type NewIcpProfile = typeof icpProfiles.$inferInsert
