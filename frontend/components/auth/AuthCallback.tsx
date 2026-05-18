import type React from "react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { apiClient } from "../../src/services/apiClient"
import { PageSpinner } from "../LoadingStates"

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleGoogleCallback } = useAuth()
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

        if (!(response as any).success) {
          console.error("Token exchange failed:", (response as any).error)
          setError((response as any).error || "Authentication failed")
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <PageSpinner />
}
