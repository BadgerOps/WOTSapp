/**
 * Auth Debugger - Helps diagnose PWA authentication issues
 * Logs are persisted to localStorage so they survive page reloads
 */

const DEBUG_KEY = 'wots_auth_debug_log'
const DEBUG_ENABLED_KEY = 'wots_debug_enabled'
const MAX_LOGS = 100

export function isDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

export function setDebugEnabled(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(DEBUG_ENABLED_KEY, 'true')
      console.log('[AuthDebug] Debug logging enabled')
    } else {
      localStorage.removeItem(DEBUG_ENABLED_KEY)
      console.log('[AuthDebug] Debug logging disabled')
    }
  } catch (e) {
    console.warn('[AuthDebug] Failed to set debug state:', e)
  }
}

export function getAuthLogs() {
  try {
    const logs = localStorage.getItem(DEBUG_KEY)
    return logs ? JSON.parse(logs) : []
  } catch {
    return []
  }
}

export function clearAuthLogs() {
  localStorage.removeItem(DEBUG_KEY)
  console.log('[AuthDebug] Logs cleared')
}

export function authLog(category, message, data = null) {
  // Only log if debug is enabled
  if (!isDebugEnabled()) {
    return
  }

  const timestamp = new Date().toISOString()
  const entry = {
    timestamp,
    category,
    message,
    data: data ? JSON.stringify(data) : null,
  }

  // Log to console
  const consoleMsg = `[${category}] ${message}`
  if (data) {
    console.log(consoleMsg, data)
  } else {
    console.log(consoleMsg)
  }

  // Persist to localStorage
  try {
    const logs = getAuthLogs()
    logs.push(entry)
    // Keep only last N logs
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS)
    }
    localStorage.setItem(DEBUG_KEY, JSON.stringify(logs))
  } catch (e) {
    console.warn('[AuthDebug] Failed to persist log:', e)
  }
}

export function printAuthLogs() {
  const logs = getAuthLogs()
  console.group('=== Auth Debug Logs ===')
  logs.forEach((log) => {
    const dataStr = log.data ? ` | ${log.data}` : ''
    console.log(`${log.timestamp} [${log.category}] ${log.message}${dataStr}`)
  })
  console.groupEnd()
  return logs
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  window.authDebug = {
    getLogs: getAuthLogs,
    printLogs: printAuthLogs,
    clearLogs: clearAuthLogs,
  }
}
