import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../config/firebase'

export function useWeatherCache() {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'weatherCache'),
      (snapshot) => {
        if (snapshot.exists()) {
          setWeather(snapshot.data())
        } else {
          setWeather(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching weather cache:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { weather, loading, error }
}

export function useWeatherActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function refreshWeather() {
    setLoading(true)
    setError(null)

    try {
      const getFn = httpsCallable(functions, 'getCurrentWeather')
      const result = await getFn({})
      setLoading(false)
      return result.data
    } catch (err) {
      console.error('Error fetching weather:', err)
      const message = err.message || 'Failed to fetch weather'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  async function triggerWeatherCheck(targetSlot = null, force = false) {
    setLoading(true)
    setError(null)

    try {
      const checkFn = httpsCallable(functions, 'manualWeatherCheck')
      const result = await checkFn({ targetSlot, force })
      setLoading(false)
      return result.data
    } catch (err) {
      console.error('Error triggering weather check:', err)
      const message = err.message || 'Failed to trigger weather check'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  return { refreshWeather, triggerWeatherCheck, loading, error }
}
