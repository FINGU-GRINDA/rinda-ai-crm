import { Elysia, t } from "elysia"
import { calendarService } from "../services/calendar.service"

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  // Get calendar status
  .get("/status", async () => {
    return calendarService.getStatus()
  })

  // Get OAuth URL
  .get("/oauth/url", ({ set }) => {
    try {
      const url = calendarService.getAuthUrl()
      return { url }
    } catch (_error) {
      set.status = 503
      return { error: "Calendar service not configured" }
    }
  })

  // OAuth callback
  .get(
    "/oauth/callback",
    async ({ query, set }) => {
      if (!query.code) {
        set.status = 400
        return { error: "Missing authorization code" }
      }

      try {
        await calendarService.handleCallback(query.code)
        return { success: true, message: "Calendar connected successfully" }
      } catch (_error) {
        set.status = 500
        return { error: "OAuth callback failed" }
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
      }),
    },
  )

  // Get upcoming events
  .get(
    "/events",
    async ({ query, set }) => {
      try {
        const maxResults = query.maxResults ? parseInt(query.maxResults, 10) : 10
        const timeMin = query.timeMin ? new Date(query.timeMin) : undefined
        const timeMax = query.timeMax ? new Date(query.timeMax) : undefined

        return calendarService.getUpcomingEvents({ maxResults, timeMin, timeMax })
      } catch (error) {
        set.status = 500
        return { error: error instanceof Error ? error.message : "Unknown error" }
      }
    },
    {
      query: t.Object({
        maxResults: t.Optional(t.String()),
        timeMin: t.Optional(t.String()),
        timeMax: t.Optional(t.String()),
      }),
    },
  )

  // Get event by ID
  .get(
    "/events/:eventId",
    async ({ params, set }) => {
      try {
        const event = await calendarService.getEventById(params.eventId)
        if (!event) {
          set.status = 404
          return { error: "Event not found" }
        }
        return event
      } catch (error) {
        set.status = 500
        return { error: error instanceof Error ? error.message : "Unknown error" }
      }
    },
    {
      params: t.Object({ eventId: t.String() }),
    },
  )

  // Create event
  .post(
    "/events",
    async ({ body, set }) => {
      try {
        const eventId = await calendarService.createEvent({
          summary: body.summary,
          description: body.description,
          start: new Date(body.start),
          end: new Date(body.end),
          attendees: body.attendees,
          location: body.location,
        })
        return { success: true, eventId }
      } catch (error) {
        set.status = 500
        return { error: error instanceof Error ? error.message : "Unknown error" }
      }
    },
    {
      body: t.Object({
        summary: t.String(),
        description: t.Optional(t.String()),
        start: t.String(),
        end: t.String(),
        attendees: t.Optional(t.Array(t.String())),
        location: t.Optional(t.String()),
      }),
    },
  )

  // Disconnect calendar
  .post("/disconnect", async () => {
    await calendarService.disconnect()
    return { success: true }
  })
