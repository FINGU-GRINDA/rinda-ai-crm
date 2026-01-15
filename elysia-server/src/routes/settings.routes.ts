import { Elysia, t } from "elysia"
import { settingsRepository } from "../repositories"

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  // Get all settings
  .get("/", async () => {
    return settingsRepository.getAll()
  })

  // Get specific setting by dynamic key
  .get(
    "/:key",
    async ({ params, set }) => {
      const value = await settingsRepository.getByKey(params.key)
      if (value === null) {
        set.status = 404
        return { error: "Setting not found" }
      }
      return { key: params.key, value }
    },
    {
      params: t.Object({ key: t.String() }),
    },
  )

  // Update specific setting by dynamic key
  .put(
    "/:key",
    async ({ params, body }) => {
      return settingsRepository.setByKey(params.key, body.value as string)
    },
    {
      params: t.Object({ key: t.String() }),
      body: t.Object({ value: t.Unknown() }),
    },
  )

  // Slack settings
  .get("/slack", async () => {
    return settingsRepository.getSlackSettings()
  })

  .put(
    "/slack",
    async ({ body }) => {
      return settingsRepository.updateSlackSettings(body)
    },
    {
      body: t.Object({
        webhookUrl: t.Optional(t.String()),
        isEnabled: t.Optional(t.Boolean()),
        isValidated: t.Optional(t.Boolean()),
        eventApiEnabled: t.Optional(t.Boolean()),
        notifications: t.Optional(
          t.Object({
            newProspect: t.Optional(t.Boolean()),
            followUpReminder: t.Optional(t.Boolean()),
            dealWon: t.Optional(t.Boolean()),
            dealLost: t.Optional(t.Boolean()),
          }),
        ),
      }),
    },
  )

  // Email settings
  .get("/email", async () => {
    return settingsRepository.getEmailSettings()
  })

  .put(
    "/email",
    async ({ body }) => {
      return settingsRepository.updateEmailSettings(body)
    },
    {
      body: t.Object({
        provider: t.Optional(t.Union([t.String(), t.Null()])),
        isConnected: t.Optional(t.Boolean()),
        autoSync: t.Optional(t.Boolean()),
        syncInterval: t.Optional(t.Number()),
        lastSyncAt: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    },
  )

  // Calendar settings
  .get("/calendar", async () => {
    return settingsRepository.getCalendarSettings()
  })

  .put(
    "/calendar",
    async ({ body }) => {
      return settingsRepository.updateCalendarSettings(body)
    },
    {
      body: t.Object({
        provider: t.Optional(t.Union([t.String(), t.Null()])),
        isConnected: t.Optional(t.Boolean()),
        autoSync: t.Optional(t.Boolean()),
        syncInterval: t.Optional(t.Number()),
        meetingPrepEnabled: t.Optional(t.Boolean()),
      }),
    },
  )

  // Notification settings
  .get("/notifications", async () => {
    return settingsRepository.getNotificationSettings()
  })

  .put(
    "/notifications",
    async ({ body }) => {
      return settingsRepository.updateNotificationSettings(body)
    },
    {
      body: t.Object({
        browser: t.Optional(
          t.Object({
            enabled: t.Optional(t.Boolean()),
            types: t.Optional(
              t.Object({
                followUp: t.Optional(t.Boolean()),
                meeting: t.Optional(t.Boolean()),
                news: t.Optional(t.Boolean()),
                risk: t.Optional(t.Boolean()),
                prospect: t.Optional(t.Boolean()),
              }),
            ),
          }),
        ),
        email: t.Optional(
          t.Object({
            enabled: t.Optional(t.Boolean()),
            dailyDigest: t.Optional(t.Boolean()),
            digestTime: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )

  // Collection settings
  .get("/collection", async () => {
    return settingsRepository.getCollectionSettings()
  })

  .put(
    "/collection",
    async ({ body }) => {
      return settingsRepository.updateCollectionSettings(body)
    },
    {
      body: t.Object({
        autoCollect: t.Optional(t.Boolean()),
        interval: t.Optional(t.Number()),
        lastRun: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    },
  )

  // Mixpanel settings
  .get("/mixpanel", async () => {
    return settingsRepository.getMixpanelSettings()
  })

  .put(
    "/mixpanel",
    async ({ body }) => {
      return settingsRepository.updateMixpanelSettings(body)
    },
    {
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        projectToken: t.Optional(t.String()),
        apiSecret: t.Optional(t.String()),
        autoCreateLeads: t.Optional(t.Boolean()),
        eventMappings: t.Optional(t.Record(t.String(), t.String())),
      }),
    },
  )

  // Initialize default settings
  .post("/initialize", async () => {
    await settingsRepository.initializeDefaults()
    return { success: true }
  })
