const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getWeatherData, getForecastForTimeWindow, getTwilightStatus } = require('./utils/openweather')
const { findMatchingRule } = require('./utils/ruleEvaluator')
const { evaluateAccessoryRules, getAccessoryRules } = require('./utils/accessoryRecommender')
const {
  getConfiguredTimezone,
  getCurrentTimeInTimezone,
  getTodayInTimezone,
  determineTargetSlot,
} = require('./utils/timezone')
const { wrapScheduled, wrapCallable, addBreadcrumb } = require('./utils/sentry')

/**
 * Check if there's already a pending or approved recommendation for today's slot
 * @param {Object} db - Firestore instance
 * @param {string} targetDate - Target date
 * @param {string} targetSlot - Target slot
 * @returns {Promise<Object|null>} Existing recommendation doc or null
 */
async function getExistingRecommendation(db, targetDate, targetSlot) {
  const snapshot = await db
    .collection('weatherRecommendations')
    .where('targetDate', '==', targetDate)
    .where('targetSlot', '==', targetSlot)
    .where('status', 'in', ['pending', 'approved'])
    .limit(1)
    .get()

  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
}

/**
 * Cancel an existing recommendation (mark as superseded)
 * @param {Object} db - Firestore instance
 * @param {string} recommendationId - ID of recommendation to cancel
 * @param {string} userId - User who is overriding
 */
async function cancelExistingRecommendation(db, recommendationId, userId) {
  await db.collection('weatherRecommendations').doc(recommendationId).update({
    status: 'superseded',
    supersededBy: userId,
    supersededAt: FieldValue.serverTimestamp(),
  })
}

/**
 * Core weather check logic
 * @param {Object} db - Firestore instance
 * @param {string} triggeredBy - 'scheduled' or 'manual'
 * @param {string} userId - User ID who triggered (for manual)
 * @param {string} targetSlot - Override target slot (optional)
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
 * @param {boolean} force - If true, supersede existing recommendation for this slot
 * @returns {Promise<Object>} Result of the check
 */
