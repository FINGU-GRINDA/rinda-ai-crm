import { config } from "../config"
import {
  customerRepository,
  notificationRepository,
  prospectRepository,
  settingsRepository,
  slackRepository,
} from "../repositories"
import type { SlackEvent, SlackMessage, SlackSettings } from "../types"
import { logger } from "../utils/logger"
import { geminiService } from "./gemini.service"

class SlackEventService {
  private monitoredChannels: Set<string> | null = null
  private initialized = false

  private ensureInitialized() {
    if (this.initialized) return

    // Load monitored channel IDs from environment
    this.monitoredChannels = new Set(
      [config.CS_CHANNEL_ID, config.SALES_CHANNEL_ID, config.MEETING_NOTES_CHANNEL_ID].filter(
        Boolean,
      ) as string[],
    )

    if (this.monitoredChannels.size > 0) {
      logger.info(
        { channels: Array.from(this.monitoredChannels) },
        `Slack monitoring ${this.monitoredChannels.size} channels`,
      )
    } else {
      logger.warn("No Slack channels configured for monitoring")
    }

    this.initialized = true
  }

  getChannelType(channelId: string): string {
    if (channelId === config.CS_CHANNEL_ID) return "CS"
    if (channelId === config.SALES_CHANNEL_ID) return "SALES"
    if (channelId === config.MEETING_NOTES_CHANNEL_ID) return "MEETING_NOTES"
    return "UNKNOWN"
  }

  handleUrlVerification(body: { challenge: string }): { challenge: string } {
    logger.info("Slack URL verification challenge received")
    return { challenge: body.challenge }
  }

  async processEvent(event: SlackEvent) {
    const eventType = event.type

    switch (eventType) {
      case "message":
        return this.handleMessageEvent(event)
      case "app_mention":
        return this.handleAppMention(event)
      default:
        logger.info(`Unhandled event type: ${eventType}`)
        return { handled: false, type: eventType }
    }
  }

  async handleMessageEvent(event: SlackEvent) {
    this.ensureInitialized()

    // Handle message deletion
    if (event.subtype === "message_deleted") {
      return this.handleMessageDeleted(event)
    }

    // Handle message edit
    if (event.subtype === "message_changed") {
      return this.handleMessageEdited(event)
    }

    // Ignore bot messages
    if (event.bot_id || event.subtype === "bot_message") {
      return { handled: false, reason: "bot_message" }
    }

    const isMonitoredChannel = this.monitoredChannels?.has(event.channel)

    if (isMonitoredChannel) {
      const savedMessage = await slackRepository.saveMessage({
        slackTs: event.ts,
        channelId: event.channel,
        userId: event.user,
        userName: event.username || null,
        text: event.text,
        threadTs: event.thread_ts || null,
      })

      logger.info(`Saved message: ${savedMessage.id}`)
      return { handled: true, processed: true, messageId: savedMessage.id }
    }

    return { handled: true, processed: false }
  }

