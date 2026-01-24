const Sentry = require('@sentry/node')

let initialized = false

/**
 * Initialize Sentry for Cloud Functions
 * Call once at module load time in index.js
 */
function initSentry() {
  if (initialized) return

  const dsn = process.env.SENTRY_DSN

  if (!dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization')
    return
  }

  const environment = process.env.SENTRY_ENVIRONMENT || 'development'

  Sentry.init({
    dsn,
    environment,

    // Integrations
    integrations: [
      // Send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleIntegration({ levels: ['log', 'warn', 'error'] }),
    ],

    // Enable logs to be sent to Sentry
    _experiments: {
      enableLogs: true,
    },

    // Performance monitoring (lower sample rate in production)
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Filter out expected errors
    beforeSend(event, hint) {
      const error = hint.originalException

      // Ignore HttpsError with permission-denied (expected auth failures)
      if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
        return null
      }

      // Ignore 'not-found' errors (expected for missing resources)
      if (error?.code === 'not-found') {
        return null
      }

      return event
    },
  })

  initialized = true
  console.log(`[Sentry] Initialized for Cloud Functions (${environment})`)
}

/**
 * Set user context from Firebase Auth
 */
function setUser(auth) {
  if (!initialized || !auth) return

  Sentry.setUser({
    id: auth.uid,
    email: auth.token?.email,
  })
}

/**
 * Clear user context
 */
function clearUser() {
  if (!initialized) return
  Sentry.setUser(null)
}

/**
 * Capture an error with context
 */
function captureError(error, context = {}) {
  if (!initialized) {
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
function addBreadcrumb(message, data = {}, category = 'function') {
  if (!initialized) return

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  })
}

/**
 * Wrap a callable function handler with Sentry error tracking
 * @param {Function} handler - The function handler (receives request)
 * @returns {Function} Wrapped handler
 */
function wrapCallable(handler) {
  return async (request) => {
    if (!initialized) {
      return handler(request)
    }

    // Set user context if authenticated
    if (request.auth) {
      setUser(request.auth)
      Sentry.setTag('function.type', 'callable')
    }

    try {
      return await handler(request)
    } catch (error) {
      // Don't capture HttpsError (these are intentional user-facing errors)
      const isHttpsError = error.constructor?.name === 'HttpsError'
      if (!isHttpsError) {
        Sentry.captureException(error)
      }
      throw error
    } finally {
      clearUser()
    }
  }
}

/**
 * Wrap a scheduled function handler with Sentry error tracking
 * @param {Function} handler - The function handler (receives event)
 * @param {string} name - Name of the scheduled function for logging
 * @returns {Function} Wrapped handler
 */
function wrapScheduled(handler, name) {
  return async (event) => {
    if (!initialized) {
      return handler(event)
    }

    Sentry.setTag('function.type', 'scheduled')
    Sentry.setTag('function.name', name)

    addBreadcrumb(`Starting scheduled function: ${name}`, {}, 'scheduled')

    try {
      const result = await handler(event)
      addBreadcrumb(`Completed scheduled function: ${name}`, { result }, 'scheduled')
      return result
    } catch (error) {
      Sentry.captureException(error)
      throw error
    }
  }
}

/**
 * Wrap a Firestore trigger handler with Sentry error tracking
 * @param {Function} handler - The function handler (receives event)
 * @param {string} name - Name of the trigger for logging
 * @returns {Function} Wrapped handler
 */
function wrapFirestoreTrigger(handler, name) {
  return async (event) => {
    if (!initialized) {
      return handler(event)
    }

    Sentry.setTag('function.type', 'firestore-trigger')
    Sentry.setTag('function.name', name)

    const documentPath = event.params
      ? Object.entries(event.params).map(([k, v]) => `${k}=${v}`).join(', ')
      : 'unknown'

    addBreadcrumb(`Firestore trigger: ${name}`, { documentPath }, 'firestore')

    try {
      return await handler(event)
    } catch (error) {
      Sentry.captureException(error)
      throw error
    }
  }
}

module.exports = {
  initSentry,
  setUser,
  clearUser,
  captureError,
  addBreadcrumb,
  wrapCallable,
  wrapScheduled,
  wrapFirestoreTrigger,
  Sentry,
}
