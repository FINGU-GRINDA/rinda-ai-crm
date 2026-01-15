import { Elysia, t } from "elysia"
import { customerRepository, meetingRepository } from "../repositories"
import { geminiService } from "../services/gemini.service"

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  // Check AI status
  .get("/status", () => {
    return {
      available: geminiService.isAvailable(),
      model: "gemini-2.0-flash",
    }
  })

  // Generate content
  .post(
    "/generate",
    async ({ body, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return { error: "AI service not available" }
      }

      const result = await geminiService.generateContent(body.prompt)
      if (!result) {
        set.status = 500
        return { error: "Failed to generate content" }
      }

      return { content: result }
    },
    {
      body: t.Object({
        prompt: t.String(),
      }),
    },
  )

  // Enrich customer data
  .post(
    "/enrich/:customerId",
    async ({ params, set }) => {
      if (!geminiService.isAvailable()) {
        set.status = 503
        return { error: "AI service not available" }
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return { error: "Customer not found" }
      }

      const enrichment = await geminiService.enrichCompany(
        customer.name,
        customer.website || undefined,
      )

      if (!enrichment) {
        set.status = 500
        return { error: "Failed to enrich customer data" }
      }

      // Save enrichment
      const saved = await customerRepository.saveEnrichment(params.customerId, {
        summary: enrichment.summary,
        ceo: enrichment.ceo || undefined,
        foundedYear: enrichment.foundedYear || undefined,
        recentNews: enrichment.recentNews || undefined,
        competitors: JSON.stringify(enrichment.competitors),
        salesOpportunity: enrichment.salesOpportunity,
      })

      return saved
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
        return { error: "AI service not available" }
      }

      const customer = await customerRepository.findById(params.customerId)
      if (!customer) {
        set.status = 404
        return { error: "Customer not found" }
      }

      const proposal = await geminiService.generateProposal(
        customer.name,
        body.customerNeeds,
        customer.industry || undefined,
      )

      if (!proposal) {
        set.status = 500
        return { error: "Failed to generate proposal" }
      }

      // Save proposal
      const saved = await customerRepository.createProposal(params.customerId, {
        title: proposal.title,
        content: proposal.content,
      })

      return saved
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
        return { error: "AI service not available" }
      }

      const meeting = await meetingRepository.findById(params.meetingId)
      if (!meeting) {
        set.status = 404
        return { error: "Meeting not found" }
      }

      if (!meeting.transcription) {
        set.status = 400
        return { error: "Meeting has no transcription" }
      }

      const summary = await geminiService.summarizeMeeting(meeting.transcription)

      if (!summary) {
        set.status = 500
        return { error: "Failed to summarize meeting" }
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

      return updated
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
        return { error: "AI service not available" }
      }

      const result = await geminiService.parseCustomerInquiry(body.text)
      return result
    },
    {
      body: t.Object({
        text: t.String(),
      }),
    },
  )
