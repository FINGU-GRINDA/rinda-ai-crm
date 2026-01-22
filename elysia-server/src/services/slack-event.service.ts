import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db"
import { customerContacts, customers, meetingSummaries } from "../db/schema"
import {
  contactRepository,
  customerRepository,
  meetingRepository,
  notificationRepository,
  prospectRepository,
  settingsRepository,
  slackRepository,
} from "../repositories"
import type {
  ParsedMeetingNote,
  SalesMessageClassification,
  SalesUpdateData,
  SlackEvent,
  SlackMessage,
  SlackSettings,
} from "../types"
import { logger } from "../utils/logger"
import { geminiService } from "./gemini.service"

class SlackEventService {
  private monitoredChannels: Set<string> | null = null
  private initialized = false
  private channelHandlers: Map<
    string,
    (message: SlackMessage, event: SlackEvent) => Promise<Record<string, unknown>>
  > = new Map()

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

    // Register handlers
    if (config.CS_CHANNEL_ID) {
      this.channelHandlers.set(config.CS_CHANNEL_ID, this.handleCSChannel.bind(this))
    }
    if (config.MEETING_NOTES_CHANNEL_ID) {
      this.channelHandlers.set(
        config.MEETING_NOTES_CHANNEL_ID,
        this.handleMeetingNotesChannel.bind(this),
      )
    }
    if (config.SALES_CHANNEL_ID) {
      this.channelHandlers.set(config.SALES_CHANNEL_ID, this.handleSalesChannel.bind(this))
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
      const { message: savedMessage, isNew } = await slackRepository.saveMessage({
        slackTs: event.ts,
        channelId: event.channel,
        userId: event.user,
        userName: event.username || null,
        text: event.text,
        threadTs: event.thread_ts || null,
      })

      logger.info(`Saved message: ${savedMessage.id}, isNew: ${isNew}`)

      // Skip processing if this is a duplicate message (already processed or being processed)
      if (!isNew) {
        logger.info(`Skipping duplicate message: ${savedMessage.id}`)
        return { handled: true, processed: false, duplicate: true, messageId: savedMessage.id }
      }

      // Process new messages with channel-specific handlers
      await this.processMonitoredChannelMessage(savedMessage, event)

      return { handled: true, processed: true, messageId: savedMessage.id }
    }

