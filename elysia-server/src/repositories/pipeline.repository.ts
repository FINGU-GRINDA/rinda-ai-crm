import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "../db"
import {
  type NewPipeline,
  type NewPipelineStage,
  type Pipeline,
  type PipelineStage,
  pipelineStages,
  pipelines,
} from "../db/schema/pipelines"

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[]
}

export const pipelineRepository = {
  listWithStages: async (workspaceId: string): Promise<PipelineWithStages[]> => {
    const pipelineRows = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.workspaceId, workspaceId), isNull(pipelines.archivedAt)))
      .orderBy(asc(pipelines.displayOrder), asc(pipelines.createdAt))

    if (pipelineRows.length === 0) return []

    const stageRows = await db
      .select()
      .from(pipelineStages)
      .where(and(eq(pipelineStages.workspaceId, workspaceId), isNull(pipelineStages.archivedAt)))
      .orderBy(asc(pipelineStages.pipelineId), asc(pipelineStages.displayOrder))

    const stagesByPipeline = new Map<string, PipelineStage[]>()
    for (const stage of stageRows) {
      const arr = stagesByPipeline.get(stage.pipelineId) ?? []
      arr.push(stage)
      stagesByPipeline.set(stage.pipelineId, arr)
    }

    return pipelineRows.map((pipeline) => ({
      ...pipeline,
      stages: stagesByPipeline.get(pipeline.id) ?? [],
    }))
  },

  findById: async (workspaceId: string, pipelineId: string): Promise<PipelineWithStages | null> => {
    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.workspaceId, workspaceId), eq(pipelines.id, pipelineId)))
      .limit(1)

    if (!pipeline) return null

    const stages = await db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.workspaceId, workspaceId),
          eq(pipelineStages.pipelineId, pipelineId),
          isNull(pipelineStages.archivedAt),
        ),
      )
      .orderBy(asc(pipelineStages.displayOrder))

    return { ...pipeline, stages }
  },

  create: async (input: Omit<NewPipeline, "id" | "createdAt" | "updatedAt">): Promise<Pipeline> => {
    const [row] = await db.insert(pipelines).values(input).returning()
    if (!row) throw new Error("Failed to create pipeline")
    return row
  },

  createStage: async (
    input: Omit<NewPipelineStage, "id" | "createdAt" | "updatedAt">,
  ): Promise<PipelineStage> => {
    const [row] = await db.insert(pipelineStages).values(input).returning()
    if (!row) throw new Error("Failed to create stage")
    return row
  },

  updateStage: async (
    workspaceId: string,
    stageId: string,
    patch: Partial<Omit<NewPipelineStage, "id" | "workspaceId" | "pipelineId" | "stageType">>,
  ): Promise<PipelineStage | null> => {
    // stageType is intentionally immutable — flipping won→open would corrupt analytics
    const [row] = await db
      .update(pipelineStages)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(pipelineStages.workspaceId, workspaceId), eq(pipelineStages.id, stageId)))
      .returning()
    return row ?? null
  },

  archiveStage: async (workspaceId: string, stageId: string): Promise<boolean> => {
    const rows = await db
      .update(pipelineStages)
      .set({ archivedAt: new Date() })
      .where(and(eq(pipelineStages.workspaceId, workspaceId), eq(pipelineStages.id, stageId)))
      .returning({ id: pipelineStages.id })
    return rows.length > 0
  },
}
