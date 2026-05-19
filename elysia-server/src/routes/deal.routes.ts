import { Elysia, t } from "elysia"
import { ROLE_WRITE, requireRole, workspaceMiddleware } from "../middleware/workspace"
import { dealRepository } from "../repositories/deal.repository"
import { pipelineRepository } from "../repositories/pipeline.repository"
import { workspaceRepository } from "../repositories/workspace.repository"
import { parseAmountToMinor } from "../utils/currency"
import { ErrorCode, error, success, successList } from "../utils/response"

const FORECAST_CATEGORIES = ["pipeline", "best_case", "commit", "closed", "omitted"] as const
const ORDER_BY = ["created", "updated", "expected_close", "amount", "stage_entered"] as const

function parseIntOrUndef(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

export const dealRoutes = new Elysia({ prefix: "/api/deals" })
  .use(workspaceMiddleware)

  // List deals (Kanban + table both consume this)
  .get(
    "/",
    async ({ query, workspace }) => {
      const result = await dealRepository.list(workspace.workspaceId, {
        pipelineId: query.pipelineId,
        stageId: query.stageId,
        ownerId: query.ownerId,
        customerId: query.customerId,
        forecastCategory: query.forecastCategory,
        search: query.search,
        includeClosed: query.includeClosed === "true",
        limit: parseIntOrUndef(query.limit) ?? 200,
        offset: parseIntOrUndef(query.offset) ?? 0,
        orderBy: query.orderBy,
        order: query.order === "asc" ? "asc" : "desc",
      })
      return successList(result.data, result.count)
    },
    {
      query: t.Object({
        pipelineId: t.Optional(t.String()),
        stageId: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        customerId: t.Optional(t.String()),
        forecastCategory: t.Optional(t.Union(FORECAST_CATEGORIES.map((v) => t.Literal(v)))),
        search: t.Optional(t.String()),
        includeClosed: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        orderBy: t.Optional(t.Union(ORDER_BY.map((v) => t.Literal(v)))),
        order: t.Optional(t.String()),
      }),
    },
  )

  // Get a single deal with stage history
  .get(
    "/:id",
    async ({ params, workspace, set }) => {
      const deal = await dealRepository.findById(workspace.workspaceId, params.id)
      if (!deal) {
        set.status = 404
        return error("Deal not found", ErrorCode.DEAL_NOT_FOUND)
      }
      const history = await dealRepository.stageHistory(workspace.workspaceId, params.id)
      return success({ ...deal, stageHistory: history })
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Create a deal
  .post(
    "/",
    async ({ workspace, auth, body, set }) => {
      requireRole(workspace, ROLE_WRITE)

      const pipeline = await pipelineRepository.findById(workspace.workspaceId, body.pipelineId)
      if (!pipeline) {
        set.status = 404
        return error("Pipeline not found", ErrorCode.PIPELINE_NOT_FOUND)
      }

      const targetStage = pipeline.stages.find((s) => s.id === body.stageId)
      if (!targetStage) {
        set.status = 404
        return error("Stage not found in pipeline", ErrorCode.STAGE_NOT_FOUND)
      }

      const humanId = await workspaceRepository.nextDealHumanId(workspace.workspaceId)
      const currency = (body.currency ?? workspace.baseCurrency).toUpperCase()
      let amountMinor: bigint
      try {
        // Accept either pre-computed minor units or a human "amount" string
        if (body.amountMinor !== undefined) {
          amountMinor = BigInt(body.amountMinor)
          if (amountMinor < 0n) throw new Error("amountMinor must be non-negative")
        } else if (body.amount !== undefined) {
          amountMinor = parseAmountToMinor(body.amount, currency)
          if (amountMinor < 0n) throw new Error("amount must be non-negative")
        } else {
          amountMinor = 0n
        }
      } catch (err) {
        set.status = 400
        return error(
          err instanceof Error ? err.message : "Invalid amount",
          ErrorCode.INVALID_REQUEST,
        )
      }
      // Phase 0 stores base amount as-is; Phase 2 will multiply by live FX rate
      const baseAmountMinor = amountMinor

      const created = await dealRepository.create({
        workspaceId: workspace.workspaceId,
        pipelineId: body.pipelineId,
        stageId: body.stageId,
        customerId: body.customerId ?? null,
        ownerId: body.ownerId ?? auth.userId,
        humanId,
        title: body.title,
        description: body.description,
        amountMinor,
        currency,
        baseAmountMinor,
        probability: body.probability ?? null,
        forecastCategory: body.forecastCategory ?? "pipeline",
        expectedCloseDate: body.expectedCloseDate ?? null,
        source: body.source,
        externalId: body.externalId,
        customFields: body.customFields ?? {},
      })

      set.status = 201
      return success(created)
    },
    {
      body: t.Object({
        pipelineId: t.String(),
        stageId: t.String(),
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 5000 })),
        customerId: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        // Either provide pre-computed minor units OR a human "amount" string;
        // server resolves to the canonical minor value based on currency.
        amountMinor: t.Optional(t.String()),
        amount: t.Optional(t.String({ maxLength: 32 })),
        currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        probability: t.Optional(t.String()),
        forecastCategory: t.Optional(t.Union(FORECAST_CATEGORIES.map((v) => t.Literal(v)))),
        expectedCloseDate: t.Optional(t.String()),
        source: t.Optional(t.String({ maxLength: 60 })),
        externalId: t.Optional(t.String({ maxLength: 120 })),
        customFields: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )

  // Patch a deal's fields (not stage — use the /move endpoint for that)
  .patch(
    "/:id",
    async ({ workspace, params, body, set }) => {
      requireRole(workspace, ROLE_WRITE)

      let amountMinor: bigint | undefined
      try {
        if (body.amountMinor !== undefined) {
          amountMinor = BigInt(body.amountMinor)
          if (amountMinor < 0n) throw new Error("amountMinor must be non-negative")
        } else if (body.amount !== undefined) {
          const existing = await dealRepository.findById(workspace.workspaceId, params.id)
          const cur = (body.currency ?? existing?.currency ?? workspace.baseCurrency).toUpperCase()
          amountMinor = parseAmountToMinor(body.amount, cur)
          if (amountMinor < 0n) throw new Error("amount must be non-negative")
        }
      } catch (err) {
        set.status = 400
        return error(
          err instanceof Error ? err.message : "Invalid amount",
          ErrorCode.INVALID_REQUEST,
        )
      }

      const updated = await dealRepository.update(workspace.workspaceId, params.id, {
        title: body.title,
        description: body.description,
        customerId: body.customerId,
        ownerId: body.ownerId,
        amountMinor,
        currency: body.currency?.toUpperCase(),
        probability: body.probability,
        forecastCategory: body.forecastCategory,
        expectedCloseDate: body.expectedCloseDate,
        source: body.source,
        customFields: body.customFields,
      })
      if (!updated) {
        set.status = 404
        return error("Deal not found", ErrorCode.DEAL_NOT_FOUND)
      }
      return success(updated)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(t.String({ maxLength: 5000 })),
        customerId: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        amountMinor: t.Optional(t.String()),
        amount: t.Optional(t.String({ maxLength: 32 })),
        currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        probability: t.Optional(t.String()),
        forecastCategory: t.Optional(t.Union(FORECAST_CATEGORIES.map((v) => t.Literal(v)))),
        expectedCloseDate: t.Optional(t.String()),
        source: t.Optional(t.String({ maxLength: 60 })),
        customFields: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )

  // Move a deal to a new stage (records stage history with duration)
  .post(
    "/:id/move",
    async ({ workspace, auth, params, body, set }) => {
      requireRole(workspace, ROLE_WRITE)
      const updated = await dealRepository.moveStage(
        workspace.workspaceId,
        params.id,
        body.stageId,
        auth.userId,
        body.note,
      )
      if (!updated) {
        set.status = 404
        return error("Deal not found", ErrorCode.DEAL_NOT_FOUND)
      }
      return success(updated)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        stageId: t.String(),
        note: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )

  // Delete a deal (hard delete in Phase 0; Phase 2 will switch to soft delete + audit)
  .delete(
    "/:id",
    async ({ workspace, params, set }) => {
      requireRole(workspace, ROLE_WRITE)
      const ok = await dealRepository.delete(workspace.workspaceId, params.id)
      if (!ok) {
        set.status = 404
        return error("Deal not found", ErrorCode.DEAL_NOT_FOUND)
      }
      return success({ deleted: true })
    },
    { params: t.Object({ id: t.String() }) },
  )
