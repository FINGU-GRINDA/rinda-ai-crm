import { randomBytes } from "node:crypto"
import * as argon2 from "@node-rs/argon2"
import { eq, sql } from "drizzle-orm"
import { sign, verify } from "jsonwebtoken"
import { config } from "../config"
import { db } from "../db"
import { users } from "../db/schema/users"

interface RegisterData {
  email: string
  password: string
  name: string
}

interface TokenPayload {
  userId: string
  email: string
  tokenVersion: number
}

interface AuthServiceRegisterResult {
  success: boolean
  user?: typeof users.$inferSelect
  error?: string
}

interface AuthServiceLoginResult {
  success: boolean
  user?: typeof users.$inferSelect
  error?: string
}

interface AuthServiceTokenResult {
  accessToken: string
  refreshToken: string
}

interface AuthServiceRefreshResult {
  success: boolean
  tokens?: AuthServiceTokenResult
  error?: string
}

export const authService = {
  async register(data: RegisterData): Promise<AuthServiceRegisterResult> {
    // Check if email exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      return { success: false, error: "Email already registered" }
    }

    // Hash password with argon2id
    const passwordHash = await argon2.hash(data.password, {
      memoryCost: 19456, // 19 MiB
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    // Generate email verification token
    const verificationToken = randomBytes(32).toString("hex")
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      })
      .returning()

    return { success: true, user: newUser }
  },

  async login(email: string, password: string): Promise<AuthServiceLoginResult> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user || !user.passwordHash) {
      return { success: false, error: "Invalid credentials" }
    }

    if (!user.isActive) {
      return { success: false, error: "Account is deactivated" }
    }

    const isValid = await argon2.verify(user.passwordHash, password)

    if (!isValid) {
      return { success: false, error: "Invalid credentials" }
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

    return { success: true, user }
  },

  generateTokens(user: typeof users.$inferSelect): AuthServiceTokenResult {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    }

    const accessToken = sign(payload, config.JWT_SECRET || "", {
      expiresIn: "15m",
    })

    const refreshToken = sign(payload, config.JWT_REFRESH_SECRET || "", {
      expiresIn: "7d",
    })

    return { accessToken, refreshToken }
  },

  async refreshTokens(refreshToken: string): Promise<AuthServiceRefreshResult> {
    try {
      const decoded = verify(refreshToken, config.JWT_REFRESH_SECRET || "") as TokenPayload

      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)

      if (!user || !user.isActive || user.tokenVersion !== decoded.tokenVersion) {
        return { success: false, error: "Invalid token" }
      }

      const tokens = authService.generateTokens(user)
      return { success: true, tokens }
    } catch {
      return { success: false, error: "Invalid refresh token" }
    }
  },

  async invalidateAllTokens(userId: string): Promise<void> {
    await db.update(users).set({ tokenVersion: sql`token_version + 1` }).where(eq(users.id, userId))
  },
}
