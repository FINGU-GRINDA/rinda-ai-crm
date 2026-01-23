import { Elysia, t } from "elysia"
import { customerRepository, meetingRepository } from "../repositories"
import { geminiService } from "../services/gemini.service"
import { ErrorCode, error, success } from "../utils/response"

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  // Check AI status
  .get("/status", () => {
    return success({
      available: geminiService.isAvailable(),
      serverKeyConfigured: geminiService.isAvailable(),
      model: "gemini-2.0-flash",
    })
  })

  // Generate content
  .post(
    "/generate",
    async ({ body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const result = await geminiService.generateContent(body.prompt)
      if (!result) {
        set.status = 500
        return error("Failed to generate content", ErrorCode.INTERNAL_ERROR)
      }

      return success({ content: result })
    },
    {
      body: t.Object({
        prompt: t.String(),
      }),
    },
  )

  // Enrich customer data AND generate follow-up strategy
  .post(
    "/enrich/:customerId",
    async ({ params, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      // Step 1: Generate company enrichment
      const enrichment = await geminiService.enrichCompany(
        customer.name,
        customer.website || undefined,
      )

      if (!enrichment) {
        set.status = 500
        return error("Failed to enrich customer data", ErrorCode.INTERNAL_ERROR)
      }

      // Step 2: Generate follow-up strategy using enrichment data
      const isLostDeal = customer.status === "lost"
      const strategy = await geminiService.generateFollowUpStrategy(
        {
          name: customer.name,
          industry: customer.industry || undefined,
          status: customer.status || "new",
          notes: customer.notes || undefined,
        },
        {
          summary: enrichment.summary,
          salesOpportunity: enrichment.salesOpportunity,
          recentNews: enrichment.recentNews ? [enrichment.recentNews] : undefined,
        },
        isLostDeal,
      )

      // Step 3: Save both enrichment and strategy together
      const saved = await customerRepository.saveEnrichment(params.customerId, {
        summary: enrichment.summary,
        ceo: enrichment.ceo || undefined,
        foundedYear: enrichment.foundedYear || undefined,
        recentNews: enrichment.recentNews || undefined,
        competitors: JSON.stringify(enrichment.competitors),
        salesOpportunity: enrichment.salesOpportunity,
        // Follow-up strategy fields
        followUpRecommendedTiming: strategy?.recommendedTiming,
        followUpApproach: strategy?.approach,
        followUpMessageTone: strategy?.messageTone,
        followUpKeyPoints: strategy ? JSON.stringify(strategy.keyPoints) : undefined,
        followUpProbability: strategy?.probability,
        followUpReasoning: strategy?.reasoning,
      })

      // Return combined response
      return success({
        enrichment: saved,
        followUpStrategy: strategy,
      })
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )

  // Generate proposal
  .post(
    "/proposal/:customerId",
    async ({ params, body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      const proposal = await geminiService.generateProposal(
        customer.name,
        body.customerNeeds,
        customer.industry || undefined,
      )

      if (!proposal) {
        set.status = 500
        return error("Failed to generate proposal", ErrorCode.INTERNAL_ERROR)
      }

      // Save proposal
      const saved = await customerRepository.createProposal(params.customerId, {
        title: proposal.title,
        content: proposal.content,
      })

      return success(saved)
    },
    {
      params: t.Object({ customerId: t.String() }),
      body: t.Object({
        customerNeeds: t.Array(t.String()),
      }),
    },
  )

  // Summarize meeting
  .post(
    "/meeting/:meetingId/summarize",
    async ({ params, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const meeting = await meetingRepository.findById(params.meetingId)
      if (!meeting) {
        set.status = 404
        return error("Meeting not found", ErrorCode.MEETING_NOT_FOUND)
      }

      if (!meeting.transcription) {
        set.status = 400
        return error("Meeting has no transcription", ErrorCode.MISSING_AUDIO_OR_TRANSCRIPTION)
      }

      const summary = await geminiService.summarizeMeeting(meeting.transcription)

      if (!summary) {
        await meetingRepository.updateSummary(params.meetingId, {
          summary: meeting.transcription,
        })
        set.status = 500
        return error("Failed to summarize meeting", ErrorCode.INTERNAL_ERROR)
      }

      // Update meeting with summary
      const updated = await meetingRepository.updateSummary(params.meetingId, {
        summary: summary.summary,
        keyDiscussions: JSON.stringify(summary.keyDiscussions),
        actionItems: JSON.stringify(summary.actionItems),
        customerNeeds: JSON.stringify(summary.customerNeeds),
        budgetMentions: summary.budgetMentions || undefined,
        timelineMentions: summary.timelineMentions || undefined,
        nextSteps: JSON.stringify(summary.nextSteps),
      })

      return success(updated)
    },
    {
      params: t.Object({ meetingId: t.String() }),
    },
  )

  // Parse customer inquiry
  .post(
    "/parse-inquiry",
    async ({ body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const result = await geminiService.parseCustomerInquiry(body.text)
      return success(result)
    },
    {
      body: t.Object({
        text: t.String(),
      }),
    },
  )

  // Follow-up strategy generation
  .post(
    "/followup/strategy/:customerId",
    async ({ params, body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      const isLostDeal = body?.isLostDeal || false
      const enrichedData = await customerRepository.getEnrichment(params.customerId)

      const strategy = await geminiService.generateFollowUpStrategy(
        {
          name: customer.name,
          industry: customer.industry || undefined,
          status: customer.status || "new",
          notes: customer.notes || undefined,
        },
        enrichedData?.summary
          ? {
              summary: enrichedData.summary,
              salesOpportunity: enrichedData.salesOpportunity || undefined,
              recentNews: enrichedData.recentNews ? JSON.parse(enrichedData.recentNews) : undefined,
            }
          : undefined,
        isLostDeal,
      )

      if (!strategy) {
        set.status = 500
        return error("Failed to generate follow-up strategy", ErrorCode.INTERNAL_ERROR)
      }

      return success(strategy)
    },
    {
      params: t.Object({ customerId: t.String() }),
      body: t.Optional(t.Object({ isLostDeal: t.Optional(t.Boolean()) })),
    },
  )

  // Follow-up message generation
  .post(
    "/followup/message/:customerId",
    async ({ params, body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      const isLostDeal = body?.isLostDeal || false
      const enrichedData = await customerRepository.getEnrichment(params.customerId)

      const message = await geminiService.generateFollowUpMessage(
        {
          name: customer.name,
          industry: customer.industry || undefined,
          status: customer.status || "new",
          lostReason: customer.lostReason || undefined,
        },
        body.strategy,
        enrichedData?.summary
          ? {
              summary: enrichedData.summary,
              salesOpportunity: enrichedData.salesOpportunity || undefined,
            }
          : undefined,
        isLostDeal,
      )

      if (!message) {
        set.status = 500
        return error("Failed to generate follow-up message", ErrorCode.INTERNAL_ERROR)
      }

      return success(message)
    },
    {
      params: t.Object({ customerId: t.String() }),
      body: t.Object({
        strategy: t.Object({
          approach: t.String(),
          messageTone: t.String(),
          keyPoints: t.Array(t.String()),
        }),
        isLostDeal: t.Optional(t.Boolean()),
      }),
    },
  )

  // Calculate optimal follow-up timing
  .post(
    "/followup/timing/:customerId",
    async ({ params, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      const now = new Date()
      const lastContactTime = customer.lastFollowUpAt || customer.createdAt || now
      const daysSinceLastContact = Math.floor(
        (now.getTime() - new Date(lastContactTime).getTime()) / (1000 * 60 * 60 * 24),
      )

      const timing = await geminiService.calculateOptimalFollowUpTiming(
        {
          name: customer.name,
          industry: customer.industry || undefined,
          status: customer.status || "new",
          notes: customer.notes || undefined,
        },
        daysSinceLastContact,
        undefined,
      )

      if (!timing) {
        set.status = 500
        return error("Failed to calculate follow-up timing", ErrorCode.INTERNAL_ERROR)
      }

      return success(timing)
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )

  // Determine follow-up type (channel)
  .post(
    "/followup/type/:customerId",
    async ({ params, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      const type = await geminiService.determineFollowUpType({
        name: customer.name,
        status: customer.status || "new",
        notes: customer.notes || undefined,
      })

      if (!type) {
        set.status = 500
        return error("Failed to determine follow-up type", ErrorCode.INTERNAL_ERROR)
      }

      return success({ type })
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )

  // Parse user intent for AI assistant
  .post(
    "/assistant/parse-intent",
    async ({ body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const intent = await geminiService.parseUserIntent(body.message, body.customers)

      if (!intent) {
        set.status = 500
        return error("Failed to parse intent", ErrorCode.INTERNAL_ERROR)
      }

      return success(intent)
    },
    {
      body: t.Object({
        message: t.String(),
        customers: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
          }),
        ),
      }),
    },
  )

  // Generate AI assistant response
  .post(
    "/assistant/response",
    async ({ body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const response = await geminiService.generateAssistantResponse(
        body.message,
        body.context || "",
        body.conversationHistory || [],
      )

      if (!response) {
        set.status = 500
        return error("Failed to generate response", ErrorCode.INTERNAL_ERROR)
      }

      return success({ content: response })
    },
    {
      body: t.Object({
        message: t.String(),
        context: t.Optional(t.String()),
        conversationHistory: t.Optional(
          t.Array(
            t.Object({
              role: t.String(),
              content: t.String(),
            }),
          ),
        ),
      }),
    },
  )

  // Detect risk signals
  .post(
    "/risk/detect/:customerId",
    async ({ params, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return error("AI service not available", ErrorCode.SERVICE_UNAVAILABLE)
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }

      const now = new Date()
      const lastContactTime = customer.lastFollowUpAt || customer.createdAt || now
      const daysSinceLastContact = Math.floor(
        (now.getTime() - new Date(lastContactTime).getTime()) / (1000 * 60 * 60 * 24),
      )

      const riskSignals = await geminiService.detectRiskSignals(
        {
          name: customer.name,
          industry: customer.industry || undefined,
          status: (customer.status as string) || "prospect",
          notes: customer.notes || undefined,
        },
        daysSinceLastContact,
        undefined,
      )

      if (!riskSignals) {
        set.status = 500
        return error("Failed to detect risk signals", ErrorCode.INTERNAL_ERROR)
      }

      return success(riskSignals)
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )
