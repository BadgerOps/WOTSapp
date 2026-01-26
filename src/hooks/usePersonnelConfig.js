import { useState, useEffect } from 'react'
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_FLIGHTS = ['Barrow', 'Long', 'Brow']
const DEFAULT_CLASSES = ['26-01', '26-02', '26-03']

export function usePersonnelConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const configRef = doc(db, 'personnelConfig', 'default')

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
            flights: DEFAULT_FLIGHTS,
            classes: DEFAULT_CLASSES,
          })
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching personnel config:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { config, loading, error }
}

export function usePersonnelConfigActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function updateConfig(configData) {
    setLoading(true)
    setError(null)
    try {
      const configRef = doc(db, 'personnelConfig', 'default')
      await setDoc(configRef, {
        ...configData,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setLoading(false)
    } catch (err) {
      console.error('Error updating personnel config:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function addFlight(flightName) {
    setError(null)
    try {
      const configRef = doc(db, 'personnelConfig', 'default')
      const docSnap = await getDoc(configRef)
      const currentFlights = docSnap.exists() ? (docSnap.data().flights || []) : []

      if (currentFlights.includes(flightName)) {
        return { success: false, reason: 'duplicate' }
      }

      await updateConfig({ flights: [...currentFlights, flightName] })
      return { success: true }
    } catch (err) {
      console.error('Error adding flight:', err)
      setError(err.message)
      throw err
    }
  }

  async function removeFlight(flightName) {
    const configRef = doc(db, 'personnelConfig', 'default')
    const docSnap = await getDoc(configRef)
    const currentFlights = docSnap.exists() ? (docSnap.data().flights || DEFAULT_FLIGHTS) : DEFAULT_FLIGHTS

    await updateConfig({ flights: currentFlights.filter(f => f !== flightName) })
  }

  async function addClass(className) {
    setError(null)
    try {
      const configRef = doc(db, 'personnelConfig', 'default')
      const docSnap = await getDoc(configRef)
      const currentClasses = docSnap.exists() ? (docSnap.data().classes || []) : []

      if (currentClasses.includes(className)) {
        return { success: false, reason: 'duplicate' }
      }

      await updateConfig({ classes: [...currentClasses, className] })
      return { success: true }
    } catch (err) {
      console.error('Error adding class:', err)
      setError(err.message)
      throw err
    }
  }

  async function removeClass(className) {
    const configRef = doc(db, 'personnelConfig', 'default')
    const docSnap = await getDoc(configRef)
    const currentClasses = docSnap.exists() ? (docSnap.data().classes || DEFAULT_CLASSES) : DEFAULT_CLASSES

    await updateConfig({ classes: currentClasses.filter(c => c !== className) })
  }

  return {
    updateConfig,
    addFlight,
    removeFlight,
    addClass,
    removeClass,
    loading,
    error
  }
}
