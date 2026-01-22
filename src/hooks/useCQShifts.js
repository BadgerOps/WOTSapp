import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to fetch CQ shifts with optional status filter
 */
export function useCQShifts(statusFilter = null) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q

    if (statusFilter) {
      q = query(
        collection(db, 'cqShifts'),
        where('status', '==', statusFilter),
        orderBy('startTime', 'desc')
      )
    } else {
      q = query(
        collection(db, 'cqShifts'),
        orderBy('startTime', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const shiftsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setShifts(shiftsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching CQ shifts:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [statusFilter])

  return { shifts, loading, error }
}

/**
 * Hook to get the currently active shift
 */
export function useActiveShift() {
  const [activeShift, setActiveShift] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'cqShifts'),
      where('status', '==', 'active')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0]
          setActiveShift({
            id: doc.id,
            ...doc.data(),
          })
        } else {
          setActiveShift(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching active shift:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { activeShift, loading, error }
}

/**
 * Hook for CQ shift CRUD operations
 */
export function useCQShiftActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createShift(shiftData) {
    setLoading(true)
    setError(null)
    try {
      const shiftRef = await addDoc(collection(db, 'cqShifts'), {
        ...shiftData,
        startTime: Timestamp.fromDate(new Date(shiftData.startTime)),
        endTime: Timestamp.fromDate(new Date(shiftData.endTime)),
        status: 'upcoming',
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return shiftRef.id
    } catch (err) {
      console.error('Error creating CQ shift:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateShift(shiftId, updates) {
    setLoading(true)
    setError(null)
    try {
      const updateData = { ...updates, updatedAt: serverTimestamp() }

      if (updates.startTime) {
        updateData.startTime = Timestamp.fromDate(new Date(updates.startTime))
      }
      if (updates.endTime) {
        updateData.endTime = Timestamp.fromDate(new Date(updates.endTime))
      }

      await updateDoc(doc(db, 'cqShifts', shiftId), updateData)
      setLoading(false)
    } catch (err) {
      console.error('Error updating CQ shift:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function activateShift(shiftId) {
    return updateShift(shiftId, { status: 'active' })
  }

  async function completeShift(shiftId) {
    return updateShift(shiftId, { status: 'completed' })
  }

  async function deleteShift(shiftId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'cqShifts', shiftId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting CQ shift:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    createShift,
    updateShift,
    activateShift,
    completeShift,
    deleteShift,
    loading,
    error,
  }
}
