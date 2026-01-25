import { and, asc, desc, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm"
import { db } from "../db"
import { type NewProspect, type Prospect, prospects } from "../db/schema"
import { logger } from "../utils/logger"

/**
 * API response type for prospects with nested sourceArticle
 */
export interface ProspectApiResponse
  extends Omit<Prospect, "sourceTitle" | "sourceUri" | "sourcePublishedAt"> {
  sourceArticle: {
    title: string | null
    uri: string | null
    publishedAt: Date | null
  }
}

/**
 * Transform prospect database response to API format
 * Converts flat sourceTitle/sourceUri/sourcePublishedAt to nested sourceArticle object
 */
function transformProspectResponse(prospect: Prospect): ProspectApiResponse {
  const { sourceTitle, sourceUri, sourcePublishedAt, ...rest } = prospect
  return {
    ...rest,
    sourceArticle: {
      title: sourceTitle || null,
      uri: sourceUri || null,
      publishedAt: sourcePublishedAt || null,
    },
  }
}

export interface ProspectQueryOptions {
  signalStrength?: string
  industry?: string
  search?: string
  converted?: boolean
  dismissed?: boolean
  limit?: number
  offset?: number
  orderBy?: string
  order?: "asc" | "desc"
}

export const prospectRepository = {
  findAll: async (
    options: ProspectQueryOptions = {},
  ): Promise<{ data: ProspectApiResponse[]; count: number }> => {
    const {
      signalStrength,
      industry,
      search,
      converted,
      dismissed,
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
          like(prospects.contactName, searchPattern),
          like(prospects.contactEmail, searchPattern),
          like(prospects.contactPhone, searchPattern),
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
    if (dismissed !== undefined) {
      conditions.push(eq(prospects.dismissed, dismissed))
    } else {
      // Default: exclude dismissed prospects
      conditions.push(eq(prospects.dismissed, false))
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

    // Transform to API format (nested sourceArticle)
    const transformedData = data.map(transformProspectResponse)

    return {
      data: transformedData,
      count: countResult[0]?.count || 0,
    }
  },

  findById: async (id: string): Promise<ProspectApiResponse | null> => {
    const result = await db.select().from(prospects).where(eq(prospects.id, id))
    return result[0] ? transformProspectResponse(result[0]) : null
  },

  findByCompanyName: async (companyName: string): Promise<Prospect | null> => {
    const result = await db.select().from(prospects).where(eq(prospects.companyName, companyName))
    return result[0] || null
  },

  findUnconverted: async (): Promise<Prospect[]> => {
    return db
      .select()
      .from(prospects)
      .where(and(isNull(prospects.convertedToCustomerId), eq(prospects.dismissed, false)))
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
          like(prospects.contactName, searchPattern),
          like(prospects.contactEmail, searchPattern),
          like(prospects.contactPhone, searchPattern),
        ),
      )
      .orderBy(desc(prospects.detectedAt))
  },

  create: async (data: Partial<NewProspect>): Promise<ProspectApiResponse> => {
    const [prospect] = await db
      .insert(prospects)
      .values({
        companyName: data.companyName || "",
        website: data.website,
        industry: data.industry,
        sourceTitle: data.sourceTitle,
        sourceUri: data.sourceUri,
        sourcePublishedAt: data.sourcePublishedAt,
        signalStrength: data.signalStrength || "medium",
        icpMatch: data.icpMatch,
        notes: data.notes,
        contactName: data.contactName,
        contactTitle: data.contactTitle,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        landingPageUrl: data.landingPageUrl,
      })
      .returning()
    if (!prospect) throw new Error("Failed to create prospect")
    return transformProspectResponse(prospect)
  },

  /**
   * Find or create a prospect by company name (race-condition safe)
   * Uses case-insensitive matching and handles unique constraint violations
   */
  findOrCreate: async (
    data: Partial<NewProspect>,
  ): Promise<{ prospect: ProspectApiResponse; created: boolean }> => {
    if (!data.companyName) {
      throw new Error("Company name is required for findOrCreate")
    }

    // First, try to find existing prospect (case-insensitive)
    const existing = await db
      .select()
      .from(prospects)
      .where(
        and(
          sql`LOWER(${prospects.companyName}) = LOWER(${data.companyName})`,
          eq(prospects.dismissed, false),
          isNull(prospects.convertedToCustomerId),
        ),
      )
      .limit(1)

    if (existing[0]) {
      logger.info({ companyName: data.companyName }, "Found existing prospect")
      return { prospect: transformProspectResponse(existing[0]), created: false }
    }

    // Try to create - handle race condition with unique constraint violation
    try {
      const prospect = await prospectRepository.create(data)
      logger.info({ companyName: data.companyName, id: prospect.id }, "Created new prospect")
      return { prospect, created: true }
    } catch (err) {
      // Handle unique constraint violation (race condition - another request created it)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (
        errorMessage.includes("unique") ||
        errorMessage.includes("duplicate") ||
        errorMessage.includes("violates unique constraint")
      ) {
        logger.info(
          { companyName: data.companyName },
          "Prospect created by concurrent request, fetching existing",
        )
        // Re-fetch the existing prospect
        const existing = await db
          .select()
          .from(prospects)
          .where(
            and(
              sql`LOWER(${prospects.companyName}) = LOWER(${data.companyName})`,
              eq(prospects.dismissed, false),
              isNull(prospects.convertedToCustomerId),
            ),
          )
          .limit(1)

        if (existing[0]) {
          return { prospect: transformProspectResponse(existing[0]), created: false }
        }
      }
      // Re-throw if it's not a unique constraint violation
      throw err
    }
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

  update: async (id: string, data: Partial<NewProspect>): Promise<ProspectApiResponse | null> => {
    const [prospect] = await db.update(prospects).set(data).where(eq(prospects.id, id)).returning()
    return prospect ? transformProspectResponse(prospect) : null
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(prospects).where(eq(prospects.id, id))
    return true
  },

  markAsConverted: async (
    prospectId: string,
    customerId: string,
  ): Promise<ProspectApiResponse | null> => {
    const [prospect] = await db
      .update(prospects)
      .set({ convertedToCustomerId: customerId })
      .where(eq(prospects.id, prospectId))
      .returning()
    return prospect ? transformProspectResponse(prospect) : null
  },

  dismissProspect: async (
    prospectId: string,
    reason: string,
  ): Promise<ProspectApiResponse | null> => {
    const [prospect] = await db
      .update(prospects)
      .set({
        dismissed: true,
        dismissedAt: new Date(),
        dismissReason: reason,
      })
      .where(eq(prospects.id, prospectId))
      .returning()
    return prospect ? transformProspectResponse(prospect) : null
  },

  getRecent: async (limit: number = 10): Promise<Prospect[]> => {
    return db
      .select()
      .from(prospects)
      .where(and(isNull(prospects.convertedToCustomerId), eq(prospects.dismissed, false)))
      .orderBy(desc(prospects.detectedAt))
      .limit(limit)
  },

  getStats: async () => {
    // Total count
    const totalResult = await db.select({ count: sql<number>`count(*)::int` }).from(prospects)

    // Unconverted count (excluding dismissed)
    const unconvertedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(and(isNull(prospects.convertedToCustomerId), eq(prospects.dismissed, false)))

    // Dismissed count
    const dismissedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(eq(prospects.dismissed, true))

    // Count by signal strength (excluding dismissed)
    const bySignal = await db
      .select({
        signalStrength: prospects.signalStrength,
        count: sql<number>`count(*)::int`,
      })
      .from(prospects)
      .where(and(isNull(prospects.convertedToCustomerId), eq(prospects.dismissed, false)))
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
      dismissedCount: dismissedResult[0]?.count || 0,
      countBySignal,
    }
  },
}
