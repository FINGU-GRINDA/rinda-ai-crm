import { Elysia, t } from "elysia"
import { slackApiService } from "../services/slack-api.service"

export const slackApiRoutes = new Elysia({ prefix: "/api/slack" })
  // Check Slack API status
  .get("/status", () => {
    return {
      available: slackApiService.isAvailable(),
    }
  })

  // List channels
  .get("/channels", async ({ set }) => {
    if (!slackApiService.isAvailable()) {
      set.status = 503
      return { error: "Slack API not available" }
    }

    return slackApiService.listChannels()
  })

  // Get channel info
  .get(
    "/channels/:channelId",
    async ({ params, set }) => {
      if (!slackApiService.isAvailable()) {
        set.status = 503
        return { error: "Slack API not available" }
      }

      const channel = await slackApiService.getChannelInfo(params.channelId)
      if (!channel) {
        set.status = 404
        return { error: "Channel not found" }
      }

      return channel
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
        return { error: "Slack API not available" }
      }

      const limit = query.limit ? parseInt(query.limit, 10) : 10
      const includeReplies = query.includeReplies === "true"

      return slackApiService.getChannelMessages(params.channelId, {
        limit,
        includeReplies,
      })
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
        return { error: "Slack API not available" }
      }

      const user = await slackApiService.getUserInfo(params.userId)
      if (!user) {
        set.status = 404
        return { error: "User not found" }
      }

      return user
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
        return { error: "Slack API not available" }
      }

      return slackApiService.postMessage(params.channelId, body.text, {
        threadTs: body.threadTs,
      })
    },
    {
      params: t.Object({ channelId: t.String() }),
      body: t.Object({
        text: t.String(),
        threadTs: t.Optional(t.String()),
      }),
    },
  )
