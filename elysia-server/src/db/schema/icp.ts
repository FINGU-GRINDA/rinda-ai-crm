import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

export const icpProfiles = pgTable(
  "icp_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    industries: text("industries"), // JSON array
    keywords: text("keywords"), // JSON array
    companySize: text("company_size"),
    targetRegions: text("target_regions"), // JSON array
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_icp_profiles_workspace").on(table.workspaceId)],
)

export type IcpProfile = typeof icpProfiles.$inferSelect
export type NewIcpProfile = typeof icpProfiles.$inferInsert
