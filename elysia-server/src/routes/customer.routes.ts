import { Elysia, t } from "elysia"
import {
  contactRepository,
  customerRepository,
  followUpRepository,
  meetingRepository,
} from "../repositories"

export const customerRoutes = new Elysia({ prefix: "/api/customers" })
  // Get all customers
  .get("/", async () => {
    return customerRepository.findAll()
  })

  // Get customer stats
  .get("/stats", async () => {
    return customerRepository.getStats()
  })

  // Get customer by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const customer = await customerRepository.findById(params.id)
      if (!customer) {
        set.status = 404
        return { error: "Customer not found" }
      }
      return customer
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create customer
  .post(
    "/",
    async ({ body }) => {
      return customerRepository.create(body)
    },
    {
      body: t.Object({
        name: t.String(),
        website: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal("prospect"),
            t.Literal("new"),
            t.Literal("contact"),
            t.Literal("negotiation"),
            t.Literal("won"),
            t.Literal("lost"),
          ]),
        ),
      }),
    },
  )

  // Update customer
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const customer = await customerRepository.update(params.id, body)
      if (!customer) {
        set.status = 404
        return { error: "Customer not found" }
      }
      return customer
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        website: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal("prospect"),
            t.Literal("new"),
            t.Literal("contact"),
            t.Literal("negotiation"),
            t.Literal("won"),
            t.Literal("lost"),
          ]),
        ),
      }),
    },
  )

  // Delete customer
  .delete(
    "/:id",
    async ({ params }) => {
      await customerRepository.delete(params.id)
      return { success: true }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Mark as lost
  .post(
    "/:id/lost",
    async ({ params, body, set }) => {
      const customer = await customerRepository.markAsLost(params.id, body.reason)
      if (!customer) {
        set.status = 404
        return { error: "Customer not found" }
      }
      return customer
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ reason: t.String() }),
    },
  )

  // Get customer contacts
  .get(
    "/:id/contacts",
    async ({ params }) => {
      return contactRepository.findByCustomerId(params.id)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Add contact to customer
  .post(
    "/:id/contacts",
    async ({ params, body }) => {
      return contactRepository.create({
        ...body,
        customerId: params.id,
      })
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String(),
        title: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        isPrimary: t.Optional(t.Number()),
      }),
    },
  )

  // Get customer meetings
  .get(
    "/:id/meetings",
    async ({ params }) => {
      return meetingRepository.findByCustomerId(params.id)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Add meeting to customer
  .post(
    "/:id/meetings",
    async ({ params, body }) => {
      return meetingRepository.create({
        ...body,
        customerId: params.id,
      })
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.String(),
        meetingDate: t.Number(),
        audioFileUrl: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        summary: t.Optional(t.String()),
      }),
    },
  )

  // Get customer enrichment
  .get(
    "/:id/enrichment",
    async ({ params, set }) => {
      const enrichment = await customerRepository.getEnrichment(params.id)
      if (!enrichment) {
        set.status = 404
        return { error: "No enrichment data found" }
      }
      return enrichment
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Get customer proposals
  .get(
    "/:id/proposals",
    async ({ params }) => {
      return customerRepository.getProposals(params.id)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create proposal for customer
  .post(
    "/:id/proposals",
    async ({ params, body }) => {
      return customerRepository.createProposal(params.id, body)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.String(),
        content: t.String(),
        imageUrl: t.Optional(t.String()),
      }),
    },
  )

  // Get customer follow-up history
  .get(
    "/:id/followups",
    async ({ params }) => {
      return followUpRepository.findHistoryByCustomerId(params.id)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Get customer scheduled follow-ups
  .get(
    "/:id/scheduled",
    async ({ params }) => {
      return followUpRepository.findScheduledByCustomerId(params.id)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
