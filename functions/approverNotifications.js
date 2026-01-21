const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

/**
 * Send push notification to uniform_admins when a new weather recommendation is created
 */
exports.onRecommendationCreated = onDocumentCreated(
  'weatherRecommendations/{recommendationId}',
  async (event) => {
    const db = getFirestore()
    const messaging = getMessaging()

    const recommendation = event.data.data()

    // Only notify for pending recommendations
    if (recommendation.status !== 'pending') {
      console.log('Recommendation is not pending, skipping notification')
      return null
    }

    console.log('New weather recommendation created:', event.params.recommendationId)

    // Get all uniform_admins and admins
    const usersSnapshot = await db
      .collection('users')
      .where('role', 'in', ['admin', 'uniform_admin'])
      .get()

    const tokens = []
    usersSnapshot.forEach((doc) => {
      const userData = doc.data()
      if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
        tokens.push(...userData.fcmTokens)
      }
    })

    if (tokens.length === 0) {
      console.log('No FCM tokens found for approvers')
      return null
    }

    console.log(`Sending notification to ${tokens.length} approver tokens`)

    // Format current timestamp (24hr format)
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const day = now.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[now.getMonth()]
    const timestamp = `${hours}:${minutes} ${month} ${day}`

    // Build notification message
    const tempDisplay = `${Math.round(recommendation.weather.temperature)}°`
    const conditions = recommendation.weather.weatherMain || 'Clear'
    const title = `[${timestamp}] Weather UOTD Recommendation`
    const body = `${tempDisplay} ${conditions} - Uniform #${recommendation.uniformNumber} recommended. Tap to review.`

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        type: 'weather_recommendation',
        recommendationId: event.params.recommendationId,
        uniformNumber: String(recommendation.uniformNumber),
        targetSlot: recommendation.targetSlot,
        title,  // Include in data for service worker fallback
        body,   // Include in data for service worker fallback
      },
      // Web push specific configuration
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: `rec-${event.params.recommendationId}`,
          requireInteraction: true,  // Keep visible until user interacts
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
          channelId: 'wots_admin_notifications',
          tag: `rec-${event.params.recommendationId}`,
        },
      },
      tokens: tokens,
    }

    try {
      const response = await messaging.sendEachForMulticast(message)
      console.log(`Successfully sent ${response.successCount} notifications to approvers`)

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens = []
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx])
            }
          }
        })

        if (invalidTokens.length > 0) {
          console.log(`Removing ${invalidTokens.length} invalid approver tokens`)
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
      console.error('Error sending approver notifications:', error)
      return null
    }
  }
)
