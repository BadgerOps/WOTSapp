/**
 * Frontend timezone utilities
 * Uses the configured timezone from useAppConfig() for consistent time handling
 *
 * All date/time calculations in the app should use these utilities
 * to ensure consistent behavior regardless of the user's browser timezone.
 */

export const DEFAULT_TIMEZONE = 'America/New_York'

/**
 * Get today's date string in the specified timezone (YYYY-MM-DD)
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getTodayInTimezone(timezone = DEFAULT_TIMEZONE) {
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
 * Get tomorrow's date string in the specified timezone (YYYY-MM-DD)
 * @param {string} timezone - IANA timezone string
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getTomorrowInTimezone(timezone = DEFAULT_TIMEZONE) {
  // Get tomorrow by adding 24 hours to current time
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(tomorrow)
  const year = parts.find((p) => p.type === 'year').value
  const month = parts.find((p) => p.type === 'month').value
  const day = parts.find((p) => p.type === 'day').value
  return `${year}-${month}-${day}`
}

/**
 * Get current hour in the specified timezone (0-23)
 * @param {string} timezone - IANA timezone string
 * @returns {number} Current hour (0-23)
 */
export function getCurrentHourInTimezone(timezone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  return parseInt(parts.find((p) => p.type === 'hour').value, 10)
}

/**
 * Get current minute in the specified timezone (0-59)
 * @param {string} timezone - IANA timezone string
 * @returns {number} Current minute (0-59)
 */
export function getCurrentMinuteInTimezone(timezone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    minute: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  return parseInt(parts.find((p) => p.type === 'minute').value, 10)
}

/**
 * Get current time as total minutes from midnight in the specified timezone
 * Useful for comparing with shift start/end times
 * @param {string} timezone - IANA timezone string
 * @returns {number} Total minutes from midnight (0-1439)
 */
export function getCurrentTimeMinutesInTimezone(timezone = DEFAULT_TIMEZONE) {
  const hour = getCurrentHourInTimezone(timezone)
  const minute = getCurrentMinuteInTimezone(timezone)
  return hour * 60 + minute
}

/**
 * Get current time in HH:MM format for the specified timezone
 * @param {string} timezone - IANA timezone string
 * @returns {string} Time in HH:MM format (e.g., '09:30')
 */
export function getCurrentTimeInTimezone(timezone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const hour = parts.find((p) => p.type === 'hour').value
  const minute = parts.find((p) => p.type === 'minute').value
  return `${hour}:${minute}`
}

/**
 * Parse a time string (HH:MM) into total minutes from midnight
 * @param {string} timeStr - Time in HH:MM format (e.g., '20:00')
 * @returns {number} Total minutes from midnight
 */
export function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Check if current time is within a shift window (handles overnight shifts)
 * @param {string} shiftStart - Start time in HH:MM format (e.g., '20:00')
 * @param {string} shiftEnd - End time in HH:MM format (e.g., '01:00')
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} True if current time is within the shift window
 */
export function isWithinShiftWindow(shiftStart, shiftEnd, timezone = DEFAULT_TIMEZONE) {
  const currentMinutes = getCurrentTimeMinutesInTimezone(timezone)
  const startMinutes = parseTimeToMinutes(shiftStart)
  const endMinutes = parseTimeToMinutes(shiftEnd)

  // Handle overnight shifts (e.g., 20:00-01:00 where end < start)
  if (endMinutes < startMinutes) {
    // Shift spans midnight: window is from start to 23:59 OR 00:00 to end
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  } else {
    // Normal shift within same day
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }
}

/**
 * Check if a shift has not started yet (is upcoming)
 * @param {string} shiftStart - Start time in HH:MM format (e.g., '20:00')
 * @param {string} shiftEnd - End time in HH:MM format (e.g., '01:00')
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} True if the shift hasn't started yet
 */
export function isShiftUpcoming(shiftStart, shiftEnd, timezone = DEFAULT_TIMEZONE) {
  const currentMinutes = getCurrentTimeMinutesInTimezone(timezone)
  const startMinutes = parseTimeToMinutes(shiftStart)
  const endMinutes = parseTimeToMinutes(shiftEnd)

  // If within the shift window, it's not upcoming
  if (isWithinShiftWindow(shiftStart, shiftEnd, timezone)) {
    return false
  }

  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    // For overnight shift, it's upcoming if we're before the start time
    // and not in the early morning hours after midnight
    return currentMinutes < startMinutes && currentMinutes > endMinutes
  } else {
    // Normal shift: upcoming if before start
    return currentMinutes < startMinutes
  }
}

/**
 * Check if a date string (YYYY-MM-DD) is today in the specified timezone
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} True if the date is today
 */
export function isDateToday(dateStr, timezone = DEFAULT_TIMEZONE) {
  return dateStr === getTodayInTimezone(timezone)
}

/**
 * Check if a date string (YYYY-MM-DD) is tomorrow in the specified timezone
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} True if the date is tomorrow
 */
export function isDateTomorrow(dateStr, timezone = DEFAULT_TIMEZONE) {
  return dateStr === getTomorrowInTimezone(timezone)
}

/**
 * Check if a date string (YYYY-MM-DD) is in the past in the specified timezone
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} True if the date is before today
 */
export function isDatePast(dateStr, timezone = DEFAULT_TIMEZONE) {
  return dateStr < getTodayInTimezone(timezone)
}

/**
 * Get the day of week for a date in the specified timezone
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Day of week (e.g., 'Monday', 'Tuesday')
 */
export function getDayOfWeekInTimezone(dateStr, timezone = DEFAULT_TIMEZONE) {
  // Create date at noon to avoid DST issues
  const date = new Date(dateStr + 'T12:00:00')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  })
  return formatter.format(date)
}
