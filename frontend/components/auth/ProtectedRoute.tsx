import type React from "react"
import { useAuth } from "../../contexts/AuthContext"
import { PageSpinner } from "../LoadingStates"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <PageSpinner />
  }

  if (!user) {
    // Redirect to login
    window.location.href = "/login"
    return null
  }

  return <>{children}</>
}
