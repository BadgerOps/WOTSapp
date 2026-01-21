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
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload)

  const notificationTitle = payload.notification?.title || 'New Update'
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: payload.data?.postId || 'wots-notification',
    data: payload.data,
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})
