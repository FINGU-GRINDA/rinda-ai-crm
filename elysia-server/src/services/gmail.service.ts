import type { Credentials, OAuth2Client } from "google-auth-library"
import { type gmail_v1, google } from "googleapis"
import { config } from "../config"
import { emailRepository, oauthRepository, settingsRepository } from "../repositories"
import type { EmailSettings } from "../types"
import { logger } from "../utils/logger"

type MessagePartHeader = gmail_v1.Schema$MessagePartHeader
type MessagePart = gmail_v1.Schema$MessagePart

class GmailService {
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
      logger.info("Gmail service initialized")
    } else {
      logger.warn("Google OAuth credentials not configured")
    }

    this.initialized = true
  }

  getAuthUrl(): string {
    this.initialize()

    if (!this.oauth2Client) {
      throw new Error("Gmail service not configured")
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ],
    })
  }

  async handleCallback(code: string): Promise<void> {
    this.initialize()

    if (!this.oauth2Client) {
      throw new Error("Gmail service not configured")
    }

    const { tokens } = await this.oauth2Client.getToken(code)

    await oauthRepository.save({
      provider: "google",
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ?? undefined,
      scope: tokens.scope,
    })

    await settingsRepository.updateEmailSettings({
      provider: "gmail",
      isConnected: true,
    })

    logger.info("Gmail OAuth completed successfully")
  }

  async getClient(): Promise<OAuth2Client> {
    this.initialize()

    if (!this.oauth2Client) {
      throw new Error("Gmail service not configured")
    }

    const token = await oauthRepository.findByProvider("google")
    if (!token) {
      throw new Error("Gmail not authenticated")
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
          "google",
          tokens.access_token,
          tokens.expiry_date ?? undefined,
        )
      }
    })

    return this.oauth2Client
  }

  async syncEmails(maxResults: number = 50): Promise<{ synced: number; errors: number }> {
    const client = await this.getClient()
    const gmail = google.gmail({ version: "v1", auth: client })

    let synced = 0
    let errors = 0

    try {
      const response = await gmail.users.messages.list({
        userId: "me",
        maxResults,
        q: "in:inbox",
      })

      const messages = response.data.messages || []

      for (const msg of messages) {
        if (!msg.id) continue

        try {
          const existing = await emailRepository.findByGmailMessageId(msg.id)
          if (existing) continue

          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
          })

          const headers = detail.data.payload?.headers || []
          const getHeader = (name: string) =>
            headers.find((h: MessagePartHeader) => h.name?.toLowerCase() === name.toLowerCase())
              ?.value

          const body = this.extractBody(detail.data.payload)

          await emailRepository.save({
            gmailMessageId: msg.id,
            threadId: msg.threadId,
            subject: getHeader("subject"),
            fromAddress: getHeader("from"),
            toAddress: getHeader("to"),
            body,
            date: new Date(parseInt(detail.data.internalDate || "0", 10)),
          })

          synced++
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.error({ error: errorMsg }, `Error syncing message ${msg.id}`)
          errors++
        }
      }

      await settingsRepository.updateEmailSettings({
        lastSyncAt: Date.now(),
      })

      logger.info(`Gmail sync completed: ${synced} synced, ${errors} errors`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg }, "Gmail sync failed")
      throw error
    }

    return { synced, errors }
  }

  private extractBody(payload: MessagePart | undefined): string {
    if (!payload) return ""

    // Check for plain text body
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8")
    }

    // Check parts for text content
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8")
        }
        // Recursively check nested parts
        const nested = this.extractBody(part)
        if (nested) return nested
      }
    }

    return ""
  }

  async sendEmail(to: string, subject: string, body: string): Promise<string> {
    const client = await this.getClient()
    const gmail = google.gmail({ version: "v1", auth: client })

    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\n")

    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    })

    logger.info(`Email sent: ${response.data.id}`)
    return response.data.id || ""
  }

  async disconnect(): Promise<void> {
    await oauthRepository.delete("google")
    await settingsRepository.updateEmailSettings({
      provider: null,
      isConnected: false,
      lastSyncAt: null,
    })
    logger.info("Gmail disconnected")
  }

  async getStatus(): Promise<{
    isConnected: boolean
    provider: string | null
    lastSyncAt: number | null
  }> {
    const settings = (await settingsRepository.getEmailSettings()) as EmailSettings
    return {
      isConnected: settings.isConnected || false,
      provider: settings.provider || null,
      lastSyncAt: settings.lastSyncAt || null,
    }
  }
}

export const gmailService = new GmailService()
