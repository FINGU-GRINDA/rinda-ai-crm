import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { type OAuthToken, oauthTokens } from "../db/schema"

export const oauthRepository = {
  findByProvider: async (userId: string, provider: string): Promise<OAuthToken | null> => {
    const result = await db
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    return result[0] || null
  },

  save: async (data: {
    userId: string
    provider: string
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    scope?: string
  }): Promise<OAuthToken> => {
    const existing = await oauthRepository.findByProvider(data.userId, data.provider)

    if (existing) {
      const [token] = await db
        .update(oauthTokens)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          scope: data.scope,
        })
        .where(and(eq(oauthTokens.userId, data.userId), eq(oauthTokens.provider, data.provider)))
        .returning()
      if (!token) throw new Error("Failed to update OAuth token")
      return token
    } else {
      const [token] = await db
        .insert(oauthTokens)
        .values({
          userId: data.userId,
          provider: data.provider,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          scope: data.scope,
        })
        .returning()
      if (!token) throw new Error("Failed to create OAuth token")
      return token
    }
  },

  updateAccessToken: async (
    userId: string,
    provider: string,
    accessToken: string,
    expiresAt?: number,
  ): Promise<OAuthToken | null> => {
    const [token] = await db
      .update(oauthTokens)
      .set({
        accessToken,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      })
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
      .returning()
    return token || null
  },

  delete: async (userId: string, provider: string): Promise<boolean> => {
    await db
      .delete(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    return true
  },

  isTokenExpired: async (userId: string, provider: string): Promise<boolean> => {
    const token = await oauthRepository.findByProvider(userId, provider)
    if (!token || !token.expiresAt) return true
    return token.expiresAt.getTime() < Date.now()
  },
}