  async processMonitoredChannelMessage(savedMessage: SlackMessage, event: SlackEvent) {
    try {
      const channelType = this.getChannelType(event.channel)
      logger.info(`Processing message from ${channelType} channel`)

      const parsedData = await geminiService.parseCustomerInquiry(event.text)

      if (!parsedData.isInquiry) {
        await slackRepository.markProcessed(savedMessage.id)
        return { handled: true, isInquiry: false }
      }

      let customerId: string | null = null
      let prospectId: string | null = null

      if (parsedData.companyName) {
        const existingCustomer = await customerRepository.findByName(parsedData.companyName)

        if (existingCustomer) {
          customerId = existingCustomer.id

          const updatedNotes =
            `${existingCustomer.notes || ""}\n\n[Slack ${new Date().toLocaleString("ko-KR")}]\n${event.text}`.trim()
          await customerRepository.update(existingCustomer.id, { notes: updatedNotes })
        } else {
          const existingProspect = await prospectRepository.findByCompanyName(
            parsedData.companyName,
          )

          if (existingProspect) {
            prospectId = existingProspect.id
          } else {
            const newProspect = await prospectRepository.create({
              companyName: parsedData.companyName,
              industry: parsedData.industry || undefined,
              signalStrength: parsedData.urgency === "high" ? "high" : "medium",
              notes: `[Slack 문의]\n${parsedData.summary || event.text}`,
              sourceTitle: "Slack CS 채널",
              sourceUri: `slack://channel/${event.channel}/${event.ts}`,
            })
            prospectId = newProspect.id

            await notificationRepository.create({
              type: "slack",
              title: "새로운 Slack 문의",
              message: `${parsedData.companyName}: ${parsedData.summary || "문의 내용 확인 필요"}`,
              prospectId: newProspect.id,
              priority: parsedData.urgency || "medium",
              metadata: JSON.stringify({
                slackChannel: event.channel,
                slackTs: event.ts,
                inquiryType: parsedData.inquiryType,
              }),
            })
          }
        }
      }

      await slackRepository.markProcessed(savedMessage.id, {
        customerId: customerId || undefined,
        prospectId: prospectId || undefined,
      })

      return {
        handled: true,
        isInquiry: true,
        customerId,
        prospectId,
        parsedData,
      }
    } catch (error) {
      const errorMsg1 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg1 }, "Error processing monitored channel message")
      await slackRepository.markProcessed(savedMessage.id)
      return { handled: true, error: String(error) }
    }
  }

  async handleMessageDeleted(event: SlackEvent) {
    try {
      const deletedTs = event.deleted_ts
      const channelId = event.channel
      const previousMessage = event.previous_message

      if (!deletedTs) {
        logger.warn("Message deletion event missing deleted_ts")
        return { handled: false, reason: "missing_deleted_ts" }
      }

      logger.info(`Message deleted: ${deletedTs} in channel ${channelId}`)

      const marked = await slackRepository.markDeleted(deletedTs, channelId)

      return {
        handled: true,
        action: "deleted",
        deletedTs,
        channelId,
        found: marked,
        previousText: previousMessage?.text,
      }
    } catch (error) {
      const errorMsg2 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg2 }, "Error handling message deletion")
      return { handled: true, error: String(error) }
    }
  }

  async handleMessageEdited(event: SlackEvent) {
    try {
      const message = event.message
      if (!message || !message.ts) {
        logger.warn("Message edit event missing message data")
        return { handled: false, reason: "missing_message_data" }
      }

      await slackRepository.updateMessageText(message.ts, event.channel, message.text || "")

      logger.info(`Message edited: ${message.ts} in channel ${event.channel}`)

      return {
        handled: true,
        action: "edited",
        messageTs: message.ts,
        newText: message.text,
      }
    } catch (error) {
      const errorMsg3 = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg3 }, "Error handling message edit")
      return { handled: true, error: String(error) }
    }
  }

  async handleAppMention(event: SlackEvent) {
    logger.info({ text: event.text }, "App mention received")

    await slackRepository.saveMessage({
      slackTs: event.ts,
      channelId: event.channel,
      userId: event.user,
      text: event.text,
      threadTs: event.thread_ts || null,
      processed: 1,
    })

    return { handled: true, type: "app_mention" }
  }

  async getStatus() {
    this.ensureInitialized()

    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings
    const messageCount = await slackRepository.getCount()
    const unprocessed = await slackRepository.findUnprocessed(1)

    return {
      eventApiEnabled: settings.eventApiEnabled || false,
      webhookEnabled: settings.isEnabled || false,
      monitoredChannelsCount: this.monitoredChannels?.size,
      monitoredChannels: {
        cs: !!config.CS_CHANNEL_ID,
        sales: !!config.SALES_CHANNEL_ID,
        meetingNotes: !!config.MEETING_NOTES_CHANNEL_ID,
      },
      totalMessages: messageCount,
      unprocessedMessages: unprocessed.length,
    }
  }
}

export const slackEventService = new SlackEventService()
