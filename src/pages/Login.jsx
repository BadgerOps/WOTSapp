import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authLog, isDebugEnabled, setDebugEnabled } from '../lib/authDebugger'
import DebugPanel from '../components/common/DebugPanel'

export default function Login() {
  const { signInWithGoogle, authError, clearAuthError } = useAuth()
  const [error, setError] = useState(null)

  // Combine local error and auth context error
  const displayError = error || authError
  const [loading, setLoading] = useState(false)
  const [debugEnabled, setDebugEnabledState] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  useEffect(() => {
    // Check if debug was previously enabled
    setDebugEnabledState(isDebugEnabled())
  }, [])

  useEffect(() => {
    authLog('Login', 'Login page mounted', {
      url: window.location.href,
      referrer: document.referrer,
    })
  }, [])

  function handleDebugToggle(e) {
    const enabled = e.target.checked
    setDebugEnabledState(enabled)
    setDebugEnabled(enabled)
    if (enabled) {
      authLog('Login', 'Debug logging enabled by user')
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    clearAuthError() // Clear any previous auth errors from context
    setLoading(true)
    authLog('Login', 'Sign-in button clicked')

    try {
      await signInWithGoogle()
      authLog('Login', 'signInWithGoogle() returned successfully')
    } catch (err) {
      authLog('Login', 'Sign-in failed', {
        code: err.code,
        message: err.message,
        name: err.name,
      })
      // Show more detailed error for debugging
      const errorMessage = err.code
        ? `${err.code}: ${err.message}`
        : err.message || 'Failed to sign in. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">WOTS</h1>
          <p className="text-primary-200">Student Progress Application</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 text-center mb-6">
            Welcome
          </h2>

          {displayError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {displayError}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <p className="mt-6 text-center text-sm text-gray-500">
            Sign in with your authorized Google account
          </p>

          {/* Debug logging toggle */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={debugEnabled}
                onChange={handleDebugToggle}
                className="w-3 h-3"
              />
              Enable debug logging
            </label>
            {debugEnabled && (
              <button
                onClick={() => setShowDebugPanel(true)}
                className="mt-2 w-full text-xs text-blue-500 hover:text-blue-600"
              >
                View Debug Logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && <DebugPanel onClose={() => setShowDebugPanel(false)} />}
    </div>
  )
}
