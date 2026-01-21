const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getWeatherData } = require('./utils/openweather')
const { findMatchingRule } = require('./utils/ruleEvaluator')
const {
  getConfiguredTimezone,
  getCurrentTimeInTimezone,
  getTodayInTimezone,
  determineTargetSlot,
} = require('./utils/timezone')

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

  // Fetch current weather
  const weather = await getWeatherData(lat, lon, units)

  // Update weather cache
  await db.doc('settings/weatherCache').set({
    current: weather.current,
    forecast: weather.forecast,
    location: {
      ...weather.location,
      name: location.coordinates.resolvedAddress,
    },
    fetchedAt: FieldValue.serverTimestamp(),
    expiresAt: weather.expiresAt,
  })

  // Find matching rule
  const matchedRule = findMatchingRule(rules, weather)
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

  // Create pending recommendation
  const recommendationData = {
    weather: {
      temperature: weather.current.temperature,
      humidity: weather.current.humidity,
      windSpeed: weather.current.windSpeed,
      uvIndex: weather.current.uvIndex,
      weatherMain: weather.current.weatherMain,
      precipitationChance: weather.forecast.precipitationChance,
      fetchedAt: weather.fetchedAt,
    },
    uniformId,
    uniformNumber: uniform.number,
    uniformName: uniform.name,
    matchedRuleId: matchedRule?.id || null,
    matchedRuleName: matchedRule?.name || 'Default',
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

  const docRef = await db.collection('weatherRecommendations').add(recommendationData)

  return {
    success: true,
    message: 'Weather recommendation created',
    recommendationId: docRef.id,
    weather: weather.current,
    recommendation: {
      uniformNumber: uniform.number,
      uniformName: uniform.name,
      matchedRule: matchedRule?.name || 'Default',
      targetSlot: slot,
      targetDate,
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
  async () => {
    const db = getFirestore()
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
  }
)

/**
 * Manual weather check - callable by uniform_admin or admin
 */
exports.manualWeatherCheck = onCall(async (request) => {
  const db = getFirestore()

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
})

/**
 * Get current weather (cached or fresh)
 * Callable by any authenticated user
 */
exports.getCurrentWeather = onCall(async (request) => {
  const db = getFirestore()

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
})
