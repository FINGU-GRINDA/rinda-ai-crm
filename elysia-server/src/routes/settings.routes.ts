import { Elysia, t } from "elysia"
import { settingsRepository } from "../repositories"
import { ErrorCode, error, success } from "../utils/response"

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  // Get all settings
  .get("/", async () => {
    const settings = await settingsRepository.getAll()
    return success(settings)
  })

  // Get specific setting by dynamic key
  .get(
    "/:key",
    async ({ params, set }) => {
      const value = await settingsRepository.getByKey(params.key)
      if (value === null) {
        set.status = 404
        return error("Setting not found", ErrorCode.SETTING_NOT_FOUND)
      }
      return success({ key: params.key, value })
    },
    {
      params: t.Object({ key: t.String() }),
    },
  )

  // Update specific setting by dynamic key
  .put(
    "/:key",
    async ({ params, body }) => {
      const result = await settingsRepository.setByKey(params.key, body.value as string)
      return success(result)
    },
    {
      params: t.Object({ key: t.String() }),
      body: t.Object({ value: t.Unknown() }),
    },
  )

  // Slack settings
  .get("/slack", async () => {
    const settings = await settingsRepository.getSlackSettings()
    return success(settings)
  })

  .put(
    "/slack",
    async ({ body }) => {
      const result = await settingsRepository.updateSlackSettings(body)
      return success(result)
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
    const settings = await settingsRepository.getEmailSettings()
    return success(settings)
  })

  .put(
    "/email",
    async ({ body }) => {
      const result = await settingsRepository.updateEmailSettings(body)
      return success(result)
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
    const settings = await settingsRepository.getCalendarSettings()
    return success(settings)
  })

  .put(
    "/calendar",
    async ({ body }) => {
      const result = await settingsRepository.updateCalendarSettings(body)
      return success(result)
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
    const settings = await settingsRepository.getNotificationSettings()
    return success(settings)
  })

  .put(
    "/notifications",
    async ({ body }) => {
      const result = await settingsRepository.updateNotificationSettings(body)
      return success(result)
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
    const settings = await settingsRepository.getCollectionSettings()
    return success(settings)
  })

  .put(
    "/collection",
    async ({ body }) => {
      const result = await settingsRepository.updateCollectionSettings(body)
      return success(result)
    },
    {
      body: t.Object({
        autoCollect: t.Optional(t.Boolean()),
        interval: t.Optional(t.Number()),
        lastRun: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    },
  )

  // Initialize default settings
  .post("/initialize", async () => {
    await settingsRepository.initializeDefaults()
    return success({ initialized: true })
  })
