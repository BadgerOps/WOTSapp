// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// Initialize Firebase in the service worker
// Note: These values are public and safe to include in client-side code
firebase.initializeApp({
  apiKey: 'AIzaSyBFNVTI16YiB7UUdyUVeiJplZIZbFpinkg',
  authDomain: 'wots-app-484617.firebaseapp.com',
  projectId: 'wots-app-484617',
  storageBucket: 'wots-app-484617.firebasestorage.app',
  messagingSenderId: '158166311643',
  appId: '1:158166311643:web:414860386999adf1e4a2fe',
})

const messaging = firebase.messaging()

// Handle background messages
// NOTE: If the message contains a 'notification' field, FCM automatically shows it.
// We only need to manually show a notification for data-only messages.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload)

  // If the message has a notification field, FCM will show it automatically.
  // We only show manually for data-only messages to avoid duplicates.
  if (payload.notification) {
    console.log('[SW] Message has notification field - FCM will handle display')
    return
  }

  // Data-only message - show notification manually
  const notificationTitle = payload.data?.title || 'New Update'
  const notificationOptions = {
    body: payload.data?.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.postId || payload.data?.recommendationId || 'wots-notification',
    data: payload.data,
    requireInteraction: payload.data?.type === 'weather_recommendation',
  }

  // Add action buttons for weather recommendations
  if (payload.data?.type === 'weather_recommendation') {
    notificationOptions.actions = [
      { action: 'approve', title: '✓ Approve' },
      { action: 'edit', title: '✏️ Edit' },
    ]
  }

  console.log('[SW] Showing data-only notification:', notificationTitle)
  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)
  console.log('[SW] Action:', event.action)
  console.log('[SW] Notification data:', event.notification.data)

  event.notification.close()

  const data = event.notification.data || {}
  const recommendationId = data.recommendationId

  // Handle action buttons
  if (event.action === 'approve' && recommendationId) {
    console.log('[SW] Approve action clicked for:', recommendationId)
    // Open app with approve action
    event.waitUntil(
      clients.openWindow(`/?action=approve&recommendationId=${recommendationId}`)
    )
    return
  }

  if (event.action === 'edit' && recommendationId) {
    console.log('[SW] Edit action clicked for:', recommendationId)
    // Open app with edit action
    event.waitUntil(
      clients.openWindow(`/?action=edit&recommendationId=${recommendationId}`)
    )
    return
  }

  // Default click behavior - open/focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Build URL based on notification type
      let targetUrl = '/'
      if (data.type === 'weather_recommendation' && recommendationId) {
        targetUrl = `/?action=review&recommendationId=${recommendationId}`
      }

      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          // Post message to navigate to the recommendation
          if (recommendationId) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              action: 'review',
              recommendationId,
            })
          }
          return client
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