    return { handled: true, processed: false }
  }

  async processMonitoredChannelMessage(savedMessage: SlackMessage, event: SlackEvent) {
    try {
      const channelId = event.channel
      const handler = this.channelHandlers.get(channelId)

      if (!handler) {
        logger.warn(`No handler registered for channel: ${channelId}`)
        await slackRepository.markProcessed(savedMessage.id)
        return { handled: false, reason: "no_handler" }
      }

      const result = await handler(savedMessage, event)
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error({ error: errorMsg }, "Error processing monitored channel message")
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

  // CS Channel Handler
  private async handleCSChannel(savedMessage: SlackMessage, event: SlackEvent) {
    logger.info("Processing CS channel message")

    const parsedData = await geminiService.parseCSInquiry(event.text)

    if (!parsedData.companyName) {
      await slackRepository.markProcessed(savedMessage.id)
      return { handled: true, isInquiry: false, reason: "no_company_name" }
    }

    // Check if prospect already exists for this company
    const existingProspect = await prospectRepository.findByCompanyName(parsedData.companyName)

    let prospect: Awaited<ReturnType<typeof prospectRepository.create>>
    let isNewProspect = false

    if (existingProspect) {
      // Update existing prospect with new inquiry details
      logger.info(`Found existing prospect for ${parsedData.companyName}, updating notes`)
      const updatedNotes =
        `${existingProspect.notes || ""}\n\n[Slack CS - ${new Date().toLocaleString("ko-KR")}]\n${parsedData.inquiryDetails || event.text}`.trim()

      await prospectRepository.update(existingProspect.id, {
        notes: updatedNotes,
        // Update contact info if provided and not already set
        contactName: existingProspect.contactName || parsedData.contactName || undefined,
        contactEmail: existingProspect.contactEmail || parsedData.contactEmail || undefined,
        contactPhone: existingProspect.contactPhone || parsedData.contactPhone || undefined,
        contactTitle: existingProspect.contactTitle || parsedData.contactTitle || undefined,
      })

      prospect = existingProspect
    } else {
      // Create new prospect
      prospect = await prospectRepository.create({
        companyName: parsedData.companyName,
        contactName: parsedData.contactName || undefined,
        contactTitle: parsedData.contactTitle || undefined,
        contactPhone: parsedData.contactPhone || undefined,
        contactEmail: parsedData.contactEmail || undefined,
        notes: parsedData.inquiryDetails || `[Slack CS]\n${event.text}`,
        landingPageUrl: parsedData.landingPageUrl || undefined,
        signalStrength: "medium",
        sourceTitle: "Slack CS Channel",
        sourceUri: `slack://channel/${event.channel}/${event.ts}`,
      })
      isNewProspect = true
    }

    // Only create notification for new prospects
    if (isNewProspect) {
      await notificationRepository.create({
        type: "slack",
        title: "새로운 CS 문의",
        message: `${parsedData.companyName}: ${parsedData.inquiryDetails?.substring(0, 100) || "문의 내용 확인 필요"}`,
        prospectId: prospect.id,
        priority: "medium",
        metadata: JSON.stringify({
          slackChannel: event.channel,
          slackTs: event.ts,
          contactName: parsedData.contactName,
          contactEmail: parsedData.contactEmail,
        }),
      })
    }

    await slackRepository.markProcessed(savedMessage.id, { prospectId: prospect.id })

    return {
      handled: true,
      channelType: "CS",
      prospectId: prospect.id,
      isNewProspect,
      parsedData,
    }
  }

  // Meeting Notes Channel Handler
  private async handleMeetingNotesChannel(savedMessage: SlackMessage, event: SlackEvent) {
    logger.info("Processing Meeting Notes channel message")

    // Phase 0: Check for exact duplicate by slackTs
    const existingBySlackTs = await meetingRepository.findBySlackTs(event.ts)
    if (existingBySlackTs) {
      logger.info(`Meeting already exists for Slack message ${event.ts}, updating`)
      // Update existing meeting with new content if provided
      const parsedNote = await geminiService.parseMeetingNote(event.text)
      if (parsedNote.meetingNote) {
        const appendedTranscription =
          `${existingBySlackTs.transcription || ""}\n\n[Update - ${new Date().toLocaleString("ko-KR")}]\n${parsedNote.meetingNote}`.trim()
        await meetingRepository.update(existingBySlackTs.id, {
          transcription: appendedTranscription,
          summary: parsedNote.meetingNote.substring(0, 500),
        })
      }
      await slackRepository.markProcessed(savedMessage.id, {
        customerId: existingBySlackTs.customerId,
      })
      return {
        handled: true,
        channelType: "MEETING_NOTES",
        customerId: existingBySlackTs.customerId,
        meetingId: existingBySlackTs.id,
        isDuplicate: true,
        action: "updated",
      }
    }

    const parsedNote = await geminiService.parseMeetingNote(event.text)

    if (!parsedNote.leadCompanyName) {
      await slackRepository.markProcessed(savedMessage.id)
      return { handled: true, reason: "no_company_name" }
    }

    // Phase 1: Fuzzy lookup (waterfall)
    let customerId: string | null = null
    let createdNewCustomer = false

    // Try 1: Find by company name
    customerId = await this.findCustomerByName(parsedNote.leadCompanyName)

    // Try 2: Find via contacts if decision maker name provided
    if (!customerId && parsedNote.decisionMakerName) {
      customerId = await this.findCustomerByContactName(parsedNote.decisionMakerName)
    }

    // Try 3: Create prospect → customer flow
    if (!customerId) {
      const result = await this.createCustomerFromMeetingNote(parsedNote)
      customerId = result.customerId
      createdNewCustomer = true
    }

    // Phase 2: Find or create meeting with improved duplicate detection
    let meeting: Awaited<ReturnType<typeof meetingRepository.create>>
    let isNewMeeting = false

    // Try 1: Find existing meeting for this customer today (same day dedup)
    const existingTodayMeeting = await meetingRepository.findByCustomerAndDate(
      customerId,
      new Date(),
    )

    // Try 2: Find empty meeting (meeting without transcription)
    const existingEmptyMeeting = !existingTodayMeeting
      ? await this.findEmptyMeeting(customerId)
      : null

    if (existingTodayMeeting) {
      logger.info(`Found existing meeting for ${parsedNote.leadCompanyName} today, updating`)
      meeting = existingTodayMeeting
    } else if (existingEmptyMeeting) {
      logger.info(`Found empty meeting for ${parsedNote.leadCompanyName}, updating`)
      meeting = existingEmptyMeeting
    } else {
      // Create new meeting with Slack source tracking
      meeting = await meetingRepository.create({
        customerId,
        title: `${parsedNote.leadCompanyName} 미팅`,
        meetingDate: new Date(),
        source: "slack",
        slackTs: event.ts,
        slackChannelId: event.channel,
      })
      isNewMeeting = true
    }

    // Phase 3: Update meeting with parsed content
    if (parsedNote.meetingNote) {
      const updateData: Parameters<typeof meetingRepository.update>[1] = {
        transcription: parsedNote.meetingNote,
        summary: parsedNote.meetingNote.substring(0, 500),
      }

      // Update Slack tracking if this is an existing meeting being updated from Slack
      if (!isNewMeeting && !meeting.slackTs) {
        updateData.source = "slack"
        updateData.slackTs = event.ts
        updateData.slackChannelId = event.channel
      }

      await meetingRepository.update(meeting.id, updateData)
    }

    // Add sales proposal to customer notes
    if (parsedNote.salesProposal) {
      const customer = await customerRepository.findById(customerId)
      const updatedNotes =
        `${customer?.notes || ""}\n\n[Sales Proposal - ${new Date().toLocaleString("ko-KR")}]\n${parsedNote.salesProposal}`.trim()
      await customerRepository.update(customerId, { notes: updatedNotes })
    }

    await slackRepository.markProcessed(savedMessage.id, { customerId })

    return {
      handled: true,
      channelType: "MEETING_NOTES",
      customerId,
      meetingId: meeting.id,
      createdNewCustomer,
      isNewMeeting,
      parsedData: parsedNote,
    }
  }

  // Sales Channel Handler
  private async handleSalesChannel(savedMessage: SlackMessage, event: SlackEvent) {
    logger.info("Processing Sales channel message")

    // Phase 1: Classify message
    const classification = await geminiService.classifySalesMessage(event.text)

    if (classification.messageType === "other") {
      await slackRepository.markProcessed(savedMessage.id)
      return { handled: true, reason: "not_sales_related" }
    }

    // Phase 2: Route based on classification
    if (classification.messageType === "new_customer") {
      return await this.handleNewCustomerSales(savedMessage, event, classification)
    } else {
      return await this.handleExistingCustomerSales(savedMessage, event, classification)
    }
  }

  private async handleNewCustomerSales(
    savedMessage: SlackMessage,
    event: SlackEvent,
    classification: SalesMessageClassification,
  ) {
    // Use existing parseCustomerInquiry for new customers
    const parsedData = await geminiService.parseCustomerInquiry(event.text)

    const companyName = parsedData.companyName || classification.companyName

    if (!companyName) {
      await slackRepository.markProcessed(savedMessage.id)
      return { handled: true, reason: "no_company_identified" }
    }

    // Check if already exists
    const existingCustomer = await customerRepository.findByName(companyName)
    if (existingCustomer) {
      // Add note to existing
      const updatedNotes =
        `${existingCustomer.notes || ""}\n\n[Slack Sales - ${new Date().toLocaleString("ko-KR")}]\n${event.text}`.trim()
      await customerRepository.update(existingCustomer.id, { notes: updatedNotes })
      await slackRepository.markProcessed(savedMessage.id, { customerId: existingCustomer.id })

      return {
        handled: true,
        channelType: "SALES",
        subType: "new_customer_existing",
        customerId: existingCustomer.id,
      }
    }

    // Create prospect
    const prospect = await prospectRepository.create({
      companyName,
      industry: parsedData.industry || undefined,
      signalStrength: parsedData.urgency === "high" ? "high" : "medium",
      notes: `[Slack Sales]\n${parsedData.summary || event.text}`,
      sourceTitle: "Slack Sales Channel",
      sourceUri: `slack://channel/${event.channel}/${event.ts}`,
    })

    await slackRepository.markProcessed(savedMessage.id, { prospectId: prospect.id })

    return {
      handled: true,
      channelType: "SALES",
      subType: "new_customer",
      prospectId: prospect.id,
    }
  }

  private async handleExistingCustomerSales(
    savedMessage: SlackMessage,
    event: SlackEvent,
    classification: SalesMessageClassification,
  ) {
    // Get customer context
    let customerContext = ""
    let customerId: string | null = null

    if (classification.companyName) {
      const customer = await customerRepository.findByName(classification.companyName)
      if (customer) {
        customerId = customer.id
        customerContext = `회사명: ${customer.name}\n상태: ${customer.status}\n산업: ${customer.industry || "미지정"}`
      }
    }

    // Parse update intent
    const updateData = await geminiService.parseSalesUpdate(event.text, customerContext)

    if (!customerId && updateData.customerName) {
      const customer = await customerRepository.findByName(updateData.customerName)
      if (customer) {
        customerId = customer.id
      }
    }

    if (!customerId) {
      await slackRepository.markProcessed(savedMessage.id)
      return {
        handled: true,
        channelType: "SALES",
        reason: "customer_not_found",
        warning: "고객을 찾을 수 없어 처리하지 못했습니다",
      }
    }

    // Phase 3: Execute update
    await this.executeSalesUpdate(customerId, updateData, event)

    await slackRepository.markProcessed(savedMessage.id, { customerId })

    return {
      handled: true,
      channelType: "SALES",
      subType: "existing_customer_update",
      customerId,
      updateType: updateData.updateType,
    }
  }

  private async executeSalesUpdate(
    customerId: string,
    updateData: SalesUpdateData,
    _event: SlackEvent,
  ) {
    switch (updateData.updateType) {
      case "status_change":
        if (updateData.statusChange) {
          await customerRepository.update(customerId, {
            status: updateData.statusChange.newStatus,
          })

          if (updateData.statusChange.newStatus === "lost" && updateData.statusChange.reason) {
            await customerRepository.markAsLost(customerId, updateData.statusChange.reason)
          }
        }
        break

      case "add_note":
        if (updateData.note) {
          const customer = await customerRepository.findById(customerId)
          const updatedNotes =
            `${customer?.notes || ""}\n\n[Slack Sales - ${new Date().toLocaleString("ko-KR")}]\n${updateData.note}`.trim()
          await customerRepository.update(customerId, { notes: updatedNotes })
        }
        break

      case "create_followup":
        // Skip for now - followup table not implemented
        logger.info("Follow-up creation requested but not implemented yet")
        break

      case "update_contact":
        if (updateData.contactUpdate) {
          const contacts = await contactRepository.findByCustomerId(customerId)
          const primaryContact = contacts.find((c) => c.isPrimary === 1)

          if (primaryContact) {
            await contactRepository.update(primaryContact.id, {
              name: updateData.contactUpdate.name || primaryContact.name,
              title: updateData.contactUpdate.title || primaryContact.title,
              email: updateData.contactUpdate.email || primaryContact.email,
              phone: updateData.contactUpdate.phone || primaryContact.phone,
            })
          } else if (updateData.contactUpdate.name) {
            await contactRepository.create({
              customerId,
              name: updateData.contactUpdate.name,
              title: updateData.contactUpdate.title,
              email: updateData.contactUpdate.email,
              phone: updateData.contactUpdate.phone,
              isPrimary: 1,
            })
          }
        }
        break
    }
  }

  // Helper: Fuzzy find customer by company name
  private async findCustomerByName(companyName: string): Promise<string | null> {
    // Try 1: Exact match (case-insensitive via SQL)
    const exactMatch = await db
      .select()
      .from(customers)
      .where(sql`LOWER(${customers.name}) = LOWER(${companyName})`)
      .limit(1)

    const firstExactMatch = exactMatch[0]
    if (firstExactMatch) {
      return firstExactMatch.id
    }

    // Try 2: Partial match (contains)
    const partialMatches = await db
      .select()
      .from(customers)
      .where(sql`LOWER(${customers.name}) LIKE LOWER(${`%${companyName}%`})`)
      .limit(5)

    if (partialMatches.length === 1) {
      const match = partialMatches[0]
      if (match) {
        logger.info(`Fuzzy match found: "${companyName}" → "${match.name}"`)
        return match.id
      }
    }

    if (partialMatches.length > 1) {
      const firstMatch = partialMatches[0]
      if (firstMatch) {
        logger.warn(
          {
            searchTerm: companyName,
            matches: partialMatches.map((c) => c.name),
          },
          "Multiple fuzzy matches found - using first",
        )
        return firstMatch.id
      }
    }

    return null
  }

  // Helper: Find customer by contact name
  private async findCustomerByContactName(contactName: string): Promise<string | null> {
    const contacts = await db
      .select({
        customerId: customerContacts.customerId,
        contactName: customerContacts.name,
        customerName: customers.name,
      })
      .from(customerContacts)
      .innerJoin(customers, eq(customerContacts.customerId, customers.id))
      .where(sql`LOWER(${customerContacts.name}) LIKE LOWER(${`%${contactName}%`})`)
      .limit(5)

    if (contacts.length === 1) {
      const contact = contacts[0]
      if (contact) {
        logger.info(`Found customer via contact: "${contactName}" → "${contact.customerName}"`)
        return contact.customerId
      }
    }

    if (contacts.length > 1) {
      const firstContact = contacts[0]
      if (firstContact) {
        logger.warn(
          {
            searchTerm: contactName,
            matches: contacts.map((c) => `${c.contactName} (${c.customerName})`),
          },
          "Multiple contact matches found - using first",
        )
        return firstContact.customerId
      }
    }

    return null
  }

  // Helper: Create customer from meeting note
  private async createCustomerFromMeetingNote(
    parsedNote: ParsedMeetingNote,
  ): Promise<{ customerId: string; prospectId?: string }> {
    if (!parsedNote.leadCompanyName) {
      throw new Error("Lead company name is required to create customer from meeting note")
    }

    const existingProspect = await prospectRepository.findByCompanyName(parsedNote.leadCompanyName)

    let prospectId: string | undefined

    if (!existingProspect) {
      const prospect = await prospectRepository.create({
        companyName: parsedNote.leadCompanyName,
        contactName: parsedNote.decisionMakerName || undefined,
        signalStrength: "high",
        notes: `[Meeting Note]\n${parsedNote.meetingNote || ""}`,
        sourceTitle: "Slack Meeting Notes",
      })
      prospectId = prospect.id
    } else {
      prospectId = existingProspect.id
    }

    // Convert to customer
    const customer = await customerRepository.create({
      name: parsedNote.leadCompanyName,
      status: "contact",
      notes: `[Converted from Meeting Note]\n${parsedNote.meetingNote || ""}`,
      leadSource: "Slack Meeting Notes",
    })

    // Mark prospect as converted
    if (prospectId) {
      await prospectRepository.markAsConverted(prospectId, customer.id)
    }

    // Create contact if decision maker name exists
    if (parsedNote.decisionMakerName) {
      await contactRepository.create({
        customerId: customer.id,
        name: parsedNote.decisionMakerName,
        isPrimary: 1,
      })
    }

    return { customerId: customer.id, prospectId }
  }

  // Helper: Find meeting without transcription
  private async findEmptyMeeting(customerId: string) {
    const meetings = await db
      .select()
      .from(meetingSummaries)
      .where(
        and(eq(meetingSummaries.customerId, customerId), isNull(meetingSummaries.transcription)),
      )
      .orderBy(desc(meetingSummaries.meetingDate))
      .limit(1)

    return meetings[0] || null
  }
}

export const slackEventService = new SlackEventService()
