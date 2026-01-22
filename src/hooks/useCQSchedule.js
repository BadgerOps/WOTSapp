import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useAppConfig } from './useAppConfig'

/**
 * Hook to fetch CQ roster (rotation order)
 */
export function useCQRoster() {
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'cqRoster'),
      orderBy('order', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rosterData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setRoster(rosterData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching CQ roster:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { roster, loading, error }
}

/**
 * Hook to fetch CQ schedule (generated shifts from roster)
 */
export function useCQSchedule() {
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'cqSchedule'),
      orderBy('date', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const scheduleData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setSchedule(scheduleData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching CQ schedule:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { schedule, loading, error }
}

/**
 * Hook to get today's CQ schedule for the current user
 */
export function useMyCQShift() {
  const { user } = useAuth()
  const { config } = useAppConfig()
  const [myShift, setMyShift] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    const q = query(
      collection(db, 'cqSchedule'),
      where('date', '==', today),
      where('status', 'in', ['scheduled', 'active'])
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const todayShifts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Find if user is assigned to any shift today
        const userShift = todayShifts.find((shift) => {
          return (
            shift.firstShiftPersonnelId === user.uid ||
            shift.secondShiftPersonnelId === user.uid
          )
        })

        if (userShift) {
          // Determine which shift the user is on
          const isFirstShift = userShift.firstShiftPersonnelId === user.uid
          setMyShift({
            ...userShift,
            myShiftType: isFirstShift ? 'first' : 'second',
            myShiftStart: isFirstShift
              ? config?.cqFirstShiftStart || '20:00'
              : config?.cqSecondShiftStart || '01:00',
            myShiftEnd: isFirstShift
              ? config?.cqFirstShiftEnd || '01:00'
              : config?.cqSecondShiftEnd || '06:00',
          })
        } else {
          setMyShift(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching my CQ shift:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [user, config])

  return { myShift, loading, error }
}

/**
 * Hook for CQ roster and schedule management actions
 */
export function useCQScheduleActions() {
  const { user } = useAuth()
  const { config } = useAppConfig()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Import roster from parsed CSV data
   */
  async function importRoster(rosterArray) {
    setLoading(true)
    setError(null)

    try {
      const batch = writeBatch(db)

      // Clear existing roster
      const existingRoster = await getDocs(collection(db, 'cqRoster'))
      existingRoster.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })

      // Add new roster entries
      for (const entry of rosterArray) {
        const docRef = doc(collection(db, 'cqRoster'))
        batch.set(docRef, {
          ...entry,
          importedBy: user.uid,
          importedAt: serverTimestamp(),
        })
      }

      await batch.commit()
      setLoading(false)
      return { success: true, count: rosterArray.length }
    } catch (err) {
      console.error('Error importing CQ roster:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Generate schedule from roster for a date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {number} days - Number of days to generate
   */
  async function generateSchedule(startDate, days = 30) {
    setLoading(true)
    setError(null)

    try {
      // Get roster
      const rosterSnapshot = await getDocs(
        query(collection(db, 'cqRoster'), orderBy('order', 'asc'))
      )
      const roster = rosterSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      if (roster.length === 0) {
        throw new Error('No CQ roster found. Import a roster first.')
      }

      // Get skipped dates
      const skipsSnapshot = await getDocs(collection(db, 'cqSkips'))
      const skippedDates = new Set(
        skipsSnapshot.docs.map((doc) => doc.data().date)
      )

      // Group roster by order (each order = one day)
      const rosterByDay = {}
      roster.forEach((entry) => {
        if (!rosterByDay[entry.order]) {
          rosterByDay[entry.order] = { first: null, second: null }
        }
        if (entry.shift === 'first') {
          rosterByDay[entry.order].first = entry
        } else if (entry.shift === 'second') {
          rosterByDay[entry.order].second = entry
        }
      })

      const dayOrders = Object.keys(rosterByDay)
        .map(Number)
        .sort((a, b) => a - b)

      const batch = writeBatch(db)
      let rosterIndex = 0
      let currentDate = new Date(startDate)

      for (let i = 0; i < days; i++) {
        const dateStr = currentDate.toISOString().split('T')[0]

        // Skip if this date is in the skip list
        if (!skippedDates.has(dateStr)) {
          const dayOrder = dayOrders[rosterIndex % dayOrders.length]
          const dayRoster = rosterByDay[dayOrder]

          // Check if schedule already exists for this date
          const existingSchedule = await getDocs(
            query(collection(db, 'cqSchedule'), where('date', '==', dateStr))
          )

          if (existingSchedule.empty) {
            const scheduleRef = doc(collection(db, 'cqSchedule'))
            batch.set(scheduleRef, {
              date: dateStr,
              order: dayOrder,
              firstShiftPersonnelId: dayRoster.first?.personnelId || null,
              firstShiftName: dayRoster.first?.name || null,
              secondShiftPersonnelId: dayRoster.second?.personnelId || null,
              secondShiftName: dayRoster.second?.name || null,
              status: 'scheduled',
              createdBy: user.uid,
              createdAt: serverTimestamp(),
            })
          }

          rosterIndex++
        }

        // Move to next date
        currentDate.setDate(currentDate.getDate() + 1)
      }

      await batch.commit()
      setLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Error generating CQ schedule:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Skip a date (pushes all subsequent shifts)
   * @param {string} date - Date to skip (YYYY-MM-DD)
   * @param {string} reason - Reason for skipping (e.g., "PT Test", "Exam")
   */
  async function skipDate(date, reason) {
    setLoading(true)
    setError(null)

    try {
      // Add to skips collection
      await addDoc(collection(db, 'cqSkips'), {
        date,
        reason,
        skippedBy: user.uid,
        skippedByName: user.displayName || user.email,
        skippedAt: serverTimestamp(),
      })

      // Delete the scheduled entry for this date if it exists
      const existingSchedule = await getDocs(
        query(collection(db, 'cqSchedule'), where('date', '==', date))
      )

      if (!existingSchedule.empty) {
        const batch = writeBatch(db)

        // Delete the skipped date
        existingSchedule.docs.forEach((doc) => {
          batch.delete(doc.ref)
        })

        // Get all scheduled dates after this one and shift them
        const futureSchedule = await getDocs(
          query(
            collection(db, 'cqSchedule'),
            where('date', '>', date),
            where('status', '==', 'scheduled'),
            orderBy('date', 'asc')
          )
        )

        // Shift each future date back by one day
        let prevDate = date
        futureSchedule.docs.forEach((docSnap) => {
          const data = docSnap.data()
          // Update the date to the previous slot
          batch.update(docSnap.ref, {
            date: prevDate,
            updatedAt: serverTimestamp(),
          })
          prevDate = data.date
        })

        await batch.commit()
      }

      setLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Error skipping CQ date:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Remove a skip (restore the date)
   */
  async function removeSkip(skipId) {
    setLoading(true)
    setError(null)

    try {
      await deleteDoc(doc(db, 'cqSkips', skipId))
      setLoading(false)
    } catch (err) {
      console.error('Error removing skip:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Update schedule entry status
   */
  async function updateScheduleStatus(scheduleId, status) {
    setLoading(true)
    setError(null)

    try {
      await updateDoc(doc(db, 'cqSchedule', scheduleId), {
        status,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating schedule status:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Start CQ shift
   */
  async function startShift(scheduleId) {
    return updateScheduleStatus(scheduleId, 'active')
  }

  /**
   * Complete CQ shift
   */
  async function completeShift(scheduleId) {
    return updateScheduleStatus(scheduleId, 'completed')
  }

  return {
    importRoster,
    generateSchedule,
    skipDate,
    removeSkip,
    updateScheduleStatus,
    startShift,
    completeShift,
    loading,
    error,
  }
}

/**
 * Hook to fetch CQ skips
 */
export function useCQSkips() {
  const [skips, setSkips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'cqSkips'),
      orderBy('date', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const skipsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setSkips(skipsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching CQ skips:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { skips, loading, error }
}
