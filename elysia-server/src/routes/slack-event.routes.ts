import crypto from "node:crypto"
import { Elysia, t } from "elysia"
import { config } from "../config"
import { settingsRepository, slackRepository } from "../repositories"
import { slackEventService } from "../services/slack-event.service"
import { slackWebhookService } from "../services/slack-webhook.service"
import type { SlackSettings } from "../types"
import { logger } from "../utils/logger"
import { ErrorCode, error, success, successList } from "../utils/response"

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
        return error("Invalid signature", ErrorCode.INVALID_SIGNATURE)
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
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          logger.error({ error: errorMsg }, "Error processing Slack event")
        }
      })

      return { ok: true }
    }

    return { ok: true }
  })

  // Get Slack integration status
  .get("/status", async () => {
    const status = await slackEventService.getStatus()
    return success(status)
  })

  // Get recent messages
  .get(
    "/messages",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const channelId = query.channelId

      const messages = await slackRepository.findRecent({ channelId, limit })
      return successList(messages)
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
      const messages = await slackRepository.findUnprocessed(limit)
      return successList(messages)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get deleted messages
  .get("/messages/deleted", async () => {
    const messages = await slackRepository.findDeleted()
    return successList(messages)
  })

  // Get messages for a specific customer
  .get(
    "/messages/customer/:customerId",
    async ({ params }) => {
      const messages = await slackRepository.findByCustomerId(params.customerId)
      return successList(messages)
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )

  // Process a message manually
  .post(
    "/messages/:id/process",
    async ({ params, set }) => {
      const message = await slackRepository.findById(params.id)
      if (!message) {
        set.status = 404
        return error("Message not found", ErrorCode.NOT_FOUND)
      }

      const result = await slackEventService.processMonitoredChannelMessage(message, {
        type: "message",
        channel: message.channelId || "",
        ts: message.slackTs || "",
        text: message.text || "",
      })

      return success(result)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Toggle Slack Event API on/off
  .post("/toggle", async () => {
    const settings = await settingsRepository.getSlackSettings()
    const newState = !settings.eventApiEnabled
    await settingsRepository.updateSlackSettings({ eventApiEnabled: newState })
    return success({
      eventApiEnabled: newState,
      message: newState ? "Slack Event API enabled" : "Slack Event API disabled",
    })
  })

  // Bulk reprocess all unprocessed messages
  .post("/reprocess", async () => {
    const unprocessed = await slackRepository.findUnprocessed()
    let processed = 0
    let failed = 0

    for (const message of unprocessed) {
      try {
        await slackEventService.processMonitoredChannelMessage(message, {
          type: "message",
          channel: message.channelId || "",
          ts: message.slackTs || "",
          text: message.text || "",
        })
        processed++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.warn({ messageId: message.id, error: errorMsg }, "Failed to reprocess message")
        failed++
      }
    }

    return success({
      total: unprocessed.length,
      processed,
      failed,
    })
  })

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

      return success({ valid: isValid })
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
      return error("Webhook not configured", ErrorCode.INVALID_REQUEST)
    }

    const sent = await slackWebhookService.sendNotification({
      text: "🧪 RINDA CRM 테스트 알림입니다!",
    })

    return success({ sent })
  })
