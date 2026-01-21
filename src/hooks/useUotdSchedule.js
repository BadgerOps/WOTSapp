import { useState, useEffect } from 'react'
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_SCHEDULE = {
  slots: {
    breakfast: {
      enabled: false,
      uniformId: null,
      time: '0550',
      lastFired: null,
    },
    lunch: {
      enabled: false,
      uniformId: null,
      time: '1115',
      lastFired: null,
    },
    dinner: {
      enabled: false,
      uniformId: null,
      time: '1750',
      lastFired: null,
    },
  },
}

export function useUotdSchedule() {
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const docRef = doc(db, 'settings', 'uotdSchedule')

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSchedule({
            id: snapshot.id,
            ...snapshot.data(),
          })
        } else {
          // Return default schedule if document doesn't exist
          setSchedule(DEFAULT_SCHEDULE)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching UOTD schedule:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { schedule, loading, error }
}

export function useUotdScheduleActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  async function updateSchedule(updates) {
    setLoading(true)
    setError(null)
    try {
      const docRef = doc(db, 'settings', 'uotdSchedule')
      await setDoc(
        docRef,
        {
          ...updates,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || null,
        },
        { merge: true }
      )
      setLoading(false)
    } catch (err) {
      console.error('Error updating UOTD schedule:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { updateSchedule, loading, error }
}
