const { onSchedule } = require('firebase-functions/v2/scheduler')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const {
  getConfiguredTimezone,
  getCurrentTimeInTimezone,
  isToday,
} = require('./utils/timezone')
const { wrapScheduled, addBreadcrumb } = require('./utils/sentry')

/**
 * Scheduled function that runs every minute to check for UOTD posts to create
 * Reads timezone from settings/appConfig
 */
exports.uotdScheduler = onSchedule('* * * * *', wrapScheduled(async () => {
  const db = getFirestore()
  addBreadcrumb('UOTD scheduler running', {}, 'uotd')

  console.log('UOTD Scheduler running...')

  // Get timezone from app config
  const timezone = await getConfiguredTimezone(db)

  // Get schedule config
  const scheduleDoc = await db.collection('settings').doc('uotdSchedule').get()

  if (!scheduleDoc.exists) {
    console.log('No UOTD schedule configured')
    return null
  }

  const schedule = scheduleDoc.data()
  const currentTime = getCurrentTimeInTimezone(timezone)

  console.log(`Current time in ${timezone}: ${currentTime}`)

  if (!schedule.slots) {
    console.log('No slots configured')
    return null
  }

  // Check if weather rules are configured - if so, defer to weather system
  const weatherRulesDoc = await db.doc('settings/weatherRules').get()
  const hasActiveWeatherRules =
    weatherRulesDoc.exists && weatherRulesDoc.data().rules?.length > 0

  if (hasActiveWeatherRules) {
    console.log(
      'Weather rules are active - deferring UOTD creation to weather system',
    )
    return null
  }

  // Log enabled slots for debugging
  const enabledSlots = Object.entries(schedule.slots)
    .filter(([, slot]) => slot.enabled)
    .map(([key, slot]) => `${key}@${slot.time}`)
  console.log(`Enabled slots: ${enabledSlots.length > 0 ? enabledSlots.join(', ') : 'none'}`)

  // Process each slot
  for (const [slotKey, slot] of Object.entries(schedule.slots)) {
    // Skip if not enabled
    if (!slot.enabled) {
      continue
    }

    // Skip if no uniform selected
    if (!slot.uniformId) {
      console.log(`Slot ${slotKey}: No uniform selected, skipping`)
      continue
    }

    // Skip if time doesn't match
    if (slot.time !== currentTime) {
      continue
    }

    // Skip if already fired today
    if (isToday(slot.lastFired, timezone)) {
      console.log(`Slot ${slotKey}: Already fired today, skipping`)
      continue
    }

    console.log(`Slot ${slotKey}: Time match! Creating UOTD post...`)

    try {
      // Get uniform data
      const uniformDoc = await db.collection('uniforms').doc(slot.uniformId).get()

      if (!uniformDoc.exists) {
        console.error(`Slot ${slotKey}: Uniform ${slot.uniformId} not found`)
        continue
      }

      const uniform = uniformDoc.data()

      // Create the UOTD post
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const post = {
        type: 'uotd',
        title: `Uniform of the Day: ${uniform.number} - ${uniform.name}`,
        content: uniform.description || '',
        uniformId: slot.uniformId,
        uniformNumber: uniform.number,
        uniformName: uniform.name,
        targetSlot: slotKey,
        targetDate: todayStr,
        status: 'published',
        scheduledSlot: slotKey, // Keep for backwards compatibility
        createdAt: FieldValue.serverTimestamp(),
        publishedAt: now.toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system',
      }

      await db.collection('posts').add(post)
      console.log(`Slot ${slotKey}: UOTD post created successfully`)

      // Update lastFired timestamp
      await db.collection('settings').doc('uotdSchedule').update({
        [`slots.${slotKey}.lastFired`]: FieldValue.serverTimestamp(),
      })
      console.log(`Slot ${slotKey}: lastFired updated`)
    } catch (error) {
      console.error(`Slot ${slotKey}: Error creating UOTD post:`, error)
    }
  }

  return null
}, 'uotdScheduler'))
