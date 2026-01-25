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

/**
 * Format a Date object as a time string in the specified timezone
 * @param {Date} date - JavaScript Date object
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted time (e.g., '8:30 PM')
 */
export function formatTimeInTimezone(date, timezone = DEFAULT_TIMEZONE) {
  if (!date) return '--:--'
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format a Date object as a short date string in the specified timezone
 * @param {Date} date - JavaScript Date object
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted date (e.g., 'Fri, Jan 24')
 */
export function formatShortDateInTimezone(date, timezone = DEFAULT_TIMEZONE) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a Date object as a full date string in the specified timezone
 * @param {Date} date - JavaScript Date object
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted date (e.g., 'Friday, January 24, 2026')
 */
export function formatFullDateInTimezone(date, timezone = DEFAULT_TIMEZONE) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format a Date object as date and time in the specified timezone
 * @param {Date} date - JavaScript Date object
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted date and time (e.g., 'Jan 24, 2026, 8:30 PM')
 */
export function formatDateTimeInTimezone(date, timezone = DEFAULT_TIMEZONE) {
  if (!date) return ''
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Get date string (YYYY-MM-DD) for a Date object in the specified timezone
 * @param {Date} date - JavaScript Date object
 * @param {string} timezone - IANA timezone string
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getDateStringInTimezone(date, timezone = DEFAULT_TIMEZONE) {
  if (!date) return ''
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((p) => p.type === 'year').value
  const month = parts.find((p) => p.type === 'month').value
  const day = parts.find((p) => p.type === 'day').value
  return `${year}-${month}-${day}`
}

/**
 * Get start of day for a date string in the specified timezone
 * Returns a Date object representing midnight of that date in the timezone
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {Date} Date object at start of day in the specified timezone
 */
export function getStartOfDayInTimezone(dateStr, timezone = DEFAULT_TIMEZONE) {
  // Parse the date parts
  const [year, month, day] = dateStr.split('-').map(Number)

  // Create a date at noon UTC on that date (to avoid DST issues)
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  // Get the timezone offset for that date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Get the parts to understand the offset
  const parts = formatter.formatToParts(noonUtc)
  const tzHour = parseInt(parts.find(p => p.type === 'hour').value, 10)
  const tzDay = parseInt(parts.find(p => p.type === 'day').value, 10)

  // Calculate offset (noon UTC vs noon in timezone)
  let offsetHours = tzHour - 12
  if (tzDay > day) offsetHours += 24
  else if (tzDay < day) offsetHours -= 24

  // Create start of day: midnight in the target timezone
  // If timezone is UTC-5 (EST), midnight EST = 5:00 UTC
  const startOfDay = new Date(Date.UTC(year, month - 1, day, -offsetHours, 0, 0, 0))

  return startOfDay
}

/**
 * Get end of day for a date string in the specified timezone
 * Returns a Date object representing 23:59:59.999 of that date in the timezone
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {Date} Date object at end of day in the specified timezone
 */
export function getEndOfDayInTimezone(dateStr, timezone = DEFAULT_TIMEZONE) {
  const startOfDay = getStartOfDayInTimezone(dateStr, timezone)
  // Add 24 hours minus 1 millisecond
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)
}
