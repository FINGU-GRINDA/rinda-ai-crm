import { Elysia, t } from "elysia"
import { verifySlackRequest } from "../middleware/slack-verify"
import { settingsRepository, slackRepository } from "../repositories"
import { slackEventService } from "../services/slack-event.service"
import { slackWebhookService } from "../services/slack-webhook.service"
import type { SlackSettings } from "../types"
import { logger } from "../utils/logger"
import { ErrorCode, error, success, successList } from "../utils/response"

export const slackEventRoutes = new Elysia({ prefix: "/api/slack/events" })
  // Slack Event API endpoint
  .post("/", async ({ headers, set, request }) => {
    const rawBody = await request.text()
    const timestamp = headers["x-slack-request-timestamp"]
    const signature = headers["x-slack-signature"]

    // Always verify signature (function handles dev mode gracefully)
    if (!timestamp || !signature || !verifySlackRequest(timestamp, rawBody, signature)) {
      logger.warn({ hasTimestamp: !!timestamp, hasSignature: !!signature }, "Invalid or missing Slack signature")
      set.status = 401
      return error("Invalid signature", ErrorCode.INVALID_SIGNATURE)
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

  // Get failed messages (exceeded max retries)
  .get(
    "/messages/failed",
    async ({ query }) => {
      const maxRetries = query.maxRetries ? parseInt(query.maxRetries, 10) : 3
      const messages = await slackRepository.findPermanentlyFailed(maxRetries)
      return successList(messages)
    },
    {
      query: t.Object({
        maxRetries: t.Optional(t.String()),
      }),
    },
  )

  // Get retryable messages (haven't exceeded max retries)
  .get(
    "/messages/retryable",
    async ({ query }) => {
      const maxRetries = query.maxRetries ? parseInt(query.maxRetries, 10) : 3
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const messages = await slackRepository.findRetryable(maxRetries, limit)
      return successList(messages)
    },
    {
      query: t.Object({
        maxRetries: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

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
  .post(
    "/reprocess",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 100
      const unprocessed = await slackRepository.findUnprocessed(limit)
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
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Retry failed messages (that haven't exceeded max retries)
  .post(
    "/retry-failed",
    async ({ query }) => {
      const maxRetries = query.maxRetries ? parseInt(query.maxRetries, 10) : 3
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const retryable = await slackRepository.findRetryable(maxRetries, limit)

      let succeeded = 0
      let failed = 0

      for (const message of retryable) {
        try {
          const result = await slackEventService.processMonitoredChannelMessage(message, {
            type: "message",
            channel: message.channelId || "",
            ts: message.slackTs || "",
            text: message.text || "",
          })

          if (result.handled !== false) {
            succeeded++
          } else {
            failed++
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          logger.warn({ messageId: message.id, error: errorMsg }, "Retry failed")
          failed++
        }
      }

      return success({
        total: retryable.length,
        succeeded,
        failed,
      })
    },
    {
      query: t.Object({
        maxRetries: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Clear error for a specific message (manual reset)
  .post(
    "/messages/:id/clear-error",
    async ({ params, set }) => {
      const message = await slackRepository.clearError(params.id)
      if (!message) {
        set.status = 404
        return error("Message not found", ErrorCode.NOT_FOUND)
      }
      return success(message)
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