async function performWeatherCheck(db, triggeredBy, userId = null, targetSlot = null, timezone = null, force = false) {
  // Get timezone from config if not provided
  const tz = timezone || (await getConfiguredTimezone(db))

  // Get location settings
  const locationDoc = await db.doc('settings/weatherLocation').get()
  if (!locationDoc.exists || !locationDoc.data().coordinates) {
    throw new Error('Weather location not configured')
  }

  const location = locationDoc.data()
  const { lat, lon } = location.coordinates
  const units = location.units || 'imperial'

  // Get weather rules
  const rulesDoc = await db.doc('settings/weatherRules').get()
  if (!rulesDoc.exists) {
    throw new Error('Weather rules not configured')
  }

  const rulesData = rulesDoc.data()
  const rules = rulesData.rules || []
  const defaultUniformId = rulesData.defaultUniformId

  // Fetch current weather and forecast
  const weather = await getWeatherData(lat, lon, units)

  // Get forecast for 30-90 minutes ahead (when students will actually be outside)
  const forecastWindow = getForecastForTimeWindow(weather.forecast.hourly, 30, 90)

  // Get twilight status for accessory recommendations
  const twilightStatus = getTwilightStatus(weather.astronomy)

  // Update weather cache (include astronomy data)
  await db.doc('settings/weatherCache').set({
    current: weather.current,
    forecast: weather.forecast,
    astronomy: weather.astronomy,
    location: {
      ...weather.location,
      name: location.coordinates.resolvedAddress,
    },
    fetchedAt: FieldValue.serverTimestamp(),
    expiresAt: weather.expiresAt,
  })

  // Use forecast data for rule matching (30-90 minutes ahead)
  // Fall back to current weather if forecast not available
  const weatherForRules = forecastWindow
    ? {
        current: {
          temperature: forecastWindow.temperature,
          humidity: forecastWindow.humidity,
          windSpeed: forecastWindow.windSpeed,
          weatherMain: forecastWindow.weatherMain,
          // UV index not available hourly, use current or daily max
          uvIndex: weather.current.uvIndex,
        },
        forecast: {
          precipitationChance: forecastWindow.precipitationChance,
        },
      }
    : weather

  // Find matching rule using forecast data
  const matchedRule = findMatchingRule(rules, weatherForRules)
  const uniformId = matchedRule?.uniformId || defaultUniformId

  if (!uniformId) {
    return {
      success: true,
      message: 'No matching rule and no default uniform configured',
      weather: weather.current,
      recommendation: null,
    }
  }

  // Get uniform details
  const uniformDoc = await db.collection('uniforms').doc(uniformId).get()
  if (!uniformDoc.exists) {
    throw new Error(`Uniform ${uniformId} not found`)
  }

  const uniform = uniformDoc.data()
  const slot = targetSlot || determineTargetSlot(tz)
  const targetDate = getTodayInTimezone(tz)

  // Evaluate accessory rules (PT belt, fleece, watch cap, etc.)
  const accessoryRules = await getAccessoryRules(db)
  const weatherForAccessories = forecastWindow
    ? {
        temperature: forecastWindow.temperature,
        humidity: forecastWindow.humidity,
        windSpeed: forecastWindow.windSpeed,
        weatherMain: forecastWindow.weatherMain,
        precipitationChance: forecastWindow.precipitationChance,
      }
    : {
        temperature: weather.current.temperature,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
        weatherMain: weather.current.weatherMain,
        precipitationChance: weather.forecast.precipitationChance,
      }
  const accessoryRecommendation = evaluateAccessoryRules(
    weatherForAccessories,
    twilightStatus,
    accessoryRules
  )

  console.log(
    `Accessory recommendation: ${accessoryRecommendation.accessories.length} accessories, ` +
      `uniform override: ${accessoryRecommendation.uniformOverride?.name || 'none'}, ` +
      `twilight: ${twilightStatus?.isTwilight}, nighttime: ${twilightStatus?.isNighttime}`
  )

  // Check for existing recommendation
  const existingRec = await getExistingRecommendation(db, targetDate, slot)
  if (existingRec) {
    if (force && userId) {
      // Supersede the existing recommendation
      await cancelExistingRecommendation(db, existingRec.id, userId)
      console.log(`Superseded existing recommendation ${existingRec.id} for ${targetDate} ${slot}`)
    } else {
      return {
        success: true,
        message: `Recommendation already exists for ${targetDate} ${slot}`,
        weather: weather.current,
        recommendation: null,
        skipped: true,
        existingRecommendationId: existingRec.id,
      }
    }
  }

  // Create pending recommendation using forecast data (30-90 min ahead)
  // This reflects the weather students will experience, not current conditions
  const forecastWeather = forecastWindow
    ? {
        temperature: forecastWindow.temperature,
        humidity: forecastWindow.humidity,
        windSpeed: forecastWindow.windSpeed,
        uvIndex: weather.current.uvIndex, // UV not available hourly
        weatherMain: forecastWindow.weatherMain,
        precipitationChance: forecastWindow.precipitationChance,
        // Forecast metadata
        forecastTime: forecastWindow.forecastTime,
        forecastWindowStart: forecastWindow.windowStart,
        forecastWindowEnd: forecastWindow.windowEnd,
        hoursUsed: forecastWindow.hoursUsed,
        isForecast: true,
      }
    : {
        temperature: weather.current.temperature,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
        uvIndex: weather.current.uvIndex,
        weatherMain: weather.current.weatherMain,
        precipitationChance: weather.forecast.precipitationChance,
        isForecast: false,
      }

  // Determine final uniform (may be overridden by accessory rules like ECWS for rain)
  const finalUniformId = accessoryRecommendation.uniformOverride
    ? null // Will use override name instead of ID
    : uniformId
  const finalUniformName = accessoryRecommendation.uniformOverride
    ? accessoryRecommendation.uniformOverride.name
    : uniform.name
  const finalUniformNumber = accessoryRecommendation.uniformOverride
    ? null // Override uniforms may not have a number
    : uniform.number

  const recommendationData = {
    // Forecast weather (30-90 min ahead) - primary for decision making
    weather: {
      ...forecastWeather,
      fetchedAt: weather.fetchedAt,
    },
    // Current weather for reference/display
    currentWeather: {
      temperature: weather.current.temperature,
      humidity: weather.current.humidity,
      windSpeed: weather.current.windSpeed,
      uvIndex: weather.current.uvIndex,
      weatherMain: weather.current.weatherMain,
      precipitation: weather.current.precipitation,
    },
    // Astronomy data for twilight display
    astronomy: weather.astronomy,
    twilightStatus: {
      isTwilight: twilightStatus?.isTwilight || false,
      isNighttime: twilightStatus?.isNighttime || false,
      sunrise: twilightStatus?.sunrise || null,
      sunset: twilightStatus?.sunset || null,
    },
    // Uniform recommendation
    uniformId: finalUniformId,
    uniformNumber: finalUniformNumber,
    uniformName: finalUniformName,
    uniformOverride: accessoryRecommendation.uniformOverride || null,
    matchedRuleId: matchedRule?.id || null,
    matchedRuleName: matchedRule?.name || 'Default',
    // Accessory recommendations
    accessories: accessoryRecommendation.accessories,
    accessoryMatchedRules: accessoryRecommendation.matchedRules,
    // Status and metadata
    status: 'pending',
    targetSlot: slot,
    targetDate,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    postId: null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    createdBy: triggeredBy === 'manual' ? userId : 'system',
  }

  // Log which weather data was used
  if (forecastWindow) {
    console.log(
      `Using forecast for ${forecastWindow.windowStart} to ${forecastWindow.windowEnd}: ` +
        `${forecastWindow.temperature}°, ${forecastWindow.precipitationChance}% precip`
    )
  } else {
    console.log('Forecast window not available, using current weather')
  }

  const docRef = await db.collection('weatherRecommendations').add(recommendationData)

  return {
    success: true,
    message: forecastWindow
      ? 'Weather recommendation created (based on 30-90 min forecast)'
      : 'Weather recommendation created (forecast unavailable, used current)',
    recommendationId: docRef.id,
    weather: weather.current,
    forecastWeather: forecastWindow || null,
    astronomy: weather.astronomy,
    recommendation: {
      uniformNumber: finalUniformNumber,
      uniformName: finalUniformName,
      uniformOverride: accessoryRecommendation.uniformOverride || null,
      accessories: accessoryRecommendation.accessories,
      matchedRule: matchedRule?.name || 'Default',
      targetSlot: slot,
      targetDate,
      usedForecast: !!forecastWindow,
      twilight: twilightStatus?.isTwilight || false,
      nighttime: twilightStatus?.isNighttime || false,
    },
  }
}

