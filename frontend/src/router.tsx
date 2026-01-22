import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { AuthCallback } from '../components/auth/AuthCallback'
import { LoginForm } from '../components/auth/LoginForm'
import { PageSpinner } from '../components/LoadingStates'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Lazy load the dashboard for better performance
const AppDashboard = lazy(() => import('../App').then(m => ({ default: m.AppDashboard })))

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-600 text-sm">로딩 중...</p>
    </div>
  )
}

// Auth wrapper provides AuthProvider to all routes
function AuthWrapper() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </AuthProvider>
  )
}

// Protected route component - redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 text-sm">로그인 확인 중...</p>
      </div>
    )
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthWrapper />,
    children: [
      // Public routes
      {
        path: 'login',
        element: (
          <PublicOnlyRoute>
            <LoginForm />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'auth/callback',
        element: <AuthCallback />,
      },
      // Protected routes
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <AppDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
    ],
  },
])
