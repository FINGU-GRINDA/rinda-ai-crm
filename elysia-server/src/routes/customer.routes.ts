import { Elysia, t } from "elysia"
import {
  contactRepository,
  customerRepository,
  followUpRepository,
  meetingRepository,
} from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

export const customerRoutes = new Elysia({ prefix: "/api/customers" })
  // Get all customers with optional filtering
  .get(
    "/",
    async ({ query }) => {
      const { status, industry, search, limit, offset, orderBy, order } = query
      const result = await customerRepository.findAll({
        status,
        industry,
        search,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
        orderBy,
        order: order as "asc" | "desc" | undefined,
      })
      return successList(result.data, result.count)
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        search: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        orderBy: t.Optional(t.String()),
        order: t.Optional(t.String()),
      }),
    },
  )

  // Get customer stats
  .get("/stats", async () => {
    const stats = await customerRepository.getStats()
    return success(stats)
  })

  // Get customer by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const customer = await customerRepository.findById(params.id)
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }
      return success(customer)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create customer
  .post(
    "/",
    async ({ body, set }) => {
      const customer = await customerRepository.create(body)
      set.status = 201
      return success(customer)
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
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }
      return success(customer)
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
      return success({ deleted: true })
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
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }
      return success(customer)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ reason: t.String() }),
    },
  )

  // Update customer status
  .put(
    "/:id/status",
    async ({ params, body, set }) => {
      // If status is 'lost', use markAsLost for proper handling
      if (body.status === "lost") {
        const customer = await customerRepository.markAsLost(params.id, body.lostReason || "")
        if (!customer) {
          set.status = 404
          return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
        }
        return success(customer)
      }

      // For other statuses, use regular update
      const customer = await customerRepository.update(params.id, { status: body.status })
      if (!customer) {
        set.status = 404
        return error("Customer not found", ErrorCode.CUSTOMER_NOT_FOUND)
      }
      return success(customer)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([
          t.Literal("prospect"),
          t.Literal("new"),
          t.Literal("contact"),
          t.Literal("negotiation"),
          t.Literal("won"),
          t.Literal("lost"),
        ]),
        lostReason: t.Optional(t.String()),
      }),
    },
  )

  // Get customer contacts
  .get(
    "/:id/contacts",
    async ({ params }) => {
      const contacts = await contactRepository.findByCustomerId(params.id)
      return successList(contacts)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Add contact to customer
  .post(
    "/:id/contacts",
    async ({ params, body, set }) => {
      const contact = await contactRepository.create({
        ...body,
        customerId: params.id,
      })
      set.status = 201
      return success(contact)
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
      const meetings = await meetingRepository.findByCustomerId(params.id)
      return successList(meetings)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Add meeting to customer
  .post(
    "/:id/meetings",
    async ({ params, body, set }) => {
      const meeting = await meetingRepository.create({
        ...body,
        customerId: params.id,
      })
      set.status = 201
      return success(meeting)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.String(),
        meetingDate: t.Date(),
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
        return error("No enrichment data found", ErrorCode.NOT_FOUND)
      }
      return success(enrichment)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Get customer proposals
  .get(
    "/:id/proposals",
    async ({ params }) => {
      const proposals = await customerRepository.getProposals(params.id)
      return successList(proposals)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create proposal for customer
  .post(
    "/:id/proposals",
    async ({ params, body, set }) => {
      const proposal = await customerRepository.createProposal(params.id, body)
      set.status = 201
      return success(proposal)
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

  // Get customer follow-ups (combined history + scheduled for compatibility)
  .get(
    "/:id/followups",
    async ({ params }) => {
      const [history, scheduled] = await Promise.all([
        followUpRepository.findHistoryByCustomerId(params.id),
        followUpRepository.findScheduledByCustomerId(params.id),
      ])
      return success({ history, scheduled })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Get customer scheduled follow-ups
  .get(
    "/:id/scheduled",
    async ({ params }) => {
      const scheduled = await followUpRepository.findScheduledByCustomerId(params.id)
      return successList(scheduled)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
