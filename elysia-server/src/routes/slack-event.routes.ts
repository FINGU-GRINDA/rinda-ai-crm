import crypto from "node:crypto"
import { Elysia, t } from "elysia"
import { config } from "../config"
import { settingsRepository, slackRepository } from "../repositories"
import { slackEventService } from "../services/slack-event.service"
import { slackWebhookService } from "../services/slack-webhook.service"
import type { SlackSettings } from "../types"
import { logger } from "../utils/logger"

// Slack signature verification
function verifySlackSignature(timestamp: string, body: string, signature: string): boolean {
  if (!config.SLACK_SIGNING_SECRET) return false

  const sigBasestring = `v0:${timestamp}:${body}`
  const mySignature =
    "v0=" +
    crypto.createHmac("sha256", config.SLACK_SIGNING_SECRET).update(sigBasestring).digest("hex")

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))
}

export const slackEventRoutes = new Elysia({ prefix: "/api/slack/events" })
  // Slack Event API endpoint
  .post("/", async ({ headers, set, request }) => {
    const rawBody = await request.text()
    const timestamp = headers["x-slack-request-timestamp"]
    const signature = headers["x-slack-signature"]

    // Verify signature in production
    if (config.SLACK_SIGNING_SECRET && timestamp && signature) {
      if (!verifySlackSignature(timestamp, rawBody, signature)) {
        logger.warn("Invalid Slack signature")
        set.status = 401
        return { error: "Invalid signature" }
      }
    }

    const payload = JSON.parse(rawBody)

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return slackEventService.handleUrlVerification(payload)
    }

    // Handle event callbacks
    if (payload.type === "event_callback") {
      const event = payload.event
      logger.info(`Received Slack event: ${event.type}`)

      // Process event asynchronously
      setImmediate(async () => {
        try {
          await slackEventService.processEvent(event)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.error({ error: errorMsg }, "Error processing Slack event")
        }
      })

      return { ok: true }
    }

    return { ok: true }
  })

  // Get Slack integration status
  .get("/status", async () => {
    return slackEventService.getStatus()
  })

  // Get recent messages
  .get(
    "/messages",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const channelId = query.channelId

      return slackRepository.findRecent({ channelId, limit })
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        channelId: t.Optional(t.String()),
      }),
    },
  )

  // Get unprocessed messages
  .get(
    "/messages/unprocessed",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      return slackRepository.findUnprocessed(limit)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get deleted messages
  .get("/messages/deleted", async () => {
    return slackRepository.findDeleted()
  })

  // Process a message manually
  .post(
    "/messages/:id/process",
    async ({ params, set }) => {
      const message = await slackRepository.findById(params.id)
      if (!message) {
        set.status = 404
        return { error: "Message not found" }
      }

      const result = await slackEventService.processMonitoredChannelMessage(message, {
        type: "message",
        channel: message.channelId || "",
        ts: message.slackTs || "",
        text: message.text || "",
      })

      return result
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Webhook routes
  .post(
    "/webhook/validate",
    async ({ body }) => {
      const isValid = await slackWebhookService.validateWebhook(body.webhookUrl)

      if (isValid) {
        await settingsRepository.updateSlackSettings({
          webhookUrl: body.webhookUrl,
          isValidated: true,
        })
      }

      return { valid: isValid }
    },
    {
      body: t.Object({
        webhookUrl: t.String(),
      }),
    },
  )

  .post("/webhook/test", async ({ set }) => {
    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings

    if (!settings.webhookUrl || !settings.isValidated) {
      set.status = 400
      return { error: "Webhook not configured" }
    }

    const sent = await slackWebhookService.sendNotification({
      text: "🧪 RINDA CRM 테스트 알림입니다!",
    })

    return { sent }
  })
