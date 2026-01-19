import { desc, eq } from "drizzle-orm"
import { db } from "../db"
import { type IcpProfile, icpProfiles, type NewIcpProfile } from "../db/schema"

export const icpRepository = {
  findAll: async (): Promise<IcpProfile[]> => {
    return db.select().from(icpProfiles).orderBy(desc(icpProfiles.createdAt))
  },

  findById: async (id: string): Promise<IcpProfile | null> => {
    const result = await db.select().from(icpProfiles).where(eq(icpProfiles.id, id))
    return result[0] || null
  },

  create: async (data: Partial<NewIcpProfile>): Promise<IcpProfile> => {
    const [profile] = await db
      .insert(icpProfiles)
      .values({
        name: data.name || "",
        industries: data.industries,
        keywords: data.keywords,
        companySize: data.companySize,
        targetRegions: data.targetRegions,
      })
      .returning()

    if (!profile) throw new Error("Failed to create ICP profile")
    return profile
  },

  update: async (id: string, data: Partial<NewIcpProfile>): Promise<IcpProfile | null> => {
    const [profile] = await db
      .update(icpProfiles)
      .set(data)
      .where(eq(icpProfiles.id, id))
      .returning()
    return profile || null
  },

  delete: async (id: string): Promise<boolean> => {
    await db.delete(icpProfiles).where(eq(icpProfiles.id, id))
    return true
  },

  // Helper to parse JSON fields
  parseProfile: (profile: IcpProfile) => ({
    ...profile,
    industries: profile.industries ? JSON.parse(profile.industries) : [],
    keywords: profile.keywords ? JSON.parse(profile.keywords) : [],
    targetRegions: profile.targetRegions ? JSON.parse(profile.targetRegions) : [],
  }),

  // Helper to stringify JSON fields for storage
  stringifyData: (data: {
    industries?: string[]
    keywords?: string[]
    targetRegions?: string[]
  }) => ({
    industries: data.industries ? JSON.stringify(data.industries) : undefined,
    keywords: data.keywords ? JSON.stringify(data.keywords) : undefined,
    targetRegions: data.targetRegions ? JSON.stringify(data.targetRegions) : undefined,
  }),
}
