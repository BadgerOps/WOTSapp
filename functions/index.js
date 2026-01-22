const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

// Import scheduled functions
const { uotdScheduler } = require('./uotdScheduler')

// Import geocoding functions
const { geocodeLocation, updateWeatherUnits } = require('./geocoding')

// Import weather checker functions
const {
  scheduledWeatherCheck,
  manualWeatherCheck,
  getCurrentWeather,
} = require('./weatherChecker')

// Import approval workflow functions
const {
  approveRecommendation,
  rejectRecommendation,
  getPendingCount,
  autoPublishPendingRecommendations,
} = require('./approvalWorkflow')

// Import approver notifications
const { onRecommendationCreated } = require('./approverNotifications')

// Import personnel auth functions
const { onPersonnelCreated } = require('./personnelAuth')

// Import timezone utilities
const { getConfiguredTimezone, formatTimestampForNotification } = require('./utils/timezone')

initializeApp()

const db = getFirestore()
const messaging = getMessaging()

// Export scheduled functions
exports.uotdScheduler = uotdScheduler

// Export geocoding functions
exports.geocodeLocation = geocodeLocation
exports.updateWeatherUnits = updateWeatherUnits

// Export weather checker functions
exports.scheduledWeatherCheck = scheduledWeatherCheck
exports.manualWeatherCheck = manualWeatherCheck
exports.getCurrentWeather = getCurrentWeather

// Export approval workflow functions
exports.approveRecommendation = approveRecommendation
exports.rejectRecommendation = rejectRecommendation
exports.getPendingCount = getPendingCount
exports.autoPublishPendingRecommendations = autoPublishPendingRecommendations

// Export approver notification trigger
exports.onRecommendationCreated = onRecommendationCreated

// Export personnel auth trigger
exports.onPersonnelCreated = onPersonnelCreated

// Send push notification when a new post is created
exports.onPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data.data()

  // Only send notifications for published posts
  if (post.status !== 'published') {
    console.log('Post is not published, skipping notification')
    return null
  }

  console.log('New post created:', post.title)

  // Get configured timezone for timestamp formatting
  const timezone = await getConfiguredTimezone(db)
  console.log(`Using timezone: ${timezone}`)

  // Get all users with FCM tokens
  const usersSnapshot = await db.collection('users').get()

  const tokens = []
  usersSnapshot.forEach((doc) => {
    const userData = doc.data()
    if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
      tokens.push(...userData.fcmTokens)
    }
  })

  if (tokens.length === 0) {
    console.log('No FCM tokens found, skipping notification')
    return null
  }

  console.log(`Sending notification to ${tokens.length} tokens`)

  const title = getNotificationTitle(post.type, post, timezone)
  const body = formatNotificationBody(post)

  // Build notification message with platform-specific configs
  const message = {
    notification: {
      title,
      body,
    },
    data: {
      postId: event.params.postId,
      type: post.type,
      title,  // Include in data for service worker fallback
      body,   // Include in data for service worker fallback
    },
    // Web push specific configuration
    webpush: {
      notification: {
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: event.params.postId,
        requireInteraction: false,
      },
      fcmOptions: {
        link: '/',
      },
    },
    // Apple Push Notification service configuration
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          badge: 1,
          sound: 'default',
        },
      },
    },
    // Android specific configuration
    android: {
      priority: 'high',
      notification: {
        icon: 'ic_notification',
        color: '#1e3a5f',
        channelId: 'wots_notifications',
        tag: event.params.postId,
      },
    },
    tokens: tokens,
  }

  try {
    const response = await messaging.sendEachForMulticast(message)
    console.log(`Successfully sent ${response.successCount} notifications`)

    // Log failures and remove invalid tokens
    if (response.failureCount > 0) {
      console.log(`${response.failureCount} notifications failed`)
      const invalidTokens = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code
          const errorMsg = resp.error?.message
          console.log(`Token ${idx} failed: ${errorCode} - ${errorMsg}`)
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx])
          }
        }
      })

      if (invalidTokens.length > 0) {
        console.log(`Removing ${invalidTokens.length} invalid tokens`)
        // Remove invalid tokens from users
        const batch = db.batch()
        usersSnapshot.forEach((doc) => {
          const userData = doc.data()
          if (userData.fcmTokens) {
            const validTokens = userData.fcmTokens.filter(
              (t) => !invalidTokens.includes(t)
            )
            if (validTokens.length !== userData.fcmTokens.length) {
              batch.update(doc.ref, { fcmTokens: validTokens })
            }
          }
        })
        await batch.commit()
      }
    }

    return response
  } catch (error) {
    console.error('Error sending notifications:', error)
    return null
  }
})

function getNotificationTitle(postType, post, timezone) {
  // Use the shared timezone-aware formatting function
  const timestamp = post.publishedAt
    ? formatTimestampForNotification(post.publishedAt, timezone)
    : formatTimestampForNotification(null, timezone)
  const timePrefix = `[${timestamp}] `

  switch (postType) {
    case 'announcement':
      return `${timePrefix}New Announcement`
    case 'uotd':
      // For UOTD, show the uniform number if available
      if (post.uniformNumber) {
        return `${timePrefix}Uniform #${post.uniformNumber}`
      }
      return `${timePrefix}UOTD Update`
    case 'schedule':
      return `${timePrefix}Schedule Update`
    default:
      return `${timePrefix}New Post`
  }
}

function formatNotificationBody(post) {
  const maxLength = 250
  let body = ''

  // For UOTD posts, include full uniform description and weather
  if (post.type === 'uotd') {
    // Add uniform name if available
    if (post.uniformName) {
      body = post.uniformName
    }

    // Add weather-based content if available (from approval workflow)
    if (post.weatherBased && post.content) {
      const weatherContent = post.content
      if (body) {
        body += '\n' + weatherContent
      } else {
        body = weatherContent
      }
    } else if (!body) {
      // Fall back to full content if no uniform name
      body = post.content || post.title
    }
  } else {
    // For non-UOTD posts, use title + content preview
    body = post.title

    if (post.content) {
      let preview = post.content.substring(0, 100).trim()

      if (post.content.length > 100 && preview.lastIndexOf(' ') > 50) {
        preview = preview.substring(0, preview.lastIndexOf(' '))
      }

      if (post.content.length > preview.length) {
        preview += '...'
      }

      body += '\n' + preview
    }
  }

  // Add admin note if present (at the end)
  if (post.adminNote && post.adminNote.trim()) {
    const notePrefix = '\nNote: '
    const remainingSpace = maxLength - body.length - notePrefix.length

    if (remainingSpace > 20) {
      let note = post.adminNote.trim()
      if (note.length > remainingSpace) {
        note = note.substring(0, remainingSpace - 3) + '...'
      }
      body += notePrefix + note
    }
  }

  // Ensure total length doesn't exceed max
  if (body.length > maxLength) {
    body = body.substring(0, maxLength - 3) + '...'
  }

  return body
}
