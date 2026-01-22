import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { PageSpinner } from '../LoadingStates'
import { apiClient } from '../../src/services/apiClient'

export const AuthCallback: React.FC = () => {
  const { handleGoogleCallback } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code and state from URL (from Google's redirect)
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const state = params.get('state')
        const oauthError = params.get('error')

        if (oauthError) {
          console.error('OAuth error:', oauthError)
          setError('Google authentication failed')
          setTimeout(() => {
            window.location.href = '/login?error=oauth_failed'
          }, 2000)
          return
        }

        if (!code || !state) {
          console.error('Missing code or state from Google redirect')
          setError('Missing authorization code')
          setTimeout(() => {
            window.location.href = '/login?error=missing_code'
          }, 2000)
          return
        }

        // Call backend API to exchange code for tokens
        const response = await apiClient.request<{ success: boolean; error?: string }>('/api/auth/google/callback', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        })

        if (!(response as any).success) {
          console.error('Token exchange failed:', (response as any).error)
          setError((response as any).error || 'Authentication failed')
          setTimeout(() => {
            window.location.href = '/login?error=auth_failed'
          }, 2000)
          return
        }

        // Backend has set httpOnly cookies, now update auth context
        handleGoogleCallback('', '') // Tokens are in cookies, not returned

        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 500)
      } catch (err) {
        console.error('AuthCallback error:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setTimeout(() => {
          window.location.href = '/login?error=callback_error'
        }, 2000)
      }
    }

    handleCallback()
  }, [handleGoogleCallback])

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
