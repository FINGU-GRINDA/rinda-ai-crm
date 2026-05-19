import type React from "react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { useTranslation } from "../../src/i18n/LanguageContext"
import { apiClient } from "../../src/services/apiClient"
import { AgenticLoader } from "../AgenticLoader"

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleGoogleCallback } = useAuth()
  const t = useTranslation()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code and state from URL (from Google's redirect)
        const code = searchParams.get("code")
        const state = searchParams.get("state")
        const oauthError = searchParams.get("error")

        if (oauthError) {
          console.error("OAuth error:", oauthError)
          setError("Google authentication failed")
          setTimeout(() => {
            navigate("/login?error=oauth_failed", { replace: true })
          }, 2000)
          return
        }

        if (!code || !state) {
          console.error("Missing code or state from Google redirect")
          setError("Missing authorization code")
          setTimeout(() => {
            navigate("/login?error=missing_code", { replace: true })
          }, 2000)
          return
        }

        // Validate state matches what we stored (CSRF protection)
        const savedState = sessionStorage.getItem("oauth_state")
        if (savedState && savedState !== state) {
          console.error("State mismatch - possible CSRF attack")
          setError("Security validation failed")
          sessionStorage.removeItem("oauth_state")
          setTimeout(() => {
            navigate("/login?error=state_mismatch", { replace: true })
          }, 2000)
          return
        }
        sessionStorage.removeItem("oauth_state") // Clean up after validation

        // Call backend API to exchange code for tokens
        const response = await apiClient.request<{ success: boolean; error?: string }>(
          "/api/auth/google/callback",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code, state }),
          },
        )

        if (!response.success) {
          console.error("Token exchange failed:", response.error)
          setError(response.error || "Authentication failed")
          setTimeout(() => {
            navigate("/login?error=auth_failed", { replace: true })
          }, 2000)
          return
        }

        // Backend has set httpOnly cookies, now verify authentication
        const authResult = await handleGoogleCallback()
        if (authResult.success) {
          navigate("/dashboard", { replace: true })
        } else {
          setError("Failed to verify authentication")
          setTimeout(() => {
            navigate("/login?error=verification_failed", { replace: true })
          }, 2000)
        }
      } catch (err) {
        console.error("AuthCallback error:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
        setTimeout(() => {
          navigate("/login?error=callback_error", { replace: true })
        }, 2000)
      }
    }

    handleCallback()
  }, [handleGoogleCallback, navigate, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 border border-red-200 mb-4">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-slate-800">{error}</p>
          <p className="mt-2 text-xs text-slate-500">{t.authCallback.redirecting}</p>
        </div>
      </div>
    )
  }

  return (
    <AgenticLoader variant="page" title={t.authCallback.verifying} detail={t.authCallback.detail} />
  )
}
