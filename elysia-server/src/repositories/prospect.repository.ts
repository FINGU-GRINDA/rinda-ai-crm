import { desc, eq, isNull, like, or } from "drizzle-orm"
import { db } from "../db"
import { type NewProspect, type Prospect, prospects } from "../db/schema"
import { generateId } from "../utils/id-generator"

export const prospectRepository = {
  findAll: async (): Promise<Prospect[]> => {
    return db.select().from(prospects).orderBy(desc(prospects.detectedAt))
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
}
