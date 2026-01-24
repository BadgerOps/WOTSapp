import { useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { useAuth } from '../../contexts/AuthContext'
import { setSentryUser } from '../../config/sentry'

/**
 * Inner component that syncs auth state to Sentry
 * Must be inside AuthProvider to access useAuth
 */
function SentryUserSync({ children }) {
  const { user, userRole } = useAuth()

  useEffect(() => {
    setSentryUser(user, userRole)
  }, [user, userRole])

  return children
}

/**
 * Fallback UI shown when an error occurs
 */
function ErrorFallback({ error, componentStack, resetError }) {
  const isDev = import.meta.env.DEV

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-6">
            We've been notified and are working to fix the issue.
            Please try refreshing the page.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-wots-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>

            {resetError && (
              <button
                onClick={resetError}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>

          {/* Show error details in development only */}
          {isDev && error && (
            <div className="mt-6 text-left">
              <details className="text-sm">
                <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                  Error Details (dev only)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded-md overflow-auto">
                  <p className="text-red-600 font-mono text-xs mb-2">
                    {error.toString()}
                  </p>
                  {componentStack && (
                    <pre className="text-gray-600 text-xs whitespace-pre-wrap">
                      {componentStack}
                    </pre>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Error boundary component that wraps the app
 * Catches React errors and reports them to Sentry
 *
 * Usage in main.jsx:
 * <SentryErrorBoundary>
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * </SentryErrorBoundary>
 */
export function SentryErrorBoundary({ children }) {
  // If Sentry is not configured, just render children with basic error boundary
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return children
  }

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, componentStack, resetError }) => (
        <ErrorFallback
          error={error}
          componentStack={componentStack}
          resetError={resetError}
        />
      )}
      beforeCapture={(scope) => {
        scope.setTag('error.boundary', 'react')
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}

/**
 * Wrapper that provides both error boundary and user context sync
 * Use this when children are inside AuthProvider
 */
export function SentryProvider({ children }) {
  return (
    <SentryErrorBoundary>
      <SentryUserSync>
        {children}
      </SentryUserSync>
    </SentryErrorBoundary>
  )
}

export default SentryErrorBoundary
