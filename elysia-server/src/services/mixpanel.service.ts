import { config } from "../config"
import { mixpanelRepository, settingsRepository } from "../repositories"
import type { MixpanelSettings } from "../types"
import { logger } from "../utils/logger"

class MixpanelService {
  isAvailable(): boolean {
    return !!(config.MIXPANEL_PROJECT_ID && config.MIXPANEL_PROJECT_SECRET)
  }

  async fetchEvents(options: { fromDate?: Date; toDate?: Date; limit?: number } = {}): Promise<
    Array<{
      eventName: string
      distinctId: string
      properties: Record<string, unknown>
      time: number
    }>
  > {
    if (!this.isAvailable()) {
      throw new Error("Mixpanel not configured")
    }

    const {
      fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      toDate = new Date(),
      limit = 100,
    } = options

    const fromDateStr = fromDate.toISOString().split("T")[0]
    const toDateStr = toDate.toISOString().split("T")[0]

    const auth = Buffer.from(`${config.MIXPANEL_PROJECT_SECRET}:`).toString("base64")

    try {
      const response = await fetch(
        `https://data.mixpanel.com/api/2.0/export?from_date=${fromDateStr}&to_date=${toDateStr}&limit=${limit}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Mixpanel API error: ${response.status}`)
      }

      const text = await response.text()
      const lines = text.trim().split("\n").filter(Boolean)

      return lines.map((line) => {
        const event = JSON.parse(line)
        return {
          eventName: event.event,
          distinctId: event.properties.distinct_id,
          properties: event.properties,
          time: event.properties.time * 1000, // Convert to milliseconds
        }
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg }, "Error fetching Mixpanel events")
      throw error
    }
  }

  async syncEvents(): Promise<{ synced: number; errors: number }> {
    const events = await this.fetchEvents()
    let synced = 0
    let errors = 0

    for (const event of events) {
      try {
        await mixpanelRepository.save({
          eventName: event.eventName,
          distinctId: event.distinctId,
          properties: JSON.stringify(event.properties),
          receivedAt: event.time,
        })
        synced++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error({ error: errorMsg }, "Error saving Mixpanel event")
        errors++
      }
    }

    logger.info(`Mixpanel sync completed: ${synced} synced, ${errors} errors`)
    return { synced, errors }
  }

  async getStatus(): Promise<{
    enabled: boolean
    configured: boolean
    totalEvents: number
    unprocessedEvents: number
  }> {
    const settings = (await settingsRepository.getMixpanelSettings()) as MixpanelSettings
    const totalEvents = await mixpanelRepository.getCount()
    const unprocessed = await mixpanelRepository.findUnprocessed(1)

    return {
      enabled: settings.enabled || false,
      configured: this.isAvailable(),
      totalEvents,
      unprocessedEvents: unprocessed.length,
    }
  }

  async processUnprocessedEvents(): Promise<{ processed: number; errors: number }> {
    const events = await mixpanelRepository.findUnprocessed(100)
    let processed = 0
    let errors = 0

    for (const event of events) {
      try {
        // Process event logic here (e.g., match to customer, create notification)
        await mixpanelRepository.markProcessed(event.id)
        processed++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error({ error: errorMsg }, `Error processing Mixpanel event ${event.id}`)
        errors++
      }
    }

    return { processed, errors }
  }
}

export const mixpanelService = new MixpanelService()