/**
 * Scheduled weather check - runs at configured times
 * Schedule aligns to enabled slots in settings/uotdSchedule
 * Timezone is read from settings/appConfig
 */
exports.scheduledWeatherCheck = onSchedule(
  {
    schedule: '* * * * *', // Every minute; logic below gates by configured timezone and UOTD schedule
  },
  wrapScheduled(async () => {
    const db = getFirestore()
    addBreadcrumb('Starting scheduled weather check', {}, 'weather')
    try {
      const timezone = await getConfiguredTimezone(db)
      const currentTime = getCurrentTimeInTimezone(timezone)
      const scheduleDoc = await db.doc('settings/uotdSchedule').get()
      const slots = scheduleDoc.exists ? scheduleDoc.data().slots : null

      if (!slots) {
        return { skipped: true, reason: 'UOTD schedule not configured', currentTime, timezone }
      }

      const matchingSlots = Object.entries(slots).filter(([, slot]) => {
        if (!slot || !slot.enabled) return false
        return slot.time === currentTime
      })

      if (matchingSlots.length === 0) {
        return { skipped: true, currentTime, timezone }
      }

      const results = []
      for (const [slotKey] of matchingSlots) {
        const result = await performWeatherCheck(db, 'scheduled', null, slotKey, timezone)
        results.push({ slotKey, result })
      }

      console.log('Scheduled weather check completed:', results)
      return { processed: results.length, currentTime, timezone, results }
    } catch (error) {
      console.error('Scheduled weather check failed:', error)
      throw error
    }
  }, 'scheduledWeatherCheck')
)

