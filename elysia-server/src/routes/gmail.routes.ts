import { Elysia, t } from "elysia"
import { emailRepository } from "../repositories"
import { gmailService } from "../services/gmail.service"
import { ErrorCode, error, success, successList } from "../utils/response"

// Get frontend URL from environment or default
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"

export const gmailRoutes = new Elysia({ prefix: "/api/gmail" })
  // Get Gmail status
  .get("/status", async () => {
    const status = await gmailService.getStatus()
    return success(status)
  })

  // Get OAuth URL
  .get("/oauth/url", ({ set }) => {
    try {
      const url = gmailService.getAuthUrl()
      return success({ url })
    } catch (_error) {
      set.status = 503
      return error("Gmail service not configured", ErrorCode.SERVICE_UNAVAILABLE)
    }
  })

  // OAuth callback - redirects to frontend
  .get(
    "/oauth/callback",
    async ({ query, set }) => {
      if (!query.code) {
        set.redirect = `${FRONTEND_URL}/settings?error=gmail_missing_code`
        return
      }

      try {
        await gmailService.handleCallback(query.code)
        set.redirect = `${FRONTEND_URL}/settings?gmail=connected`
        return
      } catch (_error) {
        set.redirect = `${FRONTEND_URL}/settings?error=gmail_auth_failed`
        return
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
        return success(result)
      } catch (err) {
        set.status = 500
        return error(err instanceof Error ? err.message : "Unknown error", ErrorCode.INTERNAL_ERROR)
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
      const limit = query.limit ? parseInt(query.limit, 10) : 100
      const emails = await emailRepository.findRecent(limit)
      return successList(emails)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get unmatched emails (not linked to customers)
  .get(
    "/emails/unmatched",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 50
      const emails = await emailRepository.findUnmatched(limit)
      return successList(emails)
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
      const emails = await emailRepository.findByCustomerId(params.customerId)
      return successList(emails)
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
        return error("Email not found", ErrorCode.EMAIL_NOT_FOUND)
      }
      return success(email)
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
        return error("Email not found", ErrorCode.EMAIL_NOT_FOUND)
      }
      return success(email)
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
        return success({ messageId })
      } catch (err) {
        set.status = 500
        return error(err instanceof Error ? err.message : "Unknown error", ErrorCode.INTERNAL_ERROR)
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
    return success({ disconnected: true })
  })
