import { eq } from "drizzle-orm"
import { Elysia } from "elysia"
import { verify } from "jsonwebtoken"
import { config } from "../config"
import { db } from "../db"
import { users } from "../db/schema/users"

export interface AuthContext {
  userId: string
  email: string
}

export const authMiddleware = new Elysia().derive(async ({ cookie, set }) => {
  const token = cookie.access_token?.value as string | undefined

  if (!token) {
    set.status = 401
    throw new Error("Authentication required")
  }

  try {
    const decoded = verify(token as string, String(config.JWT_SECRET || "")) as unknown as {
      userId: string
      email: string
      tokenVersion: number
    }

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)

    if (!user || !user.isActive || user.tokenVersion !== decoded.tokenVersion) {
      set.status = 401
      throw new Error("Invalid token")
    }

    return {
      auth: {
        userId: decoded.userId,
        email: decoded.email,
      } as AuthContext,
    }
  } catch (_err) {
    set.status = 401
    throw new Error("Invalid or expired token")
  }
})
