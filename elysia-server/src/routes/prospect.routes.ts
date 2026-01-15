import { Elysia, t } from "elysia"
import { customerRepository, prospectRepository } from "../repositories"

export const prospectRoutes = new Elysia({ prefix: "/api/prospects" })
  // Get all prospects
  .get("/", async () => {
    return prospectRepository.findAll()
  })

  // Get unconverted prospects
  .get("/unconverted", async () => {
    return prospectRepository.findUnconverted()
  })

  // Get recent prospects
  .get(
    "/recent",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 10
      return prospectRepository.getRecent(limit)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Get prospect by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      const prospect = await prospectRepository.findById(params.id)
      if (!prospect) {
        set.status = 404
        return { error: "Prospect not found" }
      }
      return prospect
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create prospect
  .post(
    "/",
    async ({ body }) => {
      return prospectRepository.create(body)
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
      }),
    },
  )

  // Update prospect
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const prospect = await prospectRepository.update(params.id, body)
      if (!prospect) {
        set.status = 404
        return { error: "Prospect not found" }
      }
      return prospect
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
      }),
    },
  )

  // Delete prospect
  .delete(
    "/:id",
    async ({ params }) => {
      await prospectRepository.delete(params.id)
      return { success: true }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Convert prospect to customer
  .post(
    "/:id/convert",
    async ({ params, body, set }) => {
      const prospect = await prospectRepository.findById(params.id)
      if (!prospect) {
        set.status = 404
        return { error: "Prospect not found" }
      }

      // Create customer from prospect
      const customer = await customerRepository.create({
        name: prospect.companyName,
        website: prospect.website,
        industry: prospect.industry,
        notes: prospect.notes,
        status: body.status || "new",
      })

      // Mark prospect as converted
      await prospectRepository.markAsConverted(params.id, customer.id)

      return { customer, prospect: await prospectRepository.findById(params.id) }
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

  // Search prospects
  .get(
    "/search/:query",
    async ({ params }) => {
      return prospectRepository.search(params.query)
    },
    {
      params: t.Object({ query: t.String() }),
    },
  )
