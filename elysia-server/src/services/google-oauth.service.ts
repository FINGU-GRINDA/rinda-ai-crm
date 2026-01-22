import { config } from "../config"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

export interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
  id_token?: string
}

export interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

class GoogleOAuthService {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor() {
    this.clientId = config.GOOGLE_CLIENT_ID || ""
    this.clientSecret = config.GOOGLE_CLIENT_SECRET || ""
    this.redirectUri = config.GOOGLE_REDIRECT_URI || ""

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error(
        "Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) are required",
      )
    }
  }

  getAuthorizationUrl(state: string, flowType: "signin" | "gmail" | "calendar"): string {
    const scopes = this.getScopesForFlowType(flowType)

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state: state,
      access_type: "offline",
      prompt: "consent",
    })

    return `${GOOGLE_AUTH_URL}?${params.toString()}`
  }

  private getScopesForFlowType(flowType: string): string[] {
    switch (flowType) {
      case "signin":
        return [
          "openid",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ]
      case "gmail":
        return ["https://www.googleapis.com/auth/gmail.readonly"]
      case "calendar":
        return ["https://www.googleapis.com/auth/calendar.readonly"]
      default:
        throw new Error(`Unknown flow type: ${flowType}`)
    }
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
    })

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorMsg =
        (error.error_description as string) || (error.error as string) || "Unknown error"
      throw new Error(`Token exchange failed: ${errorMsg}`)
    }

    return (await response.json()) as GoogleTokenResponse
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    })

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new Error("Token refresh failed")
    }

    return (await response.json()) as GoogleTokenResponse
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error("Failed to get user info")
    }

    return (await response.json()) as GoogleUserInfo
  }

  async validateToken(accessToken: string): Promise<boolean> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
    )

    return response.ok
  }
}

export const googleOAuthService = new GoogleOAuthService()
