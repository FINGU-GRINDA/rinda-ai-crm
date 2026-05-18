/**
 * Slack Integration Service
 * Manages Slack webhook settings and notifications
 */

import { apiClient } from "../src/services/apiClient"
import type { Customer, Prospect, ScheduledFollowUp, SlackSettings } from "../types"

const SLACK_SETTINGS_KEY = "rinda_slack_settings"

// Default Slack settings
const DEFAULT_SLACK_SETTINGS: SlackSettings = {
  webhookUrl: "",
  isEnabled: false,
  notifications: {
    newProspect: true,
    followUpReminder: true,
    followUpCompleted: true,
    dailyDigest: false,
    dealWon: false,
    dealLost: false,
  },
  isValidated: false,
  dailyDigestTime: "09:00",
}

/**
 * Get Slack settings from localStorage
 */
export const getSlackSettings = (): SlackSettings => {
  try {
    const stored = localStorage.getItem(SLACK_SETTINGS_KEY)
    if (stored) {
      return { ...DEFAULT_SLACK_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error("Failed to load Slack settings:", error)
  }
  return DEFAULT_SLACK_SETTINGS
}

/**
 * Save Slack settings to localStorage
 */
export const saveSlackSettings = (settings: SlackSettings): void => {
  try {
    localStorage.setItem(SLACK_SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Failed to save Slack settings:", error)
  }
}

/**
 * Clear Slack settings
 */
export const clearSlackSettings = (): void => {
  try {
    localStorage.removeItem(SLACK_SETTINGS_KEY)
  } catch (error) {
    console.error("Failed to clear Slack settings:", error)
  }
}

/**
 * Validate Slack Webhook URL via backend API
 */
export const validateWebhookUrl = async (
  webhookUrl: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await apiClient.validateSlackWebhook(webhookUrl)
    if (result.success && "data" in result) {
      return { success: result.data.valid === true }
    }
    return { success: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Validation failed"
    return { success: false, error: message }
  }
}

/**
 * Send test message to Slack
 */
export const sendTestMessage = async (
  webhookUrl: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await apiClient.sendSlackTestMessage(webhookUrl)
    return { success: result.success }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send test message"
    return { success: false, error: message }
  }
}

/**
 * Check if Slack notifications are enabled
 */
export const isSlackEnabled = (): boolean => {
  const settings = getSlackSettings()
  return settings.isEnabled && settings.isValidated && !!settings.webhookUrl
}

/**
 * Send new prospect notification to Slack
 */
export const sendNewProspectNotification = async (prospect: Prospect): Promise<void> => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.newProspect || !settings.webhookUrl) {
    return
  }

  try {
    await apiClient.sendSlackNotification(
      settings.webhookUrl,
      "new_prospect",
      prospect as unknown as Record<string, unknown>,
    )
    console.log("Slack notification sent: new_prospect")
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
    // Don't throw - notifications should fail silently
  }
}

/**
 * Send follow-up reminder notification to Slack
 */
export const sendFollowUpReminder = async (
  customer: Customer,
  followUp: ScheduledFollowUp,
): Promise<void> => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.followUpReminder || !settings.webhookUrl) {
    return
  }

  try {
    await apiClient.sendSlackNotification(settings.webhookUrl, "followup_reminder", {
      customer,
      followUp,
    })
    console.log("Slack notification sent: followup_reminder")
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
  }
}

/**
 * Send deal won notification to Slack
 */
export const sendDealWonNotification = async (customer: Customer): Promise<void> => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.dealWon || !settings.webhookUrl) {
    return
  }

  try {
    await apiClient.sendSlackNotification(
      settings.webhookUrl,
      "deal_won",
      customer as unknown as Record<string, unknown>,
    )
    console.log("Slack notification sent: deal_won")
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
  }
}

/**
 * Send deal lost notification to Slack
 */
export const sendDealLostNotification = async (customer: Customer): Promise<void> => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.dealLost || !settings.webhookUrl) {
    return
  }

  try {
    await apiClient.sendSlackNotification(
      settings.webhookUrl,
      "deal_lost",
      customer as unknown as Record<string, unknown>,
    )
    console.log("Slack notification sent: deal_lost")
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
  }
}

/**
 * Send follow-up completed notification to Slack
 */
export const sendFollowUpCompletedNotification = async (
  customer: Customer,
  followUp: ScheduledFollowUp,
  completionNote?: string,
): Promise<void> => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.followUpCompleted || !settings.webhookUrl) {
    return
  }

  try {
    await apiClient.sendSlackNotification(settings.webhookUrl, "followup_reminder", {
      customer,
      followUp,
      completionNote,
    })
    console.log("Slack notification sent: followup_completed")
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
  }
}

/**
 * Send daily digest notification to Slack
 */
export const sendDailyDigestNotification = async (
  pendingCount: number,
  overdueCount: number,
  todayFollowUps: Array<{ customer: Customer; followUp: ScheduledFollowUp }>,
): Promise<void> => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.dailyDigest || !settings.webhookUrl) {
    return
  }

  try {
    await apiClient.sendSlackNotification(settings.webhookUrl, "new_prospect", {
      pendingCount,
      overdueCount,
      todayFollowUps,
      date: new Date().toLocaleDateString("ko-KR"),
    })

    // Update last digest sent time
    const updatedSettings = {
      ...settings,
      lastDigestSentAt: new Date().toISOString(),
    }
    saveSlackSettings(updatedSettings)

    console.log("Slack notification sent: daily_digest")
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
  }
}

/**
 * Check if daily digest should be sent
 */
export const shouldSendDailyDigest = (): boolean => {
  const settings = getSlackSettings()

  if (!settings.isEnabled || !settings.notifications.dailyDigest || !settings.webhookUrl) {
    return false
  }

  const now = new Date()
  const targetTime = settings.dailyDigestTime || "09:00"
  const [targetHour, targetMinute] = targetTime.split(":").map(Number)

  // Check if current time is within 5 minutes of target time
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const targetMinutes = targetHour * 60 + targetMinute

  if (Math.abs(currentMinutes - targetMinutes) > 5) {
    return false
  }

  // Check if we already sent today
  if (settings.lastDigestSentAt) {
    const lastSent = new Date(settings.lastDigestSentAt)
    if (
      lastSent.getDate() === now.getDate() &&
      lastSent.getMonth() === now.getMonth() &&
      lastSent.getFullYear() === now.getFullYear()
    ) {
      return false
    }
  }

  return true
}
