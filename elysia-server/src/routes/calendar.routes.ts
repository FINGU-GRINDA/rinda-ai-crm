import { Elysia, t } from "elysia"
import { calendarService } from "../services/calendar.service"
import { ErrorCode, error, success, successList } from "../utils/response"

// Get frontend URL from environment or default
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  // Get calendar status
  .get("/status", async () => {
    const status = await calendarService.getStatus()
    return success(status)
  })

  // Get OAuth URL
  .get("/oauth/url", ({ set }) => {
    try {
      const url = calendarService.getAuthUrl()
      return success({ url })
    } catch (_error) {
      set.status = 503
      return error("Calendar service not configured", ErrorCode.SERVICE_UNAVAILABLE)
    }
  })

  // OAuth callback - redirects to frontend
  .get(
    "/oauth/callback",
    async ({ query, set }) => {
      if (!query.code) {
        set.redirect = `${FRONTEND_URL}/settings?error=calendar_missing_code`
        return
      }

      try {
        await calendarService.handleCallback(query.code)
        set.redirect = `${FRONTEND_URL}/settings?calendar=connected`
        return
      } catch (_error) {
        set.redirect = `${FRONTEND_URL}/settings?error=calendar_auth_failed`
        return
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

        const events = await calendarService.getUpcomingEvents({ maxResults, timeMin, timeMax })
        return successList(events)
      } catch (err) {
        set.status = 500
        return error(err instanceof Error ? err.message : "Unknown error", ErrorCode.INTERNAL_ERROR)
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
          return error("Event not found", ErrorCode.NOT_FOUND)
        }
        return success(event)
      } catch (err) {
        set.status = 500
        return error(err instanceof Error ? err.message : "Unknown error", ErrorCode.INTERNAL_ERROR)
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
        set.status = 201
        return success({ eventId })
      } catch (err) {
        set.status = 500
        return error(err instanceof Error ? err.message : "Unknown error", ErrorCode.INTERNAL_ERROR)
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
    return success({ disconnected: true })
  })
