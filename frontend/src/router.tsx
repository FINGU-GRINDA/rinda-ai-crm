import { lazy, Suspense } from "react"
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom"
import { AuthCallback } from "../components/auth/AuthCallback"
import { LoginForm } from "../components/auth/LoginForm"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { AuthProvider, useAuth } from "../contexts/AuthContext"

// Lazy load the dashboard for better performance
const AppDashboard = lazy(() => import("../App").then((m) => ({ default: m.AppDashboard })))
const DealsPage = lazy(() =>
  import("../components/deal/DealsPage").then((m) => ({ default: m.DealsPage })),
)

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-600 text-sm">로딩 중...</p>
    </div>
  )
}

// Protected route - redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingFallback />
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
    return <LoadingFallback />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// App wrapper with AuthProvider
function AppWrapper() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </AuthProvider>
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
            <Suspense fallback={<LoadingFallback />}>
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
