import { Elysia, t } from "elysia"
import { mixpanelRepository } from "../repositories"
import { mixpanelService } from "../services/mixpanel.service"

export const mixpanelRoutes = new Elysia({ prefix: "/api/mixpanel" })
  // Get Mixpanel status
  .get("/status", async () => {
    return mixpanelService.getStatus()
  })

  // Sync events from Mixpanel
  .post("/sync", async ({ set }) => {
    if (!mixpanelService.isAvailable()) {
      set.status = 503
      return { error: "Mixpanel not configured" }
    }

    try {
      return mixpanelService.syncEvents()
    } catch (error) {
      set.status = 500
      return { error: error instanceof Error ? error.message : "Unknown error" }
    }
  })

  // Process unprocessed events
  .post("/process", async () => {
    return mixpanelService.processUnprocessedEvents()
  })

  // Get events
  .get(
    "/events",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      if (query.eventName) {
        return mixpanelRepository.findByEventName(query.eventName)
      }
      if (query.distinctId) {
        return mixpanelRepository.findByDistinctId(query.distinctId)
      }
      // Return recent events
      const events = await mixpanelRepository.findUnprocessed(limit)
      return events
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
        return { error: "Event not found" }
      }
      return event
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Get events by customer
  .get(
    "/events/customer/:customerId",
    async ({ params }) => {
      return mixpanelRepository.findByCustomerId(params.customerId)
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
        return { error: "Event not found" }
      }
      return event
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
    return mixpanelRepository.getEventStats()
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
          receivedAt: Date.now(),
        })
        saved++
      } catch (_error) {
        // Ignore duplicate errors
      }
    }

    return { received: events.length, saved }
  })
