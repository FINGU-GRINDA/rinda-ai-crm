import { Elysia, t } from "elysia"
import { emailRepository } from "../repositories"
import { gmailService } from "../services/gmail.service"

export const gmailRoutes = new Elysia({ prefix: "/api/gmail" })
  // Get Gmail status
  .get("/status", async () => {
    return gmailService.getStatus()
  })

  // Get OAuth URL
  .get("/oauth/url", ({ set }) => {
    try {
      const url = gmailService.getAuthUrl()
      return { url }
    } catch (_error) {
      set.status = 503
      return { error: "Gmail service not configured" }
    }
  })

  // OAuth callback
  .get(
    "/oauth/callback",
    async ({ query, set }) => {
      if (!query.code) {
        set.status = 400
        return { error: "Missing authorization code" }
      }

      try {
        await gmailService.handleCallback(query.code)
        return { success: true, message: "Gmail connected successfully" }
      } catch (_error) {
        set.status = 500
        return { error: "OAuth callback failed" }
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
      }),
    },
  )

  // Sync emails
  .post(
    "/sync",
    async ({ query, set }) => {
      try {
        const maxResults = query.maxResults ? parseInt(query.maxResults, 10) : 50
        const result = await gmailService.syncEmails(maxResults)
        return result
      } catch (error) {
        set.status = 500
        return { error: error instanceof Error ? error.message : "Unknown error" }
      }
    },
    {
      query: t.Object({
        maxResults: t.Optional(t.String()),
      }),
    },
  )

  // Get synced emails
  .get(
    "/emails",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      return emailRepository.findRecent(limit)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get emails by customer
  .get(
    "/emails/customer/:customerId",
    async ({ params }) => {
      return emailRepository.findByCustomerId(params.customerId)
    },
    {
      params: t.Object({ customerId: t.String() }),
    },
  )

  // Get email by ID
  .get(
    "/emails/:id",
    async ({ params, set }) => {
      const email = await emailRepository.findById(params.id)
      if (!email) {
        set.status = 404
        return { error: "Email not found" }
      }
      return email
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Link email to customer
  .post(
    "/emails/:id/link",
    async ({ params, body, set }) => {
      const email = await emailRepository.linkToCustomer(params.id, body.customerId)
      if (!email) {
        set.status = 404
        return { error: "Email not found" }
      }
      return email
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        customerId: t.String(),
      }),
    },
  )

  // Send email
  .post(
    "/send",
    async ({ body, set }) => {
      try {
        const messageId = await gmailService.sendEmail(body.to, body.subject, body.body)
        return { success: true, messageId }
      } catch (error) {
        set.status = 500
        return { error: error instanceof Error ? error.message : "Unknown error" }
      }
    },
    {
      body: t.Object({
        to: t.String(),
        subject: t.String(),
        body: t.String(),
      }),
    },
  )

  // Disconnect Gmail
  .post("/disconnect", async () => {
    await gmailService.disconnect()
    return { success: true }
  })
