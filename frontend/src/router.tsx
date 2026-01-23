// To re-enable auth protection: see git history for ProtectedRoute, PublicOnlyRoute
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
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

// App wrapper with AuthProvider (kept for components that use useAuth)
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
    path: '/',
    element: <AppWrapper />,
    children: [
      // Root redirects to dashboard
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      // Main app
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AppDashboard />
          </Suspense>
        ),
      },
      // Legacy routes redirect to dashboard
      {
        path: 'login',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'auth/*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
])