/**
 * Shared timezone utilities for Firebase Functions
 * All functions should use settings/appConfig for timezone configuration
 */

const DEFAULT_TIMEZONE = 'America/New_York'

/**
 * Get the configured timezone from Firestore
 * @param {Object} db - Firestore instance
 * @returns {Promise<string>} IANA timezone string
 */
async function getConfiguredTimezone(db) {
  try {
    const configDoc = await db.doc('settings/appConfig').get()
    if (configDoc.exists && configDoc.data().timezone) {
      return configDoc.data().timezone
    }
  } catch (error) {
    console.warn('Failed to get configured timezone, using default:', error.message)
  }
  return DEFAULT_TIMEZONE
}

/**
 * Get current time in HHmm format for the specified timezone
 * @param {string} timezone - IANA timezone string
 * @returns {string} Time in HHmm format (e.g., '0930')
 */
function getCurrentTimeInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const hour = parts.find((p) => p.type === 'hour').value
  const minute = parts.find((p) => p.type === 'minute').value
  return hour + minute
}

/**
 * Get today's date string in the configured timezone (YYYY-MM-DD)
 * @param {string} timezone - IANA timezone string
 * @returns {string} Date in YYYY-MM-DD format
 */
function getTodayInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year').value
  const month = parts.find((p) => p.type === 'month').value
  const day = parts.find((p) => p.type === 'day').value
  return `${year}-${month}-${day}`
}

/**
 * Get current hour in the specified timezone
 * @param {string} timezone - IANA timezone string
 * @returns {number} Current hour (0-23)
 */
function getCurrentHourInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  return parseInt(parts.find((p) => p.type === 'hour').value, 10)
}

/**
 * Determine the target meal slot based on current time
 * @param {string} timezone - IANA timezone string
 * @returns {string} 'breakfast', 'lunch', or 'dinner'
 */
function determineTargetSlot(timezone) {
  const hour = getCurrentHourInTimezone(timezone)

  // Before 10 AM = breakfast, 10 AM - 3 PM = lunch, after 3 PM = dinner
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  return 'dinner'
}

/**
 * Check if a timestamp is today in the configured timezone
 * @param {Object|Date|string} timestamp - Firestore timestamp, Date, or ISO string
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} True if the timestamp is today
 */
function isToday(timestamp, timezone) {
  if (!timestamp) return false

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const timestampDay = `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}-${parts.find((p) => p.type === 'day').value}`

  return timestampDay === getTodayInTimezone(timezone)
}

/**
 * Format a timestamp for notification display in the configured timezone
 * @param {Object|Date|string|null} timestamp - Firestore timestamp, Date, ISO string, or null for current time
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted time string like "14:30 Jan 22"
 */
function formatTimestampForNotification(timestamp, timezone) {
  const date = timestamp
    ? timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp)
    : new Date()

  // Format hours and minutes
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const timeParts = timeFormatter.formatToParts(date)
  const hours = timeParts.find((p) => p.type === 'hour').value
  const minutes = timeParts.find((p) => p.type === 'minute').value

  // Format month and day
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
  })
  const dateParts = dateFormatter.formatToParts(date)
  const month = dateParts.find((p) => p.type === 'month').value
  const day = dateParts.find((p) => p.type === 'day').value

  return `${hours}:${minutes} ${month} ${day}`
}

module.exports = {
  DEFAULT_TIMEZONE,
  getConfiguredTimezone,
  getCurrentTimeInTimezone,
  getTodayInTimezone,
  getCurrentHourInTimezone,
  determineTargetSlot,
  isToday,
  formatTimestampForNotification,
}
