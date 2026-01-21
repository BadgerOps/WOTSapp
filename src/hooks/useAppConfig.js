import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'

export const DEFAULT_CONFIG = {
  timezone: 'America/New_York',
  classNumber: '',
  flights: [],
}

/**
 * Hook to read the app configuration from Firestore
 * This is the single source of truth for app-wide settings like timezone
 */
export function useAppConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const docRef = doc(db, 'settings', 'appConfig')

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...snapshot.data(),
          })
        } else {
          // Return default config if document doesn't exist
          setConfig(DEFAULT_CONFIG)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching app config:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { config, loading, error }
}
