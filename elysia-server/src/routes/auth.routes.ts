import { eq, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { config, isProduction } from "../config"
import { db } from "../db"
import { oauthStates, users } from "../db/schema"
import { authService } from "../services/auth.service"
import { encryptionService } from "../services/encryption.service"
import { googleOAuthService } from "../services/google-oauth.service"
import { logger } from "../utils/logger"
import { success } from "../utils/response"

// Public auth routes
const publicAuthRoutes = new Elysia({ prefix: "/api/auth" })
  // Email/Password Registration
  .post(
    "/register",
    async ({ body, set, cookie }) => {
      try {
        const result = await authService.register(body)

        if (!result.success) {
          set.status = 400
          return { success: false, error: result.error }
        }

        const user = result.user
        if (!user) {
          throw new Error("User creation failed")
        }

        const tokens = authService.generateTokens(user)

        cookie.access_token?.set({
          value: tokens.accessToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 15 * 60,
          path: "/",
        })

        cookie.refresh_token?.set({
          value: tokens.refreshToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
        })

        set.status = 201
        return success({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified === 1,
          },
        })
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Registration error",
        )
        set.status = 500
        return { success: false, error: "Registration failed" }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        name: t.String({ minLength: 2 }),
      }),
    },
  )

  // Email/Password Login
  .post(
    "/login",
    async ({ body, set, cookie }) => {
      try {
        const result = await authService.login(body.email, body.password)

        if (!result.success) {
          set.status = 401
          return { success: false, error: result.error }
        }

        const user = result.user
        if (!user) {
          throw new Error("User lookup failed")
        }

        const tokens = authService.generateTokens(user)

        cookie.access_token?.set({
          value: tokens.accessToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 15 * 60,
          path: "/",
        })

        cookie.refresh_token?.set({
          value: tokens.refreshToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
        })

        return success({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified === 1,
          },
        })
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Login error",
        )
        set.status = 500
        return { success: false, error: "Login failed" }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    },
  )

  // Google OAuth - Get Authorization URL
  .get("/google/url", async ({ set }) => {
    try {
      const state = encryptionService.generateSecureToken(32)

      await db.insert(oauthStates).values({
        state,
        provider: "google",
        flowType: "signin",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })

      const url = googleOAuthService.getAuthorizationUrl(state, "signin")

      return success({ url })
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Google OAuth URL error",
      )
      set.status = 500
      return { success: false, error: "Failed to generate OAuth URL" }
    }
  })

  // Google OAuth - Handle Callback (Frontend calls this with authorization code)
  .post(
    "/google/callback",
    async ({ body, set, cookie }) => {
      try {
        const { code, state } = body

        if (!code || !state) {
          set.status = 400
          return { success: false, error: "Missing code or state parameter" }
        }

        // Verify CSRF state
        const [stateRecord] = await db
          .select()
          .from(oauthStates)
          .where(eq(oauthStates.state, state))
          .limit(1)

        if (!stateRecord) {
          logger.error({ state }, "OAuth state not found in database")
          set.status = 400
          return { success: false, error: "Invalid or expired state parameter" }
        }

        if (stateRecord.flowType !== "signin") {
          logger.error({ flowType: stateRecord.flowType }, "OAuth state has wrong flowType")
          set.status = 400
          return { success: false, error: "Invalid state flow type" }
        }

        await db.delete(oauthStates).where(eq(oauthStates.state, state))

        // Exchange code for tokens
        const tokens = await googleOAuthService.exchangeCodeForTokens(code)

        // Get user info
        const userInfo = await googleOAuthService.getUserInfo(tokens.access_token)

        // Find or create user
        let [user] = await db.select().from(users).where(eq(users.googleId, userInfo.id)).limit(1)

        if (!user) {
          const [existingEmailUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, userInfo.email.toLowerCase()))
            .limit(1)

          if (existingEmailUser) {
            // Link Google account
            const [updatedUser] = await db
              .update(users)
              .set({
                googleId: userInfo.id,
                picture: userInfo.picture,
                emailVerified: userInfo.verified_email ? 1 : 0,
              })
              .where(eq(users.id, existingEmailUser.id))
              .returning()
            user = updatedUser
          } else {
            // Create new user
            const [newUser] = await db
              .insert(users)
              .values({
                email: userInfo.email.toLowerCase(),
                name: userInfo.name,
                picture: userInfo.picture,
                googleId: userInfo.id,
                emailVerified: userInfo.verified_email ? 1 : 0,
              })
              .returning()
            user = newUser
          }
        }

        if (!user) {
          set.status = 400
          return { success: false, error: "Failed to create or find user" }
        }

        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

        // Generate session tokens
        const sessionTokens = authService.generateTokens(user)

        // Set httpOnly cookies with tokens
        cookie.access_token?.set({
          value: sessionTokens.accessToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 15 * 60,
          path: "/",
        })

        cookie.refresh_token?.set({
          value: sessionTokens.refreshToken,
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
        })

        set.status = 200
        return success({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified === 1,
          },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error({ error: errorMessage, stack: errorStack }, "Google OAuth callback error")
        set.status = 500
        return { success: false, error: errorMessage || "Authentication failed" }
      }
    },
    {
      body: t.Object({
        code: t.String(),
        state: t.String(),
      }),
    },
  )

  // Token Refresh
  .post("/refresh", async ({ cookie, set }) => {
    try {
      const refreshToken = cookie.refresh_token?.value as string | undefined

      if (!refreshToken) {
        set.status = 401
        return { success: false, error: "Refresh token required" }
      }

      const result = await authService.refreshTokens(refreshToken as string)

      if (!result.success) {
        set.status = 401
        return { success: false, error: result.error }
      }

      cookie.access_token?.set({
        value: result.tokens?.accessToken || "",
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 15 * 60,
        path: "/",
      })

      cookie.refresh_token?.set({
        value: result.tokens?.refreshToken || "",
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      })

      return success({ message: "Tokens refreshed" })
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Token refresh error",
      )
      set.status = 500
      return { success: false, error: "Token refresh failed" }
    }
  })

