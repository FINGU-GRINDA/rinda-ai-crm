import { Elysia, t } from "elysia"
import { ROLE_ADMIN, ROLE_WRITE, requireRole, workspaceMiddleware } from "../middleware/workspace"
import { pipelineRepository } from "../repositories/pipeline.repository"
import { ErrorCode, error, success, successList } from "../utils/response"

const STAGE_TYPES = ["open", "won", "lost"] as const

export const pipelineRoutes = new Elysia({ prefix: "/api/pipelines" })
  .use(workspaceMiddleware)

  // List all pipelines + their stages
  .get("/", async ({ workspace }) => {
    const list = await pipelineRepository.listWithStages(workspace.workspaceId)
    return successList(list, list.length)
  })

  // Get a single pipeline with stages
  .get(
    "/:id",
    async ({ params, workspace, set }) => {
      const pipeline = await pipelineRepository.findById(workspace.workspaceId, params.id)
      if (!pipeline) {
        set.status = 404
        return error("Pipeline not found", ErrorCode.PIPELINE_NOT_FOUND)
      }
      return success(pipeline)
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Create a pipeline
  .post(
    "/",
    async ({ workspace, body, set }) => {
      requireRole(workspace, ROLE_ADMIN)
      const created = await pipelineRepository.create({
        workspaceId: workspace.workspaceId,
        name: body.name,
        description: body.description,
        isDefault: body.isDefault ? 1 : 0,
        displayOrder: body.displayOrder ?? 0,
      })
      set.status = 201
      return success(created)
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 120 }),
        description: t.Optional(t.String({ maxLength: 500 })),
        isDefault: t.Optional(t.Boolean()),
        displayOrder: t.Optional(t.Integer({ minimum: 0 })),
      }),
    },
  )

  // Add a stage to a pipeline
  .post(
    "/:id/stages",
    async ({ workspace, params, body, set }) => {
      requireRole(workspace, ROLE_ADMIN)
      const pipeline = await pipelineRepository.findById(workspace.workspaceId, params.id)
      if (!pipeline) {
        set.status = 404
        return error("Pipeline not found", ErrorCode.PIPELINE_NOT_FOUND)
      }

      const nextOrder = body.displayOrder ?? pipeline.stages.length

      const created = await pipelineRepository.createStage({
        workspaceId: workspace.workspaceId,
        pipelineId: pipeline.id,
        name: body.name,
        stageType: body.stageType ?? "open",
        displayOrder: nextOrder,
        defaultProbability: body.defaultProbability ?? "0.00",
        color: body.color ?? "#6366f1",
        rottingDays: body.rottingDays,
      })

      set.status = 201
      return success(created)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 60 }),
        stageType: t.Optional(t.Union(STAGE_TYPES.map((value) => t.Literal(value)))),
        displayOrder: t.Optional(t.Integer({ minimum: 0 })),
        defaultProbability: t.Optional(t.String()),
        color: t.Optional(t.String({ maxLength: 16 })),
        rottingDays: t.Optional(t.Integer({ minimum: 1, maximum: 365 })),
      }),
    },
  )

  // Update a stage (name/order/color/probability/rotting — stageType is immutable)
  .patch(
    "/:id/stages/:stageId",
    async ({ workspace, params, body, set }) => {
      requireRole(workspace, ROLE_WRITE)
      const updated = await pipelineRepository.updateStage(workspace.workspaceId, params.stageId, {
        name: body.name,
        displayOrder: body.displayOrder,
        defaultProbability: body.defaultProbability,
        color: body.color,
        rottingDays: body.rottingDays,
      })
      if (!updated) {
        set.status = 404
        return error("Stage not found", ErrorCode.STAGE_NOT_FOUND)
      }
      return success(updated)
    },
    {
      params: t.Object({ id: t.String(), stageId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 60 })),
        displayOrder: t.Optional(t.Integer({ minimum: 0 })),
        defaultProbability: t.Optional(t.String()),
        color: t.Optional(t.String({ maxLength: 16 })),
        rottingDays: t.Optional(t.Integer({ minimum: 1, maximum: 365 })),
      }),
    },
  )

  // Archive a stage
  .delete(
    "/:id/stages/:stageId",
    async ({ workspace, params, set }) => {
      requireRole(workspace, ROLE_ADMIN)
      const ok = await pipelineRepository.archiveStage(workspace.workspaceId, params.stageId)
      if (!ok) {
        set.status = 404
        return error("Stage not found", ErrorCode.STAGE_NOT_FOUND)
      }
      return success({ archived: true })
    },
    {
      params: t.Object({ id: t.String(), stageId: t.String() }),
    },
  )
