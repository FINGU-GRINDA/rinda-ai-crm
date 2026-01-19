import { Elysia, t } from "elysia"
import { config } from "../config"
import { mixpanelRepository, settingsRepository } from "../repositories"
import { mixpanelService } from "../services/mixpanel.service"
import type { MixpanelSettings } from "../types"
import { ErrorCode, error, success, successList } from "../utils/response"

export const mixpanelRoutes = new Elysia({ prefix: "/api/mixpanel" })
  // Get Mixpanel connection status (checks if env vars are configured)
  .get("/connection-status", () => {
    const hasProjectId = !!config.MIXPANEL_PROJECT_ID
    const hasProjectSecret = !!config.MIXPANEL_PROJECT_SECRET

    if (!hasProjectId && !hasProjectSecret) {
      return success({
        configured: false,
        authType: null,
        projectId: null,
        message: "Mixpanel credentials not configured",
      })
    }

    if (!hasProjectId) {
      return success({
        configured: false,
        authType: "service_account",
        projectId: null,
        message: "MIXPANEL_PROJECT_ID is not set",
      })
    }

    if (!hasProjectSecret) {
      return success({
        configured: false,
        authType: null,
        projectId: config.MIXPANEL_PROJECT_ID,
        message: "MIXPANEL_PROJECT_SECRET is not set",
      })
    }

    return success({
      configured: true,
      authType: "service_account",
      projectId: config.MIXPANEL_PROJECT_ID,
      message: "Mixpanel is configured",
    })
  })

  // Get Mixpanel settings
  .get("/settings", async () => {
    const settings = (await settingsRepository.getMixpanelSettings()) as MixpanelSettings
    return success(settings)
  })

  // Update Mixpanel settings
  .put(
    "/settings",
    async ({ body, set }) => {
      // Validate trackedEvents if provided
      if (body.trackedEvents && !Array.isArray(body.trackedEvents)) {
        set.status = 400
        return error("trackedEvents must be an array", ErrorCode.INVALID_REQUEST)
      }

      const updatedSettings = await settingsRepository.updateMixpanelSettings(body)
      return success(updatedSettings)
    },
    {
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        projectToken: t.Optional(t.String()),
        apiSecret: t.Optional(t.String()),
        autoCreateLeads: t.Optional(t.Boolean()),
        eventMappings: t.Optional(t.Record(t.String(), t.String())),
        trackedEvents: t.Optional(t.Array(t.String())),
        autoCreateProspect: t.Optional(t.Boolean()),
        defaultSignalStrength: t.Optional(t.String()),
        enrichWithAI: t.Optional(t.Boolean()),
        syncFrequency: t.Optional(t.String()),
        isEnabled: t.Optional(t.Boolean()),
      }),
    },
  )

  // Get Mixpanel status
  .get("/status", async () => {
    const status = await mixpanelService.getStatus()
    return success(status)
  })

  // Get sync status
  .get("/sync-status", async () => {
    const settings = (await settingsRepository.getMixpanelSettings()) as MixpanelSettings
    return success({
      lastSyncAt: settings.lastSyncAt || null,
      syncInterval: settings.syncFrequency || "hourly",
      isEnabled: settings.enabled || false,
    })
  })

  // Test Mixpanel connection
  .post("/test", async ({ set }) => {
    if (!mixpanelService.isAvailable()) {
      set.status = 400
      return error(
        "Mixpanel credentials not configured. Set MIXPANEL_PROJECT_ID and MIXPANEL_PROJECT_SECRET in environment variables.",
        ErrorCode.SERVICE_UNAVAILABLE,
      )
    }

    try {
      // Try to fetch a small number of events to test the connection
      const events = await mixpanelService.fetchEvents({ limit: 1 })
      return success({
        success: true,
        message: "Connection successful",
        authType: "service_account",
        eventsFetched: events.length,
      })
    } catch (err) {
      set.status = 400
      return error(
        err instanceof Error ? err.message : "Connection test failed",
        ErrorCode.INTERNAL_ERROR,
      )
    }
  })

  // Test event processing with sample data
  .post(
    "/test-event",
    async ({ body }) => {
      const sampleEvent = {
        event: body.event || "$signup",
        properties: {
          distinct_id: `test_user_${Date.now()}`,
          $email: body.email || "test@example.com",
          $name: body.name || "Test User",
          company: body.company || "Test Company",
          ...body.properties,
        },
      }

      // Save the test event
      const saved = await mixpanelRepository.save({
        eventName: sampleEvent.event,
        distinctId: sampleEvent.properties.distinct_id,
        properties: JSON.stringify(sampleEvent.properties),
        receivedAt: new Date(),
      })

      return success({
        success: true,
        testEvent: sampleEvent,
        result: saved,
      })
    },
    {
      body: t.Object({
        event: t.Optional(t.String()),
        email: t.Optional(t.String()),
        name: t.Optional(t.String()),
        company: t.Optional(t.String()),
        properties: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )

  // Sync events from Mixpanel
  .post("/sync", async ({ set }) => {
    if (!mixpanelService.isAvailable()) {
      set.status = 503
      return error("Mixpanel not configured", ErrorCode.SERVICE_UNAVAILABLE)
    }

    try {
      const result = await mixpanelService.syncEvents()
      return success(result)
    } catch (err) {
      set.status = 500
      return error(err instanceof Error ? err.message : "Unknown error", ErrorCode.INTERNAL_ERROR)
    }
  })

  // Process unprocessed events
  .post("/process", async () => {
    const result = await mixpanelService.processUnprocessedEvents()
    return success(result)
  })

  // Get events
  .get(
    "/events",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      if (query.eventName) {
        const events = await mixpanelRepository.findByEventName(query.eventName)
        return successList(events)
      }
      if (query.distinctId) {
        const events = await mixpanelRepository.findByDistinctId(query.distinctId)
        return successList(events)
      }
      // Return recent events
      const events = await mixpanelRepository.findUnprocessed(limit)
      return successList(events)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        eventName: t.Optional(t.String()),
        distinctId: t.Optional(t.String()),
      }),
    },
  )

  // Get event by ID
  .get(
    "/events/:id",
    async ({ params, set }) => {
      const event = await mixpanelRepository.findById(params.id)
      if (!event) {
        set.status = 404
        return error("Event not found", ErrorCode.EVENT_NOT_FOUND)
      }
      return success(event)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Get events by customer
  .get(
    "/events/customer/:customerId",
    async ({ params }) => {
      const events = await mixpanelRepository.findByCustomerId(params.customerId)
      return successList(events)
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )

  // Link event to customer
  .post(
    "/events/:id/link",
    async ({ params, body, set }) => {
      const event = await mixpanelRepository.linkToCustomer(params.id, body.customerId)
      if (!event) {
        set.status = 404
        return error("Event not found", ErrorCode.EVENT_NOT_FOUND)
      }
      return success(event)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        customerId: t.String(),
      }),
    },
  )

  // Get event stats
  .get("/stats", async () => {
    const stats = await mixpanelRepository.getEventStats()
    return success(stats)
  })

  // Webhook endpoint for receiving Mixpanel events
  .post("/webhook", async ({ body }) => {
    // Handle incoming Mixpanel webhook events
    const events = Array.isArray(body) ? body : [body]

    let saved = 0
    for (const event of events) {
      try {
        await mixpanelRepository.save({
          eventName: event.event || event.eventName,
          distinctId: event.properties?.distinct_id || event.distinctId,
          properties: JSON.stringify(event.properties || {}),
          receivedAt: new Date(),
        })
        saved++
      } catch (_error) {
        // Ignore duplicate errors
      }
    }

    return success({ received: events.length, saved })
  })
