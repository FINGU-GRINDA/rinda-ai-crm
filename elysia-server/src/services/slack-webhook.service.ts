import { settingsRepository } from "../repositories"
import type { SlackBlock, SlackSettings, SlackWebhookPayload } from "../types"
import { logger } from "../utils/logger"

class SlackWebhookService {
  async sendNotification(message: SlackWebhookPayload): Promise<boolean> {
    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings

    if (!settings.isEnabled || !settings.webhookUrl) {
      logger.warn("Slack webhook not configured or disabled")
      return false
    }

    try {
      const response = await fetch(settings.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        logger.error(`Slack webhook error: ${response.status}`)
        return false
      }

      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg }, "Error sending Slack notification")
      return false
    }
  }

  async sendProspectNotification(prospect: {
    companyName: string
    industry?: string | null
    signalStrength?: string | null
    notes?: string | null
  }): Promise<boolean> {
    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings
    if (!settings.notifications?.newProspect) return false

    const blocks: SlackBlock[] = [
      {
        type: "header" as const,
        text: {
          type: "plain_text" as const,
          text: "🎯 새로운 잠재고객 발견",
        },
      },
      {
        type: "section" as const,
        fields: [
          {
            type: "mrkdwn" as const,
            text: `*회사명:*\n${prospect.companyName}`,
          },
          {
            type: "mrkdwn" as const,
            text: `*산업:*\n${prospect.industry || "미정"}`,
          },
          {
            type: "mrkdwn" as const,
            text: `*신호 강도:*\n${prospect.signalStrength || "medium"}`,
          },
        ],
      },
    ]

    if (prospect.notes) {
      blocks.push({
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `*메모:*\n${prospect.notes}`,
        },
      })
    }

    return this.sendNotification({ blocks })
  }

  async sendFollowUpReminder(
    customer: {
      name: string
      lastFollowUpAt?: number | null
    },
    scheduledFor: number,
    reason?: string,
  ): Promise<boolean> {
    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings
    if (!settings.notifications?.followUpReminder) return false

    const scheduledDate = new Date(scheduledFor).toLocaleString("ko-KR")

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⏰ 팔로업 리마인더",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*고객:*\n${customer.name}`,
          },
          {
            type: "mrkdwn",
            text: `*예정 시간:*\n${scheduledDate}`,
          },
        ],
      },
    ]

    if (reason) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*사유:*\n${reason}`,
        },
      })
    }

    return this.sendNotification({ blocks })
  }

  async sendDealWonNotification(customer: {
    name: string
    industry?: string | null
  }): Promise<boolean> {
    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings
    if (!settings.notifications?.dealWon) return false

    return this.sendNotification({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 딜 성사!",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${customer.name}* 고객과의 딜이 성사되었습니다!`,
          },
        },
      ],
    })
  }

  async sendDealLostNotification(customer: {
    name: string
    lostReason?: string | null
  }): Promise<boolean> {
    const settings = (await settingsRepository.getSlackSettings()) as SlackSettings
    if (!settings.notifications?.dealLost) return false

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "😢 딜 실패",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${customer.name}* 고객과의 딜이 실패했습니다.`,
        },
      },
    ]

    if (customer.lostReason) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*실패 사유:*\n${customer.lostReason}`,
        },
      })
    }

    return this.sendNotification({ blocks })
  }

  async validateWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "RINDA CRM 연동 테스트 메시지입니다. 이 메시지가 보이면 설정이 완료된 것입니다! 🎉",
        }),
      })

      return response.ok
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg }, "Webhook validation failed")
      return false
    }
  }
}

export const slackWebhookService = new SlackWebhookService()
