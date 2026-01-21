import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../config/firebase'

export function useWeatherLocation() {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'weatherLocation'),
      (snapshot) => {
        if (snapshot.exists()) {
          setLocation({ id: snapshot.id, ...snapshot.data() })
        } else {
          setLocation(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching weather location:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { location, loading, error }
}

export function useWeatherLocationActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function geocodeLocation({ inputType, zipcode, address, units }) {
    setLoading(true)
    setError(null)

    try {
      const geocodeFn = httpsCallable(functions, 'geocodeLocation')
      const result = await geocodeFn({ inputType, zipcode, address, units })
      setLoading(false)
      return result.data
    } catch (err) {
      console.error('Error geocoding location:', err)
      const message = err.message || 'Failed to geocode location'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  async function updateUnits(units) {
    setLoading(true)
    setError(null)

    try {
      const updateFn = httpsCallable(functions, 'updateWeatherUnits')
      const result = await updateFn({ units })
      setLoading(false)
      return result.data
    } catch (err) {
      console.error('Error updating units:', err)
      const message = err.message || 'Failed to update units'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  return { geocodeLocation, updateUnits, loading, error }
}
