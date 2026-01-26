import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db"
import { customerContacts, customers, meetingSummaries } from "../db/schema"
import {
  attachmentRepository,
  contactRepository,
  customerRepository,
  followUpRepository,
  meetingRepository,
  notificationRepository,
  prospectRepository,
  settingsRepository,
  slackRepository,
} from "../repositories"
import type {
  FuzzyMatchResult,
  MeetingSummary,
  ParsedMeetingNote,
  SalesMessageClassification,
  SalesUpdateData,
  SlackEvent,
  SlackMessage,
  SlackSettings,
  ThreadContext,
} from "../types"
import { logger } from "../utils/logger"
import { fileProcessingService } from "./file-processing.service"
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

    // Initialize file processing service with Gemini fallback for image analysis
    fileProcessingService.initialize(geminiService.analyzeImage.bind(geminiService))

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
      logger.error(
        { error: errorMsg, messageId: savedMessage.id },
        "Error processing monitored channel message",
      )

      // Track the error instead of marking as processed - allows retry
      await slackRepository.markFailed(savedMessage.id, errorMsg)

      return { handled: false, error: errorMsg }
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

      logger.info({ deletedTs, channelId }, "Processing message deletion with cascade")

      // Find the message to get linked customer/prospect IDs before deleting
      const slackMessage = await slackRepository.findBySlackTs(deletedTs)

      let deletedCustomerId: string | null = null
      let deletedProspectId: string | null = null

      if (slackMessage) {
        // Cascade delete: Delete linked customer if exists
        if (slackMessage.customerId) {
          logger.info(
            { customerId: slackMessage.customerId, slackTs: deletedTs },
            "Cascade deleting customer linked to deleted Slack message",
          )
          await customerRepository.delete(slackMessage.customerId)
          deletedCustomerId = slackMessage.customerId
        }

        // Cascade delete: Delete linked prospect if exists
        if (slackMessage.prospectId) {
          logger.info(
            { prospectId: slackMessage.prospectId, slackTs: deletedTs },
            "Cascade deleting prospect linked to deleted Slack message",
          )
          await prospectRepository.delete(slackMessage.prospectId)
          deletedProspectId = slackMessage.prospectId
        }

        // Delete attachments linked to this message
        const deletedAttachments = await attachmentRepository.deleteByEntity(
          "slack_message",
          slackMessage.id,
        )
        if (deletedAttachments > 0) {
          logger.info(
            { count: deletedAttachments, slackMessageId: slackMessage.id },
            "Deleted attachments linked to Slack message",
          )
        }
      }

      // Mark the slack message as deleted
      const marked = await slackRepository.markDeleted(deletedTs, channelId)

      return {
        handled: true,
        action: "deleted",
        deletedTs,
        channelId,
        found: marked,
        previousText: previousMessage?.text,
        cascadeDeleted: {
          customerId: deletedCustomerId,
          prospectId: deletedProspectId,
        },
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

    // Process file attachments if present
    let fileContent = ""
    let processedFiles: Array<{
      fileId: string
      fileName: string
      mimetype: string
      text: string | null
      error: string | null
    }> = []

    if (event.files && event.files.length > 0) {
      logger.info({ fileCount: event.files.length }, "Processing file attachments")
      const fileResult = await fileProcessingService.processSlackFiles(event.files)
      fileContent = fileResult.combinedText
      processedFiles = fileResult.files
      logger.info(
        {
          totalFiles: event.files.length,
          successfulFiles: processedFiles.filter((f) => !f.error).length,
          processingTimeMs: fileResult.totalProcessingTimeMs,
        },
        "File processing complete",
      )
    }

    // Combine message text with extracted file content
    const combinedText = fileContent
      ? `${event.text}\n\n[Attached Files Content]\n${fileContent}`
      : event.text

    // Parse with combined content (AI now sees message + all file contents)
    const parsedData = await geminiService.parseCSInquiry(combinedText)

    if (!parsedData.companyName) {
      await slackRepository.markProcessed(savedMessage.id)
      return { handled: true, isInquiry: false, reason: "no_company_name" }
    }

    // Use findOrCreate to prevent duplicate prospects (race-condition safe)
    // Use AI-parsed leadSource if available, fallback to "Slack CS Channel"
    const { prospect, created: isNewProspect } = await prospectRepository.findOrCreate({
      companyName: parsedData.companyName,
      contactName: parsedData.contactName || undefined,
      contactTitle: parsedData.contactTitle || undefined,
      contactPhone: parsedData.contactPhone || undefined,
      contactEmail: parsedData.contactEmail || undefined,
      notes: parsedData.inquiryDetails || `[Slack CS]\n${event.text}`,
      landingPageUrl: parsedData.landingPageUrl || undefined,
      signalStrength: "medium",
      sourceTitle: parsedData.leadSource || "Slack CS Channel",
      sourceUri: `slack://channel/${event.channel}/${event.ts}`,
    })

    // If prospect existed, append new inquiry to notes
    if (!isNewProspect) {
      logger.info(`Found existing prospect for ${parsedData.companyName}, updating notes`)
      const updatedNotes =
        `${prospect.notes || ""}\n\n[Slack CS - ${new Date().toLocaleString("ko-KR")}]\n${parsedData.inquiryDetails || event.text}`.trim()

      await prospectRepository.update(prospect.id, {
        notes: updatedNotes,
        // Update contact info if provided and not already set
        contactName: prospect.contactName || parsedData.contactName || undefined,
        contactEmail: prospect.contactEmail || parsedData.contactEmail || undefined,
        contactPhone: prospect.contactPhone || parsedData.contactPhone || undefined,
        contactTitle: prospect.contactTitle || parsedData.contactTitle || undefined,
      })
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

    // Store attachment metadata if files were processed
    if (processedFiles.length > 0) {
      const attachmentRecords = processedFiles.map((file) => ({
        fileName: file.fileName,
        fileType: file.mimetype,
        fileUrl: `slack://file/${file.fileId}`,
        entityType: "slack_message" as const,
        entityId: savedMessage.id,
        metadata: JSON.stringify({
          slackFileId: file.fileId,
          extractedText: file.text?.substring(0, 5000), // Limit stored text
          processingError: file.error,
        }),
        description: file.text ? "Processed successfully" : file.error || "Processing failed",
      }))

      await attachmentRepository.createBulk(attachmentRecords)
    }

    return {
      handled: true,
      channelType: "CS",
      prospectId: prospect.id,
      isNewProspect,
      parsedData,
      attachmentsProcessed: processedFiles.length,
      attachmentErrors: processedFiles.filter((f) => f.error).length,
    }
  }

  // Meeting Notes Channel Handler
  private async handleMeetingNotesChannel(savedMessage: SlackMessage, event: SlackEvent) {
    logger.info("Processing Meeting Notes channel message")

    // Phase 0: Check thread context first (NEW: thread-aware processing)
    const threadContext = await this.getThreadContext(event)

    // If this is a thread reply and parent already created a meeting, append to it
    if (threadContext.isThreadReply && threadContext.existingMeeting) {
      logger.info(
        { parentTs: threadContext.parentTs, meetingId: threadContext.existingMeeting.id },
        "Thread reply detected, appending to existing meeting",
      )
      return this.handleThreadReplyToMeeting(savedMessage, event, threadContext.existingMeeting)
    }

    // Phase 0.5: Check for exact duplicate by slackTs (for parent messages)
    const existingBySlackTs = await meetingRepository.findBySlackTs(event.ts)
    if (existingBySlackTs) {
      logger.info(`Meeting already exists for Slack message ${event.ts}, updating`)
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

    // Phase 1: Fuzzy lookup with confidence scoring (waterfall)
    let customerId: string | null = null
    let createdNewCustomer = false
    let matchConfidence: FuzzyMatchResult | null = null

    // Try 1: Find by company name with confidence
    matchConfidence = await this.findCustomerByNameWithConfidence(parsedNote.leadCompanyName)
    if (matchConfidence) {
      customerId = matchConfidence.customerId
      logger.info(
        {
          searchTerm: parsedNote.leadCompanyName,
          matchedCustomer: matchConfidence.customerName,
          matchType: matchConfidence.matchType,
          confidence: matchConfidence.confidence,
        },
        "Customer match found",
      )
    }

    // Try 2: Find via contacts if decision maker name provided
    if (!customerId && parsedNote.decisionMakerName) {
      customerId = await this.findCustomerByContactName(parsedNote.decisionMakerName)
      if (customerId) {
        matchConfidence = {
          customerId,
          customerName: parsedNote.decisionMakerName,
          matchType: "contact",
          confidence: 0.8, // Contact match has decent confidence
        }
      }
    }

    // Try 3: Create prospect → customer flow
    if (!customerId) {
      const result = await this.createCustomerFromMeetingNote(parsedNote)
      customerId = result.customerId
      createdNewCustomer = true
    }

    // Phase 2: Find or create meeting with thread-aware duplicate detection
    let meeting: MeetingSummary | undefined
    let isNewMeeting = false

    // Priority 1: Check for thread parent's meeting (if this is orphan reply)
    if (threadContext.isThreadReply && threadContext.parentTs) {
      const parentMeeting = await meetingRepository.findBySlackTs(threadContext.parentTs)
      if (parentMeeting) {
        logger.info(`Found meeting via thread parent ${threadContext.parentTs}`)
        meeting = parentMeeting
      }
    }

    // Priority 2: Find existing meeting for same channel today (more specific dedup)
    if (!meeting) {
      const existingTodayChannelMeeting = await meetingRepository.findByCustomerDateAndChannel(
        customerId,
        new Date(),
        event.channel,
      )
      if (existingTodayChannelMeeting) {
        logger.info(
          `Found existing meeting for ${parsedNote.leadCompanyName} in same channel today`,
        )
        meeting = existingTodayChannelMeeting
      }
    }

    // Priority 3: Find empty meeting (meeting without transcription)
    if (!meeting) {
      const existingEmptyMeeting = await this.findEmptyMeeting(customerId)
      if (existingEmptyMeeting) {
        logger.info(`Found empty meeting for ${parsedNote.leadCompanyName}, updating`)
        meeting = existingEmptyMeeting
      }
    }

    // Priority 4: Create new meeting
    if (!meeting) {
      // Use thread parent's ts if this is a thread reply (for future thread replies)
      const slackTsToUse = threadContext.parentTs || event.ts
      meeting = await meetingRepository.create({
        customerId,
        title: `${parsedNote.leadCompanyName} 미팅`,
        meetingDate: new Date(),
        source: "slack",
        slackTs: slackTsToUse,
        slackChannelId: event.channel,
        customerMatchConfidence: matchConfidence ? JSON.stringify(matchConfidence) : undefined,
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
        updateData.slackTs = threadContext.parentTs || event.ts
        updateData.slackChannelId = event.channel
      }

      // Store sales proposal in meeting (not just customer notes)
      if (parsedNote.salesProposal) {
        updateData.salesProposal = parsedNote.salesProposal
      }

      // Store match confidence metadata
      if (matchConfidence && !meeting.customerMatchConfidence) {
        updateData.customerMatchConfidence = JSON.stringify(matchConfidence)
      }

      await meetingRepository.update(meeting.id, updateData)
    }

    // Also append sales proposal to customer notes for backwards compatibility
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
      isThreadReply: threadContext.isThreadReply,
      matchConfidence: matchConfidence?.confidence,
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

    // Check if already exists as customer
    const existingCustomer = await customerRepository.findByName(companyName)
    if (existingCustomer) {
      // Add note to existing customer
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

    // Use findOrCreate to prevent duplicate prospects (race-condition safe)
    const { prospect, created } = await prospectRepository.findOrCreate({
      companyName,
      industry: parsedData.industry || undefined,
      signalStrength: parsedData.urgency === "high" ? "high" : "medium",
      notes: `[Slack Sales]\n${parsedData.summary || event.text}`,
      sourceTitle: "Slack Sales Channel",
      sourceUri: `slack://channel/${event.channel}/${event.ts}`,
    })

    // If prospect existed, append to notes
    if (!created) {
      const updatedNotes =
        `${prospect.notes || ""}\n\n[Slack Sales - ${new Date().toLocaleString("ko-KR")}]\n${parsedData.summary || event.text}`.trim()
      await prospectRepository.update(prospect.id, { notes: updatedNotes })
    }

    await slackRepository.markProcessed(savedMessage.id, { prospectId: prospect.id })

    return {
      handled: true,
      channelType: "SALES",
      subType: created ? "new_customer" : "existing_prospect",
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
        if (updateData.followUp) {
          // Calculate scheduled date based on scheduledDays
          const scheduledDate = new Date()
          scheduledDate.setDate(scheduledDate.getDate() + (updateData.followUp.scheduledDays || 1))

          // Create the scheduled follow-up
          const followUp = await followUpRepository.createScheduled({
            customerId,
            scheduledFor: scheduledDate,
            type: updateData.followUp.type || "message",
            content: updateData.followUp.content,
            priority: "medium",
            reason: "[Slack Sales] Auto-created from sales channel message",
          })

          logger.info(
            { customerId, followUpId: followUp.id, scheduledFor: scheduledDate },
            "Follow-up created from Slack",
          )

          // Create notification for the follow-up
          await notificationRepository.create({
            type: "followup",
            title: "새 팔로업 예정",
            message: `${updateData.followUp.content?.substring(0, 100) || "팔로업 예정됨"}`,
            customerId,
            priority: "medium",
            metadata: JSON.stringify({
              followUpId: followUp.id,
              scheduledFor: scheduledDate.toISOString(),
              followUpType: updateData.followUp.type,
            }),
          })
        }
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

  // Helper: Get thread context for a Slack message
  private async getThreadContext(event: SlackEvent): Promise<ThreadContext> {
    // If this message has a thread_ts different from its ts, it's a reply
    const isThreadReply = !!event.thread_ts && event.thread_ts !== event.ts

    if (!isThreadReply) {
      return {
        isThreadReply: false,
        parentTs: null,
        parentMessage: null,
        existingMeeting: null,
      }
    }

    // At this point, we know event.thread_ts is defined (checked above)
    const threadTs = event.thread_ts as string

    // Find parent message
    const parentMessage = await slackRepository.findBySlackTs(threadTs)

    // Find meeting created from parent (using parent's slackTs)
    const existingMeeting = await meetingRepository.findBySlackTs(threadTs)

    return {
      isThreadReply: true,
      parentTs: threadTs,
      parentMessage,
      existingMeeting,
    }
  }

  // Handler for thread replies to existing meetings
  private async handleThreadReplyToMeeting(
    savedMessage: SlackMessage,
    event: SlackEvent,
    existingMeeting: MeetingSummary,
  ): Promise<Record<string, unknown>> {
    const parsedNote = await geminiService.parseMeetingNote(event.text)

    // Append new content to existing meeting
    const timestamp = new Date().toLocaleString("ko-KR")
    const appendedTranscription =
      `${existingMeeting.transcription || ""}\n\n[Thread Reply - ${timestamp}]\n${parsedNote.meetingNote || event.text}`.trim()

    const updateData: Parameters<typeof meetingRepository.update>[1] = {
      transcription: appendedTranscription,
    }

    // Update summary if new note provides more detail
    if (parsedNote.meetingNote) {
      updateData.summary = parsedNote.meetingNote.substring(0, 500)
    }

    // Handle salesProposal from reply - store in meeting
    if (parsedNote.salesProposal) {
      const existingSalesProposal = existingMeeting.salesProposal || ""
      updateData.salesProposal =
        `${existingSalesProposal}\n\n[Thread Reply - ${timestamp}]\n${parsedNote.salesProposal}`.trim()
    }

    await meetingRepository.update(existingMeeting.id, updateData)

    await slackRepository.markProcessed(savedMessage.id, {
      customerId: existingMeeting.customerId,
    })

    return {
      handled: true,
      channelType: "MEETING_NOTES",
      customerId: existingMeeting.customerId,
      meetingId: existingMeeting.id,
      isThreadReply: true,
      action: "appended_to_existing",
    }
  }

  // Fuzzy find customer by company name with confidence scoring
  private async findCustomerByNameWithConfidence(
    searchName: string,
  ): Promise<FuzzyMatchResult | null> {
    // Try 1: Exact match (confidence: 1.0)
    const exactMatch = await db
      .select()
      .from(customers)
      .where(sql`LOWER(${customers.name}) = LOWER(${searchName})`)
      .limit(1)

    if (exactMatch[0]) {
      return {
        customerId: exactMatch[0].id,
        customerName: exactMatch[0].name,
        matchType: "exact",
        confidence: 1.0,
      }
    }

    // Try 2: Partial match with confidence scoring
    const partialMatches = await db
      .select()
      .from(customers)
      .where(sql`LOWER(${customers.name}) LIKE LOWER(${`%${searchName}%`})`)
      .limit(10)

    if (partialMatches.length === 0) {
      return null
    }

    // Calculate confidence scores using string similarity
    const scoredMatches = partialMatches.map((customer) => ({
      customerId: customer.id,
      customerName: customer.name,
      confidence: this.calculateStringSimilarity(searchName, customer.name),
    }))

    // Sort by confidence descending
    scoredMatches.sort((a, b) => b.confidence - a.confidence)

    const bestMatch = scoredMatches[0]

    // Guard check (should not happen since we check partialMatches.length above)
    if (!bestMatch) {
      return null
    }

    // If confidence is too low, log a warning
    if (bestMatch.confidence < 0.5) {
      logger.warn(
        {
          searchTerm: searchName,
          bestMatch: bestMatch.customerName,
          confidence: bestMatch.confidence,
        },
        "Low confidence fuzzy match - may need manual review",
      )
    }

    // Collect high-confidence alternatives
    const highConfidenceMatches = scoredMatches.filter((m) => m.confidence > 0.7)

    return {
      customerId: bestMatch.customerId,
      customerName: bestMatch.customerName,
      matchType: "partial",
      confidence: bestMatch.confidence,
      alternativeMatches:
        highConfidenceMatches.length > 1 ? highConfidenceMatches.slice(1) : undefined,
    }
  }

  // String similarity using Dice coefficient
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()

    if (s1 === s2) return 1.0
    if (s1.length === 0 || s2.length === 0) return 0.0

    // Check if one contains the other
    if (s2.includes(s1)) return 0.9
    if (s1.includes(s2)) return 0.85

    // Bigram comparison for partial similarity
    const getBigrams = (s: string) => {
      const bigrams = new Set<string>()
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2))
      }
      return bigrams
    }

    const bigrams1 = getBigrams(s1)
    const bigrams2 = getBigrams(s2)

    let intersection = 0
    bigrams1.forEach((bg) => {
      if (bigrams2.has(bg)) intersection++
    })

    return (2 * intersection) / (bigrams1.size + bigrams2.size)
  }
}

export const slackEventService = new SlackEventService()
