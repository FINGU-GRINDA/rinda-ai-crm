import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import type { AllSettings } from "../../types"
import { workspaces } from "./workspaces"

export const settings = pgTable(
  "settings",
  {
    key: text("key").primaryKey(),
    // Future: composite key (workspaceId, key) for per-workspace settings.
    // Null = global default; populated rows will scope to a workspace.
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_settings_workspace").on(table.workspaceId)],
)

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert

// Default settings values
export const defaultSettings: AllSettings = {
  slack: {
    webhookUrl: "",
    isEnabled: false,
    notifications: {
      newProspect: true,
      followUpReminder: true,
      dealWon: false,
      dealLost: false,
    },
    isValidated: false,
    eventApiEnabled: false,
  },
  email: {
    provider: null,
    isConnected: false,
    autoSync: false,
    syncInterval: 3600000,
    lastSyncAt: null,
  },
  calendar: {
    provider: null,
    isConnected: false,
    autoSync: false,
    syncInterval: 3600000,
    meetingPrepEnabled: true,
  },
  notifications: {
    browser: {
      enabled: true,
      types: {
        followUp: true,
        meeting: true,
        news: true,
        risk: true,
        prospect: true,
      },
    },
    email: {
      enabled: false,
      dailyDigest: false,
      digestTime: "09:00",
    },
  },
  collection: {
    autoCollect: false,
    interval: 3600000,
    lastRun: null,
  },
  mixpanel: {
    enabled: false,
    projectToken: "",
    apiSecret: "",
    autoCreateLeads: true,
    eventMappings: {},
  },
}