/**
 * Manual weather check - callable by uniform_admin or admin
 */
exports.manualWeatherCheck = onCall(wrapCallable(async (request) => {
  const db = getFirestore()
  addBreadcrumb('Manual weather check initiated', { targetSlot: request.data?.targetSlot }, 'weather')

  // Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  // Check authorization
  const userDoc = await db.collection('users').doc(request.auth.uid).get()
  const userRole = userDoc.exists ? userDoc.data().role : 'user'

  if (userRole !== 'admin' && userRole !== 'uniform_admin') {
    throw new HttpsError(
      'permission-denied',
      'Must be admin or uniform_admin to trigger weather check'
    )
  }

  const { targetSlot, force } = request.data || {}

  try {
    // Timezone is fetched inside performWeatherCheck from appConfig
    // Pass force flag to allow overriding existing recommendations
    const result = await performWeatherCheck(db, 'manual', request.auth.uid, targetSlot, null, force === true)
    return result
  } catch (error) {
    console.error('Manual weather check failed:', error)
    throw new HttpsError('internal', error.message || 'Weather check failed')
  }
}))

/**
 * Get current weather (cached or fresh)
 * Callable by any authenticated user
 */
exports.getCurrentWeather = onCall(wrapCallable(async (request) => {
  const db = getFirestore()
  addBreadcrumb('Get current weather requested', {}, 'weather')

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  // Check cache first
  const cacheDoc = await db.doc('settings/weatherCache').get()
  if (cacheDoc.exists) {
    const cache = cacheDoc.data()
    const expiresAt = new Date(cache.expiresAt)

    if (expiresAt > new Date()) {
      return {
        success: true,
        weather: cache.current,
        forecast: cache.forecast,
        astronomy: cache.astronomy || null,
        location: cache.location,
        cached: true,
        fetchedAt: cache.fetchedAt,
      }
    }
  }

  // Cache expired or doesn't exist, fetch fresh
  const locationDoc = await db.doc('settings/weatherLocation').get()
  if (!locationDoc.exists || !locationDoc.data().coordinates) {
    throw new HttpsError('failed-precondition', 'Weather location not configured')
  }

  const location = locationDoc.data()
  const { lat, lon } = location.coordinates
  const units = location.units || 'imperial'

  try {
    const weather = await getWeatherData(lat, lon, units)

    // Update cache
    await db.doc('settings/weatherCache').set({
      current: weather.current,
      forecast: weather.forecast,
      astronomy: weather.astronomy,
      location: {
        ...weather.location,
        name: location.coordinates.resolvedAddress,
      },
      fetchedAt: FieldValue.serverTimestamp(),
      expiresAt: weather.expiresAt,
    })

    return {
      success: true,
      weather: weather.current,
      forecast: weather.forecast,
      astronomy: weather.astronomy,
      location: {
        ...weather.location,
        name: location.coordinates.resolvedAddress,
      },
      cached: false,
      fetchedAt: weather.fetchedAt,
    }
  } catch (error) {
    console.error('Failed to fetch weather:', error)
    throw new HttpsError('internal', 'Failed to fetch weather data')
  }
}))
