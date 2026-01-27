import { WebClient } from "@slack/web-api"
import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"
import type { Channel } from "@slack/web-api/dist/types/response/ConversationsInfoResponse"
import type { Channel as ListChannel } from "@slack/web-api/dist/types/response/ConversationsListResponse"
import type { User as SlackUser } from "@slack/web-api/dist/types/response/UsersInfoResponse"
import { config } from "../config"
import type { SlackChannelMessage, SlackReply } from "../types"
import { logger } from "../utils/logger"

class SlackApiService {
  private client: WebClient | null = null
  private initialized = false

  private initialize() {
    if (this.initialized) return

    if (config.SLACK_BOT_TOKEN) {
      this.client = new WebClient(config.SLACK_BOT_TOKEN)
      logger.info("Slack API service initialized")
    } else {
      logger.warn("SLACK_BOT_TOKEN not configured")
    }

    this.initialized = true
  }

  isAvailable(): boolean {
    this.initialize()
    return !!this.client
  }

  async getChannelMessages(
    channelId: string,
    options: {
      limit?: number
      includeReplies?: boolean
      oldest?: string // Unix timestamp (seconds) - fetch messages after this
      latest?: string // Unix timestamp (seconds) - fetch messages before this
      cursor?: string // Pagination cursor for next page
    } = {},
  ): Promise<{
    messages: Array<{
      ts: string
      user: string
      text: string
      threadTs?: string
      replyCount?: number
      files?: Array<{
        id: string
        name: string
        mimetype: string
        url: string
        url_private_download?: string
        size?: number
      }>
      replies?: Array<{
        ts: string
        user: string
        text: string
      }>
    }>
    hasMore: boolean
    nextCursor?: string
  }> {
    this.initialize()

    if (!this.client) {
      throw new Error("Slack API client not available")
    }

    const { limit = 10, includeReplies = false, oldest, latest, cursor } = options

    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        limit,
        oldest,
        latest,
        cursor,
      })

      const messages: SlackChannelMessage[] = await Promise.all(
        (result.messages || []).map(async (msg: MessageElement) => {
          const message: SlackChannelMessage = {
            ts: msg.ts || "",
            user: msg.user || "",
            text: msg.text || "",
            threadTs: msg.thread_ts,
            replyCount: msg.reply_count,
          }

          // Include files if present
          if (msg.files && msg.files.length > 0) {
            message.files = msg.files.map((f) => ({
              id: f.id || "",
              name: f.name || "",
              mimetype: f.mimetype || "",
              url: f.url_private || f.permalink || "",
              url_private_download: f.url_private_download,
              size: f.size,
            }))
          }

          // Fetch replies if requested and message has replies
          if (includeReplies && msg.reply_count && msg.reply_count > 0 && msg.ts) {
            try {
              const repliesResult = await this.client?.conversations.replies({
                channel: channelId,
                ts: msg.ts,
              })

              message.replies = (repliesResult?.messages || [])
                .filter((r: MessageElement) => r.ts !== msg.ts) // Exclude parent message
                .map(
                  (r: MessageElement): SlackReply => ({
                    ts: r.ts || "",
                    user: r.user || "",
                    text: r.text || "",
                  }),
                )
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              logger.error({ error: errorMsg }, `Error fetching replies for ${msg.ts}`)
            }
          }

          return message
        }),
      )

      return {
        messages,
        hasMore: result.has_more || false,
        nextCursor: result.response_metadata?.next_cursor,
      }
    } catch (error) {
      const errorMsg1 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg1 }, "Error fetching channel messages")
      throw error
    }
  }

  async getChannelInfo(channelId: string): Promise<{
    id: string
    name: string
    isPrivate: boolean
    memberCount: number
    topic: string
    purpose: string
  } | null> {
    this.initialize()

    if (!this.client) {
      throw new Error("Slack API client not available")
    }

    try {
      const result = await this.client.conversations.info({
        channel: channelId,
      })

      if (!result.channel) return null

      const channel = result.channel as Channel
      return {
        id: channel.id || "",
        name: channel.name || "",
        isPrivate: channel.is_private || false,
        memberCount: channel.num_members || 0,
        topic: channel.topic?.value || "",
        purpose: channel.purpose?.value || "",
      }
    } catch (error) {
      const errorMsg2 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg2 }, "Error fetching channel info")
      throw error
    }
  }

  async listChannels(): Promise<
    Array<{
      id: string
      name: string
      isPrivate: boolean
    }>
  > {
    this.initialize()

    if (!this.client) {
      throw new Error("Slack API client not available")
    }

    try {
      const result = await this.client.conversations.list({
        types: "public_channel,private_channel",
        limit: 100,
      })

      return (result.channels || []).map((c: ListChannel) => ({
        id: c.id || "",
        name: c.name || "",
        isPrivate: c.is_private || false,
      }))
    } catch (error) {
      const errorMsg3 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg3 }, "Error listing channels")
      throw error
    }
  }

  async getUserInfo(userId: string): Promise<{
    id: string
    name: string
    realName: string
    email?: string
    avatar?: string
  } | null> {
    this.initialize()

    if (!this.client) {
      throw new Error("Slack API client not available")
    }

    try {
      const result = await this.client.users.info({
        user: userId,
      })

      if (!result.user) return null

      const user = result.user as SlackUser
      return {
        id: user.id || "",
        name: user.name || "",
        realName: user.real_name || "",
        email: user.profile?.email,
        avatar: user.profile?.image_72,
      }
    } catch (error) {
      const errorMsg4 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg4 }, "Error fetching user info")
      throw error
    }
  }

  async postMessage(
    channelId: string,
    text: string,
    options: {
      threadTs?: string
    } = {},
  ): Promise<{ ts: string; channelId: string }> {
    this.initialize()

    if (!this.client) {
      throw new Error("Slack API client not available")
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text,
        thread_ts: options.threadTs,
      })

      if (!result.ts || !result.channel) {
        throw new Error("Slack API returned incomplete response")
      }

      return {
        ts: result.ts,
        channelId: result.channel,
      }
    } catch (error) {
      const errorMsg5 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg5 }, "Error posting message")
      throw error
    }
  }
}

export const slackApiService = new SlackApiService()
