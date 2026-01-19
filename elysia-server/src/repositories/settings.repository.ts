import { eq } from "drizzle-orm"
import { db } from "../db"
import { defaultSettings, type Setting, settings } from "../db/schema"
import type {
  AllSettings,
  CalendarSettings,
  CollectionSettings,
  EmailSettings,
  MixpanelSettings,
  NotificationSettings,
  SettingsKey,
  SlackSettings,
} from "../types"

// Type for individual setting values
type SettingValue = AllSettings[SettingsKey]

// Helper to parse JSON safely
const parseSettingValue = <T>(value: string): T => {
  try {
    return JSON.parse(value) as T
  } catch {
    return value as T
  }
}

// Helper to stringify setting value
const stringifyValue = <T>(value: T): string => {
  return typeof value === "string" ? value : JSON.stringify(value)
}

export const settingsRepository = {
  // Typed getter for known setting keys
  get: async <K extends SettingsKey>(key: K): Promise<AllSettings[K] | null> => {
    const result = await db.select().from(settings).where(eq(settings.key, key))
    if (!result[0]) return null
    return parseSettingValue<AllSettings[K]>(result[0].value)
  },

  // Raw getter for dynamic keys (returns parsed JSON)
  getByKey: async (key: string): Promise<SettingValue | string | null> => {
    const result = await db.select().from(settings).where(eq(settings.key, key))
    if (!result[0]) return null
    return parseSettingValue<SettingValue | string>(result[0].value)
  },

  // Typed setter for known setting keys
  set: async <K extends SettingsKey>(key: K, value: AllSettings[K]): Promise<Setting> => {
    const valueStr = stringifyValue(value)
    const now = new Date()

    const existing = await db.select().from(settings).where(eq(settings.key, key))

    if (existing[0]) {
      const [setting] = await db
        .update(settings)
        .set({ value: valueStr, updatedAt: now })
        .where(eq(settings.key, key))
        .returning()
      if (!setting) throw new Error("Failed to update setting")
      return setting
    } else {
      const [setting] = await db
        .insert(settings)
        .values({ key, value: valueStr, updatedAt: now })
        .returning()
      if (!setting) throw new Error("Failed to create setting")
      return setting
    }
  },

  // Raw setter for dynamic keys
  setByKey: async (key: string, value: SettingValue | string): Promise<Setting> => {
    const valueStr = stringifyValue(value)
    const now = new Date()

    const existing = await db.select().from(settings).where(eq(settings.key, key))

    if (existing[0]) {
      const [setting] = await db
        .update(settings)
        .set({ value: valueStr, updatedAt: now })
        .where(eq(settings.key, key))
        .returning()
      if (!setting) throw new Error("Failed to update setting")
      return setting
    } else {
      const [setting] = await db
        .insert(settings)
        .values({ key, value: valueStr, updatedAt: now })
        .returning()
      if (!setting) throw new Error("Failed to create setting")
      return setting
    }
  },

  getAll: async (): Promise<Partial<AllSettings>> => {
    const allSettings = await db.select().from(settings)
    const result: Partial<AllSettings> = {}
    for (const setting of allSettings) {
      try {
        const key = setting.key as SettingsKey
        result[key] = JSON.parse(setting.value) as SettingValue
      } catch {
        // Skip unparseable values
      }
    }
    return result
  },

  // Slack settings
  getSlackSettings: async (): Promise<SlackSettings> => {
    const value = await settingsRepository.get("slack")
    return (value || defaultSettings.slack) as SlackSettings
  },

  updateSlackSettings: async (data: Partial<SlackSettings>) => {
    const current = await settingsRepository.getSlackSettings()
    return settingsRepository.set("slack", { ...current, ...data })
  },

  // Email settings
  getEmailSettings: async (): Promise<EmailSettings> => {
    const value = await settingsRepository.get("email")
    return (value || defaultSettings.email) as EmailSettings
  },

  updateEmailSettings: async (data: Partial<EmailSettings>) => {
    const current = await settingsRepository.getEmailSettings()
    return settingsRepository.set("email", { ...current, ...data })
  },

  // Calendar settings
  getCalendarSettings: async (): Promise<CalendarSettings> => {
    const value = await settingsRepository.get("calendar")
    return (value || defaultSettings.calendar) as CalendarSettings
  },

  updateCalendarSettings: async (data: Partial<CalendarSettings>) => {
    const current = await settingsRepository.getCalendarSettings()
    return settingsRepository.set("calendar", { ...current, ...data })
  },

  // Notification settings
  getNotificationSettings: async (): Promise<NotificationSettings> => {
    const value = await settingsRepository.get("notifications")
    return (value || defaultSettings.notifications) as NotificationSettings
  },

  updateNotificationSettings: async (data: Partial<NotificationSettings>) => {
    const current = await settingsRepository.getNotificationSettings()
    return settingsRepository.set("notifications", { ...current, ...data })
  },

  // Collection settings
  getCollectionSettings: async (): Promise<CollectionSettings> => {
    const value = await settingsRepository.get("collection")
    return (value || defaultSettings.collection) as CollectionSettings
  },

  updateCollectionSettings: async (data: Partial<CollectionSettings>) => {
    const current = await settingsRepository.getCollectionSettings()
    return settingsRepository.set("collection", { ...current, ...data })
  },

  // Mixpanel settings
  getMixpanelSettings: async (): Promise<MixpanelSettings> => {
    const value = await settingsRepository.get("mixpanel")
    return (value || defaultSettings.mixpanel) as MixpanelSettings
  },

  updateMixpanelSettings: async (data: Partial<MixpanelSettings>) => {
    const current = await settingsRepository.getMixpanelSettings()
    return settingsRepository.set("mixpanel", { ...current, ...data })
  },

  // Initialize default settings
  initializeDefaults: async () => {
    const keys = Object.keys(defaultSettings) as SettingsKey[]
    for (const key of keys) {
      const existing = await settingsRepository.get(key)
      if (!existing) {
        await settingsRepository.set(key, defaultSettings[key])
      }
    }
  },
}
