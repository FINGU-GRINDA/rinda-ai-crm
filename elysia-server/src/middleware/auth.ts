import { eq } from "drizzle-orm"
import { Elysia } from "elysia"
import { decode, verify } from "jsonwebtoken"
import { config, isProduction } from "../config"
import { db } from "../db"
import { users } from "../db/schema/users"
import { authService } from "../services/auth.service"

export interface AuthContext {
  userId: string
  email: string
}

interface TokenPayload {
  userId: string
  email: string
  tokenVersion: number
  exp: number
  iat: number
}

// Threshold for proactive refresh (2 minutes before expiry)
const REFRESH_THRESHOLD_SECONDS = 2 * 60

export const authMiddleware = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ cookie, set }) => {
    const accessToken = cookie.access_token?.value as string | undefined
    const refreshToken = cookie.refresh_token?.value as string | undefined

    if (!accessToken) {
      set.status = 401
      throw new Error("Authentication required")
    }

    try {
      // Decode token to check expiry (without verifying first for performance)
      const decoded = decode(accessToken) as TokenPayload | null

      if (!decoded || !decoded.exp) {
        set.status = 401
        throw new Error("Invalid token format")
      }

      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = decoded.exp - now

      // Check if token is expired
      if (timeUntilExpiry <= 0) {
        // Token expired - try to refresh
        if (refreshToken) {
          const refreshResult = await authService.refreshTokens(refreshToken)
          if (refreshResult.success && refreshResult.tokens) {
            // Set new cookies
            cookie.access_token?.set({
              value: refreshResult.tokens.accessToken,
              httpOnly: true,
              secure: isProduction,
              sameSite: "strict",
              maxAge: 15 * 60,
              path: "/",
            })

            cookie.refresh_token?.set({
              value: refreshResult.tokens.refreshToken,
              httpOnly: true,
              secure: isProduction,
              sameSite: "strict",
              maxAge: 7 * 24 * 60 * 60,
              path: "/",
            })

            // Use the new token for this request
            const newDecoded = decode(refreshResult.tokens.accessToken) as TokenPayload
            return {
              auth: {
                userId: newDecoded.userId,
                email: newDecoded.email,
              } as AuthContext,
            }
          }
        }
        set.status = 401
        throw new Error("Token expired")
      }

      // Verify the token properly
      const verified = verify(
        accessToken,
        String(config.JWT_SECRET || ""),
      ) as unknown as TokenPayload

      // Validate user in database
      const [user] = await db.select().from(users).where(eq(users.id, verified.userId)).limit(1)

      if (!user || !user.isActive || user.tokenVersion !== verified.tokenVersion) {
        set.status = 401
        throw new Error("Invalid token")
      }

      // Proactive refresh: if token expires within threshold, refresh it now
      if (timeUntilExpiry < REFRESH_THRESHOLD_SECONDS && refreshToken) {
        const refreshResult = await authService.refreshTokens(refreshToken)
        if (refreshResult.success && refreshResult.tokens) {
          // Set new cookies (happens in the background, doesn't block the request)
          cookie.access_token?.set({
            value: refreshResult.tokens.accessToken,
            httpOnly: true,
            secure: isProduction,
            sameSite: "strict",
            maxAge: 15 * 60,
            path: "/",
          })

          cookie.refresh_token?.set({
            value: refreshResult.tokens.refreshToken,
            httpOnly: true,
            secure: isProduction,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
          })
        }
      }

      return {
        auth: {
          userId: verified.userId,
          email: verified.email,
        } as AuthContext,
      }
    } catch (_err) {
      // If verification fails but we have a refresh token, try to refresh
      if (refreshToken) {
        try {
          const refreshResult = await authService.refreshTokens(refreshToken)
          if (refreshResult.success && refreshResult.tokens) {
            cookie.access_token?.set({
              value: refreshResult.tokens.accessToken,
              httpOnly: true,
              secure: isProduction,
              sameSite: "strict",
              maxAge: 15 * 60,
              path: "/",
            })

            cookie.refresh_token?.set({
              value: refreshResult.tokens.refreshToken,
              httpOnly: true,
              secure: isProduction,
              sameSite: "strict",
              maxAge: 7 * 24 * 60 * 60,
              path: "/",
            })

            const newDecoded = decode(refreshResult.tokens.accessToken) as TokenPayload
            return {
              auth: {
                userId: newDecoded.userId,
                email: newDecoded.email,
              } as AuthContext,
            }
          }
        } catch {
          // Refresh failed, fall through to error
        }
      }

      set.status = 401
      throw new Error("Invalid or expired token")
    }
  },
)
