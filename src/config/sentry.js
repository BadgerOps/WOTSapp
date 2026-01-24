import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry for frontend error tracking and performance monitoring
 * Call this BEFORE ReactDOM.createRoot() in main.jsx
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  // Skip initialization if no DSN configured
  if (!dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization')
    return
  }

  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development'
  const release = import.meta.env.VITE_SENTRY_RELEASE || undefined
  const isDev = environment === 'development'

  Sentry.init({
    dsn,
    environment,
    release,

    // Integrations
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      // Send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
      // Session replay for debugging (only in production)
      ...(!isDev ? [Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      })] : []),
    ],

    // Enable logs to be sent to Sentry
    _experiments: {
      enableLogs: true,
    },

    // Performance monitoring sample rates
    // Lower in production to reduce costs
    tracesSampleRate: isDev ? 1.0 : 0.1,

    // Session replay sample rates
    replaysSessionSampleRate: isDev ? 0 : 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Filter out expected/noisy errors
    beforeSend(event, hint) {
      const error = hint.originalException
      const errorMessage = error?.message || event?.message || ''

      // Ignore auth popup errors (user closed popup, etc.)
      if (error?.code?.startsWith?.('auth/')) {
        const ignoredAuthCodes = [
          'auth/popup-closed-by-user',
          'auth/cancelled-popup-request',
          'auth/popup-blocked',
          'auth/user-cancelled',
        ]
        if (ignoredAuthCodes.includes(error.code)) {
          return null
        }
      }

      // Ignore network errors (offline, timeouts, etc.)
      if (error?.name === 'NetworkError' || errorMessage.includes('Failed to fetch')) {
        return null
      }

      // Ignore expected permission denied errors
      if (error?.code === 'permission-denied' || errorMessage.includes('Missing or insufficient permissions')) {
        return null
      }

      // Ignore service worker load failures (common transient errors)
      if (errorMessage.includes('sw.js load failed') || errorMessage.includes('Script load failed')) {
        return null
      }

      // Ignore Firebase/Google API transient errors
      if (errorMessage.includes('identitytoolkit.googleapis.com')) {
        return null
      }

      // Scrub sensitive data from headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['authorization']
        delete event.request.headers['Cookie']
        delete event.request.headers['cookie']
      }

      return event
    },

    // Don't send PII in breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Scrub sensitive URL params
      if (breadcrumb.data?.url) {
        try {
          const url = new URL(breadcrumb.data.url)
          url.searchParams.delete('token')
          url.searchParams.delete('key')
          url.searchParams.delete('apiKey')
          breadcrumb.data.url = url.toString()
        } catch {
          // URL parsing failed, leave as-is
        }
      }
      return breadcrumb
    },
  })

  console.log(`[Sentry] Initialized (${environment})`)
}

/**
 * Set user context for Sentry
 * Call this when user logs in/out
 */
export function setSentryUser(user, role) {
  if (!import.meta.env.VITE_SENTRY_DSN) return

  if (user) {
    Sentry.setUser({
      id: user.uid,
      email: user.email,
      username: user.displayName || undefined,
    })
    Sentry.setTag('user.role', role || 'user')
  } else {
    Sentry.setUser(null)
    Sentry.setTag('user.role', null)
  }
}

/**
 * Capture an error with additional context
 */
export function captureError(error, context = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.error('[Sentry disabled]', error, context)
    return
  }

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value)
    })
    Sentry.captureException(error)
  })
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(message, data = {}, category = 'app') {
  if (!import.meta.env.VITE_SENTRY_DSN) return

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  })
}

export { Sentry }
