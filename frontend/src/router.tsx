import { lazy, Suspense } from "react"
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom"
import { AgenticLoader } from "../components/AgenticLoader"
import { AuthCallback } from "../components/auth/AuthCallback"
import { LoginForm } from "../components/auth/LoginForm"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { AuthProvider, useAuth } from "../contexts/AuthContext"
import { LanguageProvider } from "./i18n/LanguageContext"

// Lazy load the dashboard for better performance
const AppDashboard = lazy(() => import("../App").then((m) => ({ default: m.AppDashboard })))
const DealsPage = lazy(() =>
  import("../components/deal/DealsPage").then((m) => ({ default: m.DealsPage })),
)

// Protected route - redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <AgenticLoader variant="page" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public route - redirects to dashboard if already authenticated
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <AgenticLoader variant="page" />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// App wrapper with LanguageProvider + AuthProvider
function AppWrapper() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </AuthProvider>
    </LanguageProvider>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppWrapper />,
    children: [
      // Root redirects to dashboard
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      // Login page (public only)
      {
        path: "login",
        element: (
          <PublicOnlyRoute>
            <LoginForm />
          </PublicOnlyRoute>
        ),
      },
      // OAuth callback
      {
        path: "auth",
        element: <AuthCallback />,
      },
      // Main app (protected)
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<AgenticLoader variant="page" />}>
              <AppDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      // Phase 1 — Deal pipeline (workspace-scoped Kanban)
      {
        path: "deals",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <DealsPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
    ],
  },
])
