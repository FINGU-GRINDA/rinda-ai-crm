import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm"
import { db } from "../db"
import { customers } from "../db/schema/customers"
import {
  type Deal,
  type DealStageHistory,
  dealStageHistory,
  deals,
  type ForecastCategory,
  type NewDeal,
} from "../db/schema/deals"
import { pipelineStages } from "../db/schema/pipelines"
import { users } from "../db/schema/users"

export interface DealListOptions {
  pipelineId?: string
  stageId?: string
  ownerId?: string
  customerId?: string
  forecastCategory?: ForecastCategory
  search?: string
  includeClosed?: boolean
  limit?: number
  offset?: number
  orderBy?: "created" | "updated" | "expected_close" | "amount" | "stage_entered"
  order?: "asc" | "desc"
}

export interface DealCard {
  id: string
  humanId: string
  title: string
  amountMinor: string
  currency: string
  baseAmountMinor: string
  probability: string | null
  forecastCategory: ForecastCategory
  expectedCloseDate: string | null
  actualCloseDate: string | null
  stageId: string
  pipelineId: string
  stageEnteredAt: Date
  createdAt: Date
  updatedAt: Date
  customer: { id: string; name: string } | null
  owner: { id: string; name: string; email: string }
  stage: { id: string; name: string; color: string; stageType: string }
}

