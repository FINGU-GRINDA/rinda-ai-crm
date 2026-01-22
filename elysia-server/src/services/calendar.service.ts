import type { Credentials, OAuth2Client } from "google-auth-library"
import { type calendar_v3, google } from "googleapis"
import { config } from "../config"
import { oauthRepository, settingsRepository } from "../repositories"
import type { CalendarSettings } from "../types"
import { logger } from "../utils/logger"

type CalendarEvent = calendar_v3.Schema$Event
type CalendarAttendee = calendar_v3.Schema$EventAttendee

// System user ID for OAuth tokens (used before per-user OAuth is fully implemented)
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

class CalendarService {
  private oauth2Client: OAuth2Client | null = null
  private initialized = false

  private initialize() {
    if (this.initialized) return

    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
      this.oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_REDIRECT_URI,
      )
      logger.info("Calendar service initialized")
    } else {
      logger.warn("Google OAuth credentials not configured")
    }

    this.initialized = true
  }

  getAuthUrl(): string {
    this.initialize()

    if (!this.oauth2Client) {
      throw new Error("Calendar service not configured")
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    })
  }

  async handleCallback(code: string): Promise<void> {
    this.initialize()

    if (!this.oauth2Client) {
      throw new Error("Calendar service not configured")
    }

    const { tokens } = await this.oauth2Client.getToken(code)

    await oauthRepository.save({
      userId: SYSTEM_USER_ID,
      provider: "google_calendar",
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ?? undefined,
      scope: tokens.scope,
    })

    await settingsRepository.updateCalendarSettings({
      provider: "google",
      isConnected: true,
    })

    logger.info("Calendar OAuth completed successfully")
  }

  async getClient(): Promise<OAuth2Client> {
    this.initialize()

    if (!this.oauth2Client) {
      throw new Error("Calendar service not configured")
    }

    const token = await oauthRepository.findByProvider(SYSTEM_USER_ID, "google_calendar")
    if (!token) {
      throw new Error("Calendar not authenticated")
    }

    this.oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiresAt ? new Date(token.expiresAt).getTime() : undefined,
    })

    // Handle token refresh
    this.oauth2Client.on("tokens", async (tokens: Credentials) => {
      if (tokens.access_token) {
        await oauthRepository.updateAccessToken(
          SYSTEM_USER_ID,
          "google_calendar",
          tokens.access_token,
          tokens.expiry_date ?? undefined,
        )
      }
    })

    return this.oauth2Client
  }

  async getUpcomingEvents(
    options: { maxResults?: number; timeMin?: Date; timeMax?: Date } = {},
  ): Promise<
    Array<{
      id: string
      summary: string
      description?: string
      start: Date
      end: Date
      attendees: Array<{ email: string; name?: string }>
      location?: string
      htmlLink: string
    }>
  > {
    const client = await this.getClient()
    const calendar = google.calendar({ version: "v3", auth: client })

    const { maxResults = 10, timeMin = new Date(), timeMax } = options

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax?.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    })

    return (response.data.items || []).map((event: CalendarEvent) => ({
      id: event.id || "",
      summary: event.summary || "Untitled",
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ""),
      end: new Date(event.end?.dateTime || event.end?.date || ""),
      attendees: (event.attendees || []).map((a: CalendarAttendee) => ({
        email: a.email || "",
        name: a.displayName || undefined,
      })),
      location: event.location || undefined,
      htmlLink: event.htmlLink || "",
    }))
  }

  async getEventById(eventId: string): Promise<{
    id: string
    summary: string
    description?: string
    start: Date
    end: Date
    attendees: Array<{ email: string; name?: string }>
    location?: string
    htmlLink: string
  } | null> {
    const client = await this.getClient()
    const calendar = google.calendar({ version: "v3", auth: client })

    try {
      const response = await calendar.events.get({
        calendarId: "primary",
        eventId,
      })

      const event = response.data
      return {
        id: event.id || "",
        summary: event.summary || "Untitled",
        description: event.description || undefined,
        start: new Date(event.start?.dateTime || event.start?.date || ""),
        end: new Date(event.end?.dateTime || event.end?.date || ""),
        attendees: (event.attendees || []).map((a: CalendarAttendee) => ({
          email: a.email || "",
          name: a.displayName || undefined,
        })),
        location: event.location || undefined,
        htmlLink: event.htmlLink || "",
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg }, `Event ${eventId} not found`)
      return null
    }
  }

  async createEvent(event: {
    summary: string
    description?: string
    start: Date
    end: Date
    attendees?: string[]
    location?: string
  }): Promise<string> {
    const client = await this.getClient()
    const calendar = google.calendar({ version: "v3", auth: client })

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.start.toISOString(),
        },
        end: {
          dateTime: event.end.toISOString(),
        },
        attendees: event.attendees?.map((email) => ({ email })),
        location: event.location,
      },
    })

    logger.info(`Calendar event created: ${response.data.id}`)
    return response.data.id || ""
  }

  async disconnect(): Promise<void> {
    await oauthRepository.delete(SYSTEM_USER_ID, "google_calendar")
    await settingsRepository.updateCalendarSettings({
      provider: null,
      isConnected: false,
    })
    logger.info("Calendar disconnected")
  }

  async getStatus(): Promise<{
    isConnected: boolean
    provider: string | null
  }> {
    const settings = (await settingsRepository.getCalendarSettings()) as CalendarSettings
    return {
      isConnected: settings.isConnected || false,
      provider: settings.provider || null,
    }
  }
}

export const calendarService = new CalendarService()
