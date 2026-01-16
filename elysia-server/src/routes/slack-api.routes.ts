import { Elysia, t } from "elysia"
import { slackApiService } from "../services/slack-api.service"
import { ErrorCode, error, success, successList } from "../utils/response"

export const slackApiRoutes = new Elysia({ prefix: "/api/slack" })
  // Check Slack API status
  .get("/status", () => {
    return success({
      available: slackApiService.isAvailable(),
    })
  })

  // List channels
  .get("/channels", async ({ set }) => {
    if (!slackApiService.isAvailable()) {
      set.status = 503
      return error("Slack API not available", ErrorCode.SERVICE_UNAVAILABLE)
    }

    const channels = await slackApiService.listChannels()
    return successList(channels)
  })

  // Get channel info
  .get(
    "/channels/:channelId",
    async ({ params, set }) => {
      if (!slackApiService.isAvailable()) {
        set.status = 503
        return error("Slack API not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const channel = await slackApiService.getChannelInfo(params.channelId)
      if (!channel) {
        set.status = 404
        return error("Channel not found", ErrorCode.NOT_FOUND)
      }

      return success(channel)
    },
    {
      params: t.Object({ channelId: t.String() }),
    },
  )

  // Get channel messages
  .get(
    "/channels/:channelId/messages",
    async ({ params, query, set }) => {
      if (!slackApiService.isAvailable()) {
        set.status = 503
        return error("Slack API not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const limit = query.limit ? parseInt(query.limit, 10) : 10
      const includeReplies = query.includeReplies === "true"

      const result = await slackApiService.getChannelMessages(params.channelId, {
        limit,
        includeReplies,
      })
      return success(result)
    },
    {
      params: t.Object({ channelId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        includeReplies: t.Optional(t.String()),
      }),
    },
  )

  // Get user info
  .get(
    "/users/:userId",
    async ({ params, set }) => {
      if (!slackApiService.isAvailable()) {
        set.status = 503
        return error("Slack API not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const user = await slackApiService.getUserInfo(params.userId)
      if (!user) {
        set.status = 404
        return error("User not found", ErrorCode.NOT_FOUND)
      }

      return success(user)
    },
    {
      params: t.Object({ userId: t.String() }),
    },
  )

  // Post message
  .post(
    "/channels/:channelId/messages",
    async ({ params, body, set }) => {
      if (!slackApiService.isAvailable()) {
        set.status = 503
        return error("Slack API not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const result = await slackApiService.postMessage(params.channelId, body.text, {
        threadTs: body.threadTs,
      })
      return success(result)
    },
    {
      params: t.Object({ channelId: t.String() }),
      body: t.Object({
        text: t.String(),
        threadTs: t.Optional(t.String()),
      }),
    },
  )