function isUuid(value: string | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export const dealRepository = {
  list: async (
    workspaceId: string,
    options: DealListOptions = {},
  ): Promise<{ data: DealCard[]; count: number }> => {
    const {
      pipelineId,
      stageId,
      ownerId,
      customerId,
      forecastCategory,
      search,
      includeClosed = false,
      limit = 200,
      offset = 0,
      orderBy = "stage_entered",
      order = "desc",
    } = options

    const conditions = [eq(deals.workspaceId, workspaceId)]
    if (isUuid(pipelineId)) conditions.push(eq(deals.pipelineId, pipelineId as string))
    if (isUuid(stageId)) conditions.push(eq(deals.stageId, stageId as string))
    if (isUuid(ownerId)) conditions.push(eq(deals.ownerId, ownerId as string))
    if (isUuid(customerId)) conditions.push(eq(deals.customerId, customerId as string))
    if (forecastCategory) conditions.push(eq(deals.forecastCategory, forecastCategory))
    if (!includeClosed) conditions.push(isNull(deals.actualCloseDate))
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`
      conditions.push(sql`(${deals.title} ILIKE ${pattern} OR ${deals.humanId} ILIKE ${pattern})`)
    }

    const where = and(...conditions)

    const orderColumn =
      orderBy === "created"
        ? deals.createdAt
        : orderBy === "updated"
          ? deals.updatedAt
          : orderBy === "expected_close"
            ? deals.expectedCloseDate
            : orderBy === "amount"
              ? deals.baseAmountMinor
              : deals.stageEnteredAt

    const orderClause = order === "asc" ? asc(orderColumn) : desc(orderColumn)

    const totalRows = await db.select({ total: count() }).from(deals).where(where)
    const total = totalRows[0]?.total ?? 0

    const rows = await db
      .select({
        deal: deals,
        customerId: customers.id,
        customerName: customers.name,
        ownerId: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        stageId: pipelineStages.id,
        stageName: pipelineStages.name,
        stageColor: pipelineStages.color,
        stageType: pipelineStages.stageType,
      })
      .from(deals)
      .leftJoin(
        customers,
        and(eq(customers.id, deals.customerId), eq(customers.workspaceId, workspaceId)),
      )
      .innerJoin(users, eq(users.id, deals.ownerId))
      .innerJoin(
        pipelineStages,
        and(eq(pipelineStages.id, deals.stageId), eq(pipelineStages.workspaceId, workspaceId)),
      )
      .where(where)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset)

    const data: DealCard[] = rows.map((row) => ({
      id: row.deal.id,
      humanId: row.deal.humanId,
      title: row.deal.title,
      amountMinor: row.deal.amountMinor.toString(),
      currency: row.deal.currency,
      baseAmountMinor: row.deal.baseAmountMinor.toString(),
      probability: row.deal.probability,
      forecastCategory: row.deal.forecastCategory,
      expectedCloseDate: row.deal.expectedCloseDate,
      actualCloseDate: row.deal.actualCloseDate,
      stageId: row.deal.stageId,
      pipelineId: row.deal.pipelineId,
      stageEnteredAt: row.deal.stageEnteredAt,
      createdAt: row.deal.createdAt,
      updatedAt: row.deal.updatedAt,
      customer: row.customerId ? { id: row.customerId, name: row.customerName ?? "" } : null,
      owner: { id: row.ownerId, name: row.ownerName, email: row.ownerEmail },
      stage: {
        id: row.stageId,
        name: row.stageName,
        color: row.stageColor,
        stageType: row.stageType,
      },
    }))

    return { data, count: Number(total) }
  },

  findById: async (workspaceId: string, dealId: string): Promise<Deal | null> => {
    const [row] = await db
      .select()
      .from(deals)
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
      .limit(1)
    return row ?? null
  },

  create: async (input: Omit<NewDeal, "id" | "createdAt" | "updatedAt">): Promise<Deal> => {
    const [row] = await db.insert(deals).values(input).returning()
    if (!row) throw new Error("Failed to create deal")

    // Seed initial stage history entry so analytics has a starting point
    await db.insert(dealStageHistory).values({
      workspaceId: input.workspaceId,
      dealId: row.id,
      fromStageId: null,
      toStageId: input.stageId,
      changedBy: input.ownerId,
      note: "Deal created",
    })

    return row
  },

  update: async (
    workspaceId: string,
    dealId: string,
    patch: Partial<Omit<NewDeal, "id" | "workspaceId" | "createdAt">>,
  ): Promise<Deal | null> => {
    const [row] = await db
      .update(deals)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
      .returning()
    return row ?? null
  },

  moveStage: async (
    workspaceId: string,
    dealId: string,
    toStageId: string,
    actorId: string,
    note?: string,
  ): Promise<Deal | null> => {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(deals)
        .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
        .limit(1)

      if (!existing) return null
      if (existing.stageId === toStageId) return existing

      const [targetStage] = await tx
        .select()
        .from(pipelineStages)
        .where(
          and(
            eq(pipelineStages.id, toStageId),
            eq(pipelineStages.workspaceId, workspaceId),
            eq(pipelineStages.pipelineId, existing.pipelineId),
          ),
        )
        .limit(1)

      if (!targetStage) throw new Error("Target stage not found in this pipeline")

      const now = new Date()
      const durationSeconds = BigInt(
        Math.max(0, Math.floor((now.getTime() - existing.stageEnteredAt.getTime()) / 1000)),
      )

      await tx.insert(dealStageHistory).values({
        workspaceId,
        dealId,
        fromStageId: existing.stageId,
        toStageId,
        changedBy: actorId,
        durationInFromStageSeconds: durationSeconds,
        note,
      })

      const actualCloseDate =
        targetStage.stageType === "won" || targetStage.stageType === "lost"
          ? now.toISOString().slice(0, 10)
          : null

      const forecastCategory =
        targetStage.stageType === "won" || targetStage.stageType === "lost"
          ? ("closed" as const)
          : existing.forecastCategory

      const [updated] = await tx
        .update(deals)
        .set({
          stageId: toStageId,
          stageEnteredAt: now,
          actualCloseDate: actualCloseDate ?? existing.actualCloseDate,
          forecastCategory,
          updatedAt: now,
        })
        .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
        .returning()

      return updated ?? null
    })
  },

  delete: async (workspaceId: string, dealId: string): Promise<boolean> => {
    const rows = await db
      .delete(deals)
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, dealId)))
      .returning({ id: deals.id })
    return rows.length > 0
  },

  stageHistory: async (workspaceId: string, dealId: string): Promise<DealStageHistory[]> => {
    return await db
      .select()
      .from(dealStageHistory)
      .where(
        and(eq(dealStageHistory.workspaceId, workspaceId), eq(dealStageHistory.dealId, dealId)),
      )
      .orderBy(desc(dealStageHistory.changedAt))
  },
}
