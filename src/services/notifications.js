import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import app, { db } from '../config/firebase'

let messaging = null

// Initialize messaging (only in browser with notification support)
function getMessagingInstance() {
  if (messaging) return messaging
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      messaging = getMessaging(app)
      return messaging
    } catch (error) {
      console.error('Failed to initialize messaging:', error)
      return null
    }
  }
  return null
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return { supported: false }
  }

  const permission = await Notification.requestPermission()
  return { supported: true, permission }
}

export async function getFCMToken(userId) {
  const msg = getMessagingInstance()
  if (!msg) return null

  try {
    // Get VAPID key from environment
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY

    if (!vapidKey) {
      console.warn('VAPID key not configured. Push notifications disabled.')
      return null
    }

    const token = await getToken(msg, { vapidKey })

    if (token && userId) {
      // Store token in user document
      await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayUnion(token),
      })
      console.log('FCM token saved:', token.substring(0, 20) + '...')
    }

    return token
  } catch (error) {
    console.error('Failed to get FCM token:', error)
    return null
  }
}

export async function removeFCMToken(userId, token) {
  if (!token || !userId) return

  try {
    await updateDoc(doc(db, 'users', userId), {
      fcmTokens: arrayRemove(token),
    })
    console.log('FCM token removed')
  } catch (error) {
    console.error('Failed to remove FCM token:', error)
  }
}

export function onForegroundMessage(callback) {
  const msg = getMessagingInstance()
  if (!msg) return () => {}

  return onMessage(msg, (payload) => {
    console.log('Foreground message received:', payload)
    callback(payload)
  })
}
