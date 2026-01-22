import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { apiClient } from '../src/services/apiClient'

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  emailVerified: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  handleGoogleCallback: (accessToken: string, refreshToken: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiClient.getCurrentUser()
      if (response.success && response.data) {
        setUser(response.data as User)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await apiClient.register({ email, password, name })
      if (response.success && response.data) {
        setUser(response.data.user as User)
        return { success: true }
      }
      return { success: false, error: (response as any).error || 'Registration failed' }
    } catch (error) {
      const err = error as Error
      return { success: false, error: err.message || 'Registration failed' }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password })
      if (response.success && response.data) {
        setUser(response.data.user as User)
        return { success: true }
      }
      return { success: false, error: (response as any).error || 'Login failed' }
    } catch (error) {
      const err = error as Error
      return { success: false, error: err.message || 'Login failed' }
    }
  }, [])

  const loginWithGoogle = useCallback(async () => {
    try {
      const response = await apiClient.getGoogleOAuthUrl()
      if (response.success && (response as any).data?.url) {
        window.location.href = (response as any).data.url
      }
    } catch (error) {
      console.error('Failed to get Google OAuth URL:', error)
    }
  }, [])

  const handleGoogleCallback = useCallback((accessToken: string, refreshToken: string) => {
    // Tokens are already set in httpOnly cookies by the backend redirect
    // Just need to verify the user is authenticated
    checkAuth()
  }, [checkAuth])

  const logout = useCallback(async () => {
    try {
      await apiClient.logout()
    } finally {
      setUser(null)
      // Redirect to login
      window.location.href = '/login'
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        register,
        login,
        loginWithGoogle,
        logout,
        handleGoogleCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
