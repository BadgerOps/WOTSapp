import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../config/firebase'

export function useWeatherRecommendations(statusFilter = null) {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q = query(
      collection(db, 'weatherRecommendations'),
      orderBy('createdAt', 'desc')
    )

    if (statusFilter) {
      q = query(
        collection(db, 'weatherRecommendations'),
        where('status', '==', statusFilter),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setRecommendations(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching recommendations:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [statusFilter])

  return { recommendations, loading, error }
}

export function usePendingRecommendations() {
  return useWeatherRecommendations('pending')
}

export function useRecommendationActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function approve(recommendationId, options = {}) {
    setLoading(true)
    setError(null)

    try {
      const approveFn = httpsCallable(functions, 'approveRecommendation')
      const result = await approveFn({
        recommendationId,
        customTitle: options.customTitle,
        customContent: options.customContent,
      })
      setLoading(false)
      return result.data
    } catch (err) {
      console.error('Error approving recommendation:', err)
      const message = err.message || 'Failed to approve recommendation'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  async function reject(recommendationId, reason = null) {
    setLoading(true)
    setError(null)

    try {
      const rejectFn = httpsCallable(functions, 'rejectRecommendation')
      const result = await rejectFn({ recommendationId, reason })
      setLoading(false)
      return result.data
    } catch (err) {
      console.error('Error rejecting recommendation:', err)
      const message = err.message || 'Failed to reject recommendation'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  return { approve, reject, loading, error }
}

export function usePendingCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'weatherRecommendations'),
      where('status', '==', 'pending')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { count, loading }
}
