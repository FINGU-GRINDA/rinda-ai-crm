import { Elysia, t } from "elysia"
import { customerRepository, prospectRepository, slackRepository } from "../repositories"
import { geminiService } from "../services/gemini.service"
import { logger } from "../utils/logger"
import { ErrorCode, error, success, successList } from "../utils/response"

// Discovery collection status (in-memory; survives within process lifetime).
// Used by the "발굴 고객" tab to coordinate manual + scheduled runs.
interface CollectionStatus {
  isRunning: boolean
  startedAt: number | null
  finishedAt: number | null
  lastRunDurationMs: number | null
  lastSummary: string | null
  lastCreated: number
  lastSkipped: number
  lastError: string | null
}

const collectionStatus: CollectionStatus = {
  isRunning: false,
  startedAt: null,
  finishedAt: null,
  lastRunDurationMs: null,
  lastSummary: null,
  lastCreated: 0,
  lastSkipped: 0,
  lastError: null,
}

export const prospectRoutes = new Elysia({ prefix: "/api/prospects" })
  // Get all prospects with filtering
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

  // Get prospect stats
  .get("/stats", async () => {
    const stats = await prospectRepository.getStats()
    return success(stats)
  })

  // Get unconverted prospects
  .get("/unconverted", async () => {
    const prospects = await prospectRepository.findUnconverted()
    return successList(prospects)
  })

  // Get recent prospects
  .get(
    "/recent",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 10
      const prospects = await prospectRepository.getRecent(limit)
      return successList(prospects)
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )

  // Bulk create prospects
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

  // Get collection status
  .get("/status", () => {
    return success({ ...collectionStatus })
  })

  // Run prospect discovery collection (AI-driven, ICP-based)
  .post(
    "/collect",
    async ({ body, set }) => {
      if (collectionStatus.isRunning) {
        set.status = 409
        return error("이미 수집이 진행 중입니다.", ErrorCode.COLLECTION_RUNNING)
      }

      const icpProfiles = body.icpProfiles ?? []
      if (icpProfiles.length === 0) {
        set.status = 400
        return error(
          "ICP 프로필이 비어있습니다. ICP 프로필을 먼저 추가하세요.",
          ErrorCode.MISSING_ICP_PROFILES,
        )
      }

      if (!geminiService.isAvailable()) {
        set.status = 503
        return error(
          "Gemini API 키가 설정되지 않아 잠재 고객 발굴을 실행할 수 없습니다. (GEMINI_API_KEY)",
          ErrorCode.SERVICE_UNAVAILABLE,
        )
      }

      collectionStatus.isRunning = true
      collectionStatus.startedAt = Date.now()
      collectionStatus.finishedAt = null
      collectionStatus.lastError = null

      try {
        // Build full exclusion list = client-supplied + DB-known prospects.
        const supplied = (body.existingCompanyNames ?? []).filter(
          (n): n is string => typeof n === "string" && n.trim().length > 0,
        )
        const recent = await prospectRepository.getRecent(500)
        const recentNames = recent.map((r) => r.companyName).filter(Boolean)
        const existingCompanyNames = Array.from(
          new Set([...supplied, ...recentNames].map((n) => n.trim())),
        )

        const discovery = await geminiService.discoverExportProspects(
          icpProfiles,
          existingCompanyNames,
          body.desiredCount ?? 10,
        )

        if (!discovery) {
          throw new Error("AI 발굴 결과를 받지 못했습니다. 잠시 후 다시 시도해주세요.")
        }

        const validProfileIds = new Set(icpProfiles.map((p) => p.id))
        const detectedAtIso = new Date().toISOString()

        const bulkPayload = discovery.prospects.map((p) => ({
          companyName: p.companyName,
          website: p.website || undefined,
          industry: p.industry || undefined,
          sourceTitle: p.sourceTitle || undefined,
          sourceUri: p.sourceUri || undefined,
          sourcePublishedAt: detectedAtIso,
          signalStrength: p.signalStrength,
          icpMatch: p.icpMatchId && validProfileIds.has(p.icpMatchId) ? p.icpMatchId : undefined,
          notes: p.notes || undefined,
        }))

        const result = await prospectRepository.bulkCreate(bulkPayload)

        collectionStatus.lastSummary = discovery.summary
        collectionStatus.lastCreated = result.created.length
        collectionStatus.lastSkipped = result.skipped
        collectionStatus.lastError = null

        logger.info(
          {
            created: result.created.length,
            skipped: result.skipped,
            totalAnalyzed: discovery.prospects.length,
          },
          "Prospect discovery collection completed",
        )

        return success({
          newProspects: result.created,
          totalArticles: discovery.prospects.length,
          skipped: result.skipped,
          summary: discovery.summary,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        collectionStatus.lastError = message
        logger.error({ error: message }, "Prospect collection failed")
        set.status = 500
        return error(message, ErrorCode.INTERNAL_ERROR)
      } finally {
        collectionStatus.isRunning = false
        collectionStatus.finishedAt = Date.now()
        if (collectionStatus.startedAt) {
          collectionStatus.lastRunDurationMs =
            collectionStatus.finishedAt - collectionStatus.startedAt
        }
      }
    },
    {
      body: t.Object({
        icpProfiles: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            industries: t.Optional(t.Array(t.String())),
            keywords: t.Optional(t.Array(t.String())),
            companySize: t.Optional(t.String()),
            targetRegions: t.Optional(t.Array(t.String())),
          }),
        ),
        existingCompanyNames: t.Optional(t.Array(t.String())),
        desiredCount: t.Optional(t.Number()),
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
        return error("Prospect not found", ErrorCode.PROSPECT_NOT_FOUND)
      }
      return success(prospect)
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Create prospect
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

  // Update prospect
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const prospect = await prospectRepository.update(params.id, body)
      if (!prospect) {
        set.status = 404
        return error("Prospect not found", ErrorCode.PROSPECT_NOT_FOUND)
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

  // Delete prospect
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

  // Convert prospect to customer
  .post(
    "/:id/convert",
    async ({ params, body, set }) => {
      const prospect = await prospectRepository.findById(params.id)
      if (!prospect) {
        set.status = 404
        return error("Prospect not found", ErrorCode.PROSPECT_NOT_FOUND)
      }

      // Create customer from prospect
      // Use the parsed lead source from prospect, fallback to "Slack CS Channel"
      const customer = await customerRepository.create({
        name: prospect.companyName,
        website: prospect.website,
        industry: prospect.industry,
        notes: prospect.notes,
        status: body.status || "new",
        leadSource: prospect.sourceArticle?.title || "Slack CS Channel",
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

      // Mark prospect as converted
      await prospectRepository.markAsConverted(params.id, customer.id)

      // Update Slack messages linked to this prospect with the new customer ID
      await slackRepository.updateCustomerIdByProspect(params.id, customer.id)

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

  // Search prospects
  .get(
    "/search/:query",
    async ({ params }) => {
      const prospects = await prospectRepository.search(params.query)
      return successList(prospects)
    },
    {
      params: t.Object({ query: t.String() }),
    },
  )