// Helper function to verify token and get auth context
// biome-ignore lint/suspicious/noExplicitAny: Elysia cookie type is complex
async function getAuthContext(cookie: any) {
  const token = cookie.access_token?.value as string | undefined

  if (!token) {
    throw new Error("Authentication required")
  }

  const { verify } = await import("jsonwebtoken")
  const decoded = verify(token, String(config.JWT_SECRET || "")) as unknown as {
    userId: string
    email: string
    tokenVersion: number
  }

  const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)

  if (!user || !user.isActive || user.tokenVersion !== decoded.tokenVersion) {
    throw new Error("Invalid token")
  }

  return { userId: decoded.userId, email: decoded.email }
}

// Protected auth routes
const protectedAuthRoutes = new Elysia({ prefix: "/api/auth" })
  .get("/me", async ({ cookie, set }) => {
    try {
      const auth = await getAuthContext(cookie)
      const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)

      if (!user) {
        return { success: false, error: "User not found" }
      }

      return success({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        emailVerified: user.emailVerified === 1,
      })
    } catch (error) {
      set.status = 401
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Get user error",
      )
      return { success: false, error: "Authentication failed" }
    }
  })

  // Logout (Protected)
  .post("/logout", async ({ cookie, set }) => {
    try {
      const auth = await getAuthContext(cookie)

      // Revoke tokens by incrementing version
      await db
        .update(users)
        .set({ tokenVersion: sql`token_version + 1` })
        .where(eq(users.id, auth.userId))

      cookie.access_token?.set({ value: "", maxAge: 0, path: "/" })
      cookie.refresh_token?.set({ value: "", maxAge: 0, path: "/" })

      return success({ message: "Logged out" })
    } catch (error) {
      set.status = 401
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Logout error",
      )
      return { success: false, error: "Authentication failed" }
    }
  })

// Export combined routes
export const authRoutes = new Elysia().use(publicAuthRoutes).use(protectedAuthRoutes)
