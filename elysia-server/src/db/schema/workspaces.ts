import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { users } from "./users"

export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
])

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    // Locale / region defaults applied to new workspaces in this org
    defaultLocale: text("default_locale").notNull().default("en-US"),
    defaultCurrency: text("default_currency").notNull().default("USD"),
    defaultTimezone: text("default_timezone").notNull().default("UTC"),
    // ISO-3166 region tag used for data residency decisions in Phase 2 GDPR work
    region: text("region").notNull().default("global"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_organizations_slug").on(table.slug),
    index("idx_organizations_region").on(table.region),
  ],
)

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // Effective settings (override organization defaults if set)
    locale: text("locale").notNull().default("en-US"),
    baseCurrency: text("base_currency").notNull().default("USD"),
    timezone: text("timezone").notNull().default("UTC"),
    // Future-proofing for sandbox / staging workspaces
    isSandbox: integer("is_sandbox").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_workspaces_org_slug").on(table.organizationId, table.slug),
    index("idx_workspaces_org").on(table.organizationId),
    index("idx_workspaces_archived").on(table.archivedAt),
  ],
)

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceMemberRoleEnum("role").notNull().default("member"),
    // Per-user preferences within this workspace
    locale: text("locale"),
    timezone: text("timezone"),
    isDefault: integer("is_default").notNull().default(0),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_workspace_members_unique").on(table.workspaceId, table.userId),
    index("idx_workspace_members_user").on(table.userId),
    index("idx_workspace_members_workspace").on(table.workspaceId),
    index("idx_workspace_members_default").on(table.userId, table.isDefault),
  ],
)

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceMemberRoleEnum("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workspace_invitations_workspace").on(table.workspaceId),
    index("idx_workspace_invitations_email").on(table.email),
    uniqueIndex("idx_workspace_invitations_token").on(table.token),
    index("idx_workspace_invitations_expires").on(table.expiresAt),
  ],
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
export type WorkspaceMemberRole = (typeof workspaceMemberRoleEnum.enumValues)[number]
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect
export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert
