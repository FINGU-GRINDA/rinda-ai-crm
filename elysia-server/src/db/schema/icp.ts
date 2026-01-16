import { bigint, pgTable, text } from "drizzle-orm/pg-core"

export const icpProfiles = pgTable("icp_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  industries: text("industries"), // JSON array
  keywords: text("keywords"), // JSON array
  companySize: text("company_size"),
  targetRegions: text("target_regions"), // JSON array
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
})

export type IcpProfile = typeof icpProfiles.$inferSelect
export type NewIcpProfile = typeof icpProfiles.$inferInsert
