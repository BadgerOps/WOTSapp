import { useState, useEffect } from 'react'
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useDetailConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const configRef = doc(db, 'detailConfig', 'default')

    const unsubscribe = onSnapshot(
      configRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setConfig({
            id: docSnap.id,
            ...docSnap.data(),
          })
        } else {
          // Set default config if it doesn't exist
          setConfig({
            id: 'default',
            morningStartTime: '08:00',
            eveningStartTime: '18:00',
            defaultDurationHours: 4,
            notificationEnabled: true,
            reminderBeforeMinutes: 30,
          })
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching detail config:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { config, loading, error }
}

export function useDetailConfigActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function updateConfig(configData) {
    setLoading(true)
    setError(null)
    try {
      const configRef = doc(db, 'detailConfig', 'default')
      await setDoc(configRef, {
        ...configData,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setLoading(false)
    } catch (err) {
      console.error('Error updating detail config:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { updateConfig, loading, error }
}
