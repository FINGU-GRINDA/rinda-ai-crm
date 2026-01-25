import { Elysia, t } from "elysia"
import { customerRepository, prospectRepository } from "../repositories"
import { ErrorCode, error, success, successList } from "../utils/response"

// Leads routes - alias for prospects (for frontend compatibility)
// The old backend maps /api/leads to prospect routes
export const leadsRoutes = new Elysia({ prefix: "/api/leads" })
  // Get all leads with filtering
  .get(
    "/",
    async ({ query }) => {
      const { signalStrength, industry, search, converted, limit, offset, orderBy, order } = query
      const result = await prospectRepository.findAll({
        signalStrength,
        industry,
        search,
        converted: converted === "true" ? true : converted === "false" ? false : undefined,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
        orderBy,
        order: order as "asc" | "desc" | undefined,
      })
      return successList(result.data, result.count)
    },
    {
      query: t.Object({
        signalStrength: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        search: t.Optional(t.String()),
        converted: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        orderBy: t.Optional(t.String()),
        order: t.Optional(t.String()),
      }),
    },
  )

  // Get lead stats
  .get("/stats", async () => {
    const stats = await prospectRepository.getStats()
    return success(stats)
  })

  // Bulk create leads
  .post(
    "/bulk",
    async ({ body, set }) => {
      const result = await prospectRepository.bulkCreate(body.prospects)
      set.status = 201
      return {
        success: true,
        data: result.created,
        count: result.created.length,
        skipped: result.skipped,
      }
    },
    {
      body: t.Object({
        prospects: t.Array(
          t.Object({
            companyName: t.String(),
            website: t.Optional(t.String()),
            industry: t.Optional(t.String()),
            sourceTitle: t.Optional(t.String()),
            sourceUri: t.Optional(t.String()),
            sourcePublishedAt: t.Optional(t.String()),
            signalStrength: t.Optional(
              t.Union([t.Literal("high"), t.Literal("medium"), t.Literal("low")]),
            ),
            icpMatch: t.Optional(t.String()),
            notes: t.Optional(t.String()),
            contactName: t.Optional(t.String()),
            contactTitle: t.Optional(t.String()),
            contactPhone: t.Optional(t.String()),
            contactEmail: t.Optional(t.String()),
            landingPageUrl: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )

  // Get lead by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const prospect = await prospectRepository.findById(params.id)
      if (!prospect) {
        set.status = 404
        return error("Lead not found", ErrorCode.PROSPECT_NOT_FOUND)
      }
      return success(prospect)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create lead
  .post(
    "/",
    async ({ body, set }) => {
      const prospect = await prospectRepository.create(body)
      set.status = 201
      return success(prospect)
    },
    {
      body: t.Object({
        companyName: t.String(),
        website: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        sourceTitle: t.Optional(t.String()),
        sourceUri: t.Optional(t.String()),
        sourcePublishedAt: t.Optional(t.String()),
        signalStrength: t.Optional(
          t.Union([t.Literal("high"), t.Literal("medium"), t.Literal("low")]),
        ),
        icpMatch: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        contactName: t.Optional(t.String()),
        contactTitle: t.Optional(t.String()),
        contactPhone: t.Optional(t.String()),
        contactEmail: t.Optional(t.String()),
        landingPageUrl: t.Optional(t.String()),
      }),
    },
  )

  // Update lead
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const prospect = await prospectRepository.update(params.id, body)
      if (!prospect) {
        set.status = 404
        return error("Lead not found", ErrorCode.PROSPECT_NOT_FOUND)
      }
      return success(prospect)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        companyName: t.Optional(t.String()),
        website: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        signalStrength: t.Optional(
          t.Union([t.Literal("high"), t.Literal("medium"), t.Literal("low")]),
        ),
        notes: t.Optional(t.String()),
        contactName: t.Optional(t.String()),
        contactTitle: t.Optional(t.String()),
        contactPhone: t.Optional(t.String()),
        contactEmail: t.Optional(t.String()),
        landingPageUrl: t.Optional(t.String()),
      }),
    },
  )

  // Delete lead
  .delete(
    "/:id",
    async ({ params }) => {
      await prospectRepository.delete(params.id)
      return success({ deleted: true })
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Convert lead to customer
  .post(
    "/:id/convert",
    async ({ params, body, set }) => {
      const prospect = await prospectRepository.findById(params.id)
      if (!prospect) {
        set.status = 404
        return error("Lead not found", ErrorCode.PROSPECT_NOT_FOUND)
      }

      // Create customer from lead
      const customer = await customerRepository.create({
        name: prospect.companyName,
        website: prospect.website,
        industry: prospect.industry,
        notes: prospect.notes,
        status: body.status || "new",
        leadSource: prospect.sourceArticle?.title || "Prospect",
        initialInquiry: prospect.notes,
        landingPageUrl: prospect.landingPageUrl,
      })

      // Create contact if prospect has contact info
      if (prospect.contactName || prospect.contactEmail || prospect.contactPhone) {
        const { contactRepository } = await import("../repositories")
        await contactRepository.create({
          customerId: customer.id,
          name: prospect.contactName || "",
          title: prospect.contactTitle,
          email: prospect.contactEmail,
          phone: prospect.contactPhone,
          isPrimary: 1,
          source: "manual",
        })
      }

      // Mark lead as converted
      await prospectRepository.markAsConverted(params.id, customer.id)

      return success({
        customer,
        prospect: await prospectRepository.findById(params.id),
      })
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Optional(
          t.Union([t.Literal("new"), t.Literal("contact"), t.Literal("negotiation")]),
        ),
      }),
    },
  )

  // Dismiss lead as "not qualified"
  .post(
    "/:id/dismiss",
    async ({ params, body, set }) => {
      if (!body.reason || body.reason.trim().length === 0) {
        set.status = 400
        return error("Dismiss reason is required", ErrorCode.INVALID_REQUEST)
      }

      const prospect = await prospectRepository.dismissProspect(params.id, body.reason.trim())
      if (!prospect) {
        set.status = 404
        return error("Lead not found", ErrorCode.PROSPECT_NOT_FOUND)
      }

      return success(prospect)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.String(),
      }),
    },
  )
