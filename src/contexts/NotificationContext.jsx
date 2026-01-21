import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from './AuthContext'
import { ToastContainer } from '../components/common/Toast'
import {
  requestNotificationPermission,
  getFCMToken,
} from '../services/notifications'

const NotificationContext = createContext()

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [toasts, setToasts] = useState([])
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(true)
  const initialLoadRef = useRef(true)
  const lastPostIdRef = useRef(null)

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type, duration }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Check push notification status on load
  useEffect(() => {
    // Check if running as installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true

    console.log('[Notifications] Standalone PWA:', isStandalone)
    console.log('[Notifications] Notification API:', 'Notification' in window)

    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
      console.log('[Notifications] Permission:', Notification.permission)
    } else if (isStandalone) {
      // On iOS PWA, Notification might not be in window but could still work
      // Keep pushSupported true to show the bell
      console.log('[Notifications] PWA mode - keeping bell visible')
    } else {
      // Not a PWA and no Notification API
      setPushSupported(false)
    }
  }, [])

  // Enable push notifications
  const enablePushNotifications = useCallback(async () => {
    if (!user) return false

    const { supported, permission } = await requestNotificationPermission()

    if (!supported) {
      setPushSupported(false)
      return false
    }

    if (permission === 'granted') {
      const token = await getFCMToken(user.uid)
      setPushEnabled(!!token)
      return !!token
    }

    return false
  }, [user])

  // Listen for new posts and show toast (only if push not enabled)
  useEffect(() => {
    if (!user) return
    // Skip Firestore toasts if push is enabled - FCM handles notifications
    if (pushEnabled) return

    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Skip initial load
      if (initialLoadRef.current) {
        initialLoadRef.current = false
        if (snapshot.docs.length > 0) {
          lastPostIdRef.current = snapshot.docs[0].id
        }
        return
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const post = change.doc.data()

          // Only notify for new published posts
          if (post.status === 'published' && change.doc.id !== lastPostIdRef.current) {
            lastPostIdRef.current = change.doc.id
            addToast(
              { title: 'New Post', body: post.title },
              post.type === 'announcement' ? 'warning' : 'info'
            )
          }
        }
      })
    })

    return () => {
      unsubscribe()
      initialLoadRef.current = true
    }
  }, [user, addToast, pushEnabled])

  const value = {
    addToast,
    removeToast,
    pushEnabled,
    pushSupported,
    enablePushNotifications,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </NotificationContext.Provider>
  )
}
