import { and, asc, desc, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm"
import { db } from "../db"
import { type NewProspect, type Prospect, prospects } from "../db/schema"
import { generateId } from "../utils/id-generator"

export interface ProspectQueryOptions {
  signalStrength?: string
  industry?: string
  search?: string
  converted?: boolean
  limit?: number
  offset?: number
  orderBy?: string
  order?: "asc" | "desc"
}

export const prospectRepository = {
  findAll: async (
    options: ProspectQueryOptions = {},
  ): Promise<{ data: Prospect[]; count: number }> => {
    const {
      signalStrength,
      industry,
      search,
      converted,
      limit = 100,
      offset = 0,
      orderBy,
      order = "desc",
    } = options

    // Build conditions
    const conditions = []
    if (signalStrength) {
      const validStrengths = ["high", "medium", "low"] as const
      if (validStrengths.includes(signalStrength as (typeof validStrengths)[number])) {
        conditions.push(
          eq(prospects.signalStrength, signalStrength as (typeof validStrengths)[number]),
        )
      }
    }
    if (industry) {
      conditions.push(eq(prospects.industry, industry))
    }
    if (search) {
      const searchPattern = `%${search}%`
      conditions.push(
        or(
          like(prospects.companyName, searchPattern),
          like(prospects.industry, searchPattern),
          like(prospects.notes, searchPattern),
        ),
      )
    }
    if (converted !== undefined) {
      if (converted) {
        conditions.push(isNotNull(prospects.convertedToCustomerId))
      } else {
        conditions.push(isNull(prospects.convertedToCustomerId))
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(whereClause)

    // Build order clause
    const orderFunc = order === "asc" ? asc : desc
    const orderClause =
      orderBy === "companyName"
        ? orderFunc(prospects.companyName)
        : orderBy === "createdAt"
          ? orderFunc(prospects.createdAt)
          : orderBy === "signalStrength"
            ? orderFunc(prospects.signalStrength)
            : orderFunc(prospects.detectedAt)

    // Get data
    const data = await db
      .select()
      .from(prospects)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset)

    return {
      data,
      count: countResult[0]?.count || 0,
    }
  },

  findById: async (id: string): Promise<Prospect | null> => {
    const result = await db.select().from(prospects).where(eq(prospects.id, id))
    return result[0] || null
  },

  findByCompanyName: async (companyName: string): Promise<Prospect | null> => {
    const result = await db.select().from(prospects).where(eq(prospects.companyName, companyName))
    return result[0] || null
  },

  findUnconverted: async (): Promise<Prospect[]> => {
    return db
      .select()
      .from(prospects)
      .where(isNull(prospects.convertedToCustomerId))
      .orderBy(desc(prospects.detectedAt))
  },

  findBySignalStrength: async (
    strength: NonNullable<Prospect["signalStrength"]>,
  ): Promise<Prospect[]> => {
    return db
      .select()
      .from(prospects)
      .where(eq(prospects.signalStrength, strength))
      .orderBy(desc(prospects.detectedAt))
  },

  search: async (query: string): Promise<Prospect[]> => {
    const searchPattern = `%${query}%`
    return db
      .select()
      .from(prospects)
      .where(
        or(
          like(prospects.companyName, searchPattern),
          like(prospects.industry, searchPattern),
          like(prospects.notes, searchPattern),
        ),
      )
      .orderBy(desc(prospects.detectedAt))
  },

  create: async (data: Partial<NewProspect>): Promise<Prospect> => {
    const id = generateId()
    const now = Date.now()
    const [prospect] = await db
      .insert(prospects)
      .values({
        id,
        companyName: data.companyName || "",
        website: data.website,
        industry: data.industry,
        sourceTitle: data.sourceTitle,
        sourceUri: data.sourceUri,
        sourcePublishedAt: data.sourcePublishedAt,
        signalStrength: data.signalStrength || "medium",
        icpMatch: data.icpMatch,
        notes: data.notes,
        detectedAt: now,
        createdAt: now,
      })
      .returning()
    if (!prospect) throw new Error("Failed to create prospect")
    return prospect
  },

  bulkCreate: async (
    dataList: Array<Partial<NewProspect>>,
  ): Promise<{ created: Prospect[]; skipped: number }> => {
    const created: Prospect[] = []
    let skipped = 0

    for (const data of dataList) {
      // Check if company already exists
      if (data.companyName) {
        const existing = await prospectRepository.findByCompanyName(data.companyName)
        if (existing) {
          skipped++
          continue
        }
      }

      try {
        const prospect = await prospectRepository.create(data)
        created.push(prospect)
      } catch {
        skipped++
      }
    }

    return { created, skipped }
  },

  update: async (id: string, data: Partial<NewProspect>): Promise<Prospect | null> => {
    const [prospect] = await db.update(prospects).set(data).where(eq(prospects.id, id)).returning()
    return prospect || null
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(prospects).where(eq(prospects.id, id))
    return true
  },

  markAsConverted: async (prospectId: string, customerId: string): Promise<Prospect | null> => {
    const [prospect] = await db
      .update(prospects)
      .set({ convertedToCustomerId: customerId })
      .where(eq(prospects.id, prospectId))
      .returning()
    return prospect || null
  },

  getRecent: async (limit: number = 10): Promise<Prospect[]> => {
    return db
      .select()
      .from(prospects)
      .where(isNull(prospects.convertedToCustomerId))
      .orderBy(desc(prospects.detectedAt))
      .limit(limit)
  },

  getStats: async () => {
    // Total count
    const totalResult = await db.select({ count: sql<number>`count(*)::int` }).from(prospects)

    // Unconverted count
    const unconvertedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(isNull(prospects.convertedToCustomerId))

    // Count by signal strength
    const bySignal = await db
      .select({
        signalStrength: prospects.signalStrength,
        count: sql<number>`count(*)::int`,
      })
      .from(prospects)
      .where(isNull(prospects.convertedToCustomerId))
      .groupBy(prospects.signalStrength)

    const countBySignal: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0,
    }
    for (const s of bySignal) {
      if (s.signalStrength) countBySignal[s.signalStrength] = s.count
    }

    return {
      total: totalResult[0]?.count || 0,
      unconvertedCount: unconvertedResult[0]?.count || 0,
      countBySignal,
    }
  },
}
