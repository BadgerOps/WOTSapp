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
 * CQ Shift time constants
 * Shift 1: 2000 - 0100 (8 PM to 1 AM)
 * Shift 2: 0100 - 0600 (1 AM to 6 AM)
 */
export const CQ_SHIFT_TIMES = {
  shift1: { start: '20:00', end: '01:00', label: '2000–0100' },
  shift2: { start: '01:00', end: '06:00', label: '0100–0600' },
}

/**
 * Hook to get the current user's CQ shift (today or upcoming overnight shift)
 *
 * This hook checks:
 * 1. Today's shifts - show if user is on shift 1 (2000-0100) or shift 2 (0100-0600) today
 * 2. Tomorrow's shift 2 - show the day before since shift 2 starts at 0100
 *    (users need to know they have CQ tonight even though it's "tomorrow's" date)
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

    // Get today's and tomorrow's dates in YYYY-MM-DD format
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Query for both today and tomorrow to catch overnight shifts
    const q = query(
      collection(db, 'cqSchedule'),
      where('date', 'in', [today, tomorrow]),
      where('status', 'in', ['scheduled', 'active'])
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const shifts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Separate today's and tomorrow's shifts
        const todayShifts = shifts.filter(s => s.date === today)
        const tomorrowShifts = shifts.filter(s => s.date === tomorrow)

        // Helper to check if user is assigned to a shift
        const isUserOnShift1 = (shift) =>
          shift.shift1Person1Id === user.uid || shift.shift1Person2Id === user.uid
        const isUserOnShift2 = (shift) =>
          shift.shift2Person1Id === user.uid || shift.shift2Person2Id === user.uid

        // Priority:
        // 1. Active shift today (either shift)
        // 2. Today's shift 1 (2000-0100) - starts tonight
        // 3. Today's shift 2 (0100-0600) - already past or early morning
        // 4. Tomorrow's shift 2 (0100-0600) - starts tonight after midnight

        let foundShift = null
        let shiftContext = null // 'today', 'tonight', 'tomorrow_early'

        // Check today's shifts first
        for (const shift of todayShifts) {
          if (isUserOnShift1(shift) || isUserOnShift2(shift)) {
            foundShift = shift
            const isShift1 = isUserOnShift1(shift)
            // Shift 1 starts at 2000 (tonight), Shift 2 is 0100-0600 (early morning today)
            shiftContext = isShift1 ? 'tonight' : 'today_early'
            break
          }
        }

        // If no shift today, check if user has shift 2 tomorrow (starts tonight after midnight)
        if (!foundShift) {
          for (const shift of tomorrowShifts) {
            if (isUserOnShift2(shift)) {
              foundShift = shift
              shiftContext = 'tonight_late' // Shift 2 tomorrow = starts after midnight tonight
              break
            }
          }
        }

        if (foundShift) {
          const isShift1 = isUserOnShift1(foundShift)
          const position =
            foundShift.shift1Person1Id === user.uid ||
            foundShift.shift2Person1Id === user.uid
              ? 1
              : 2

          // Get partner info based on shift type
          let partner = null
          if (isShift1) {
            partner = position === 1 ? foundShift.shift1Person2Name : foundShift.shift1Person1Name
          } else {
            partner = position === 1 ? foundShift.shift2Person2Name : foundShift.shift2Person1Name
          }

          setMyShift({
            ...foundShift,
            myShiftType: isShift1 ? 'shift1' : 'shift2',
            myPosition: position,
            myPartnerName: partner,
            myShiftStart: isShift1
              ? config?.cqShift1Start || CQ_SHIFT_TIMES.shift1.start
              : config?.cqShift2Start || CQ_SHIFT_TIMES.shift2.start,
            myShiftEnd: isShift1
              ? config?.cqShift1End || CQ_SHIFT_TIMES.shift1.end
              : config?.cqShift2End || CQ_SHIFT_TIMES.shift2.end,
            shiftContext, // 'tonight', 'today_early', 'tonight_late'
            isOvernightPreview: shiftContext === 'tonight_late', // Tomorrow's shift showing today
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
   * Import schedule directly from parsed CSV data (new format)
   * CSV format: Date, Day, Shift 1 (2000–0100), Shift 2 (0100–0600)
   * Each shift has 2 people separated by "/"
   * Names with * indicate candidate leadership (potential skip days)
   */
  async function importSchedule(scheduleArray, options = {}) {
    setLoading(true)
    setError(null)

    const { clearExisting = false } = options

    try {
      const batch = writeBatch(db)

      // Optionally clear existing schedule
      if (clearExisting) {
        const existingSchedule = await getDocs(collection(db, 'cqSchedule'))
        existingSchedule.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref)
        })
      }

      // Add new schedule entries
      for (const entry of scheduleArray) {
        // Check if schedule already exists for this date
        const existingSchedule = await getDocs(
          query(collection(db, 'cqSchedule'), where('date', '==', entry.date))
        )

        if (existingSchedule.empty) {
          const scheduleRef = doc(collection(db, 'cqSchedule'))
          batch.set(scheduleRef, {
            date: entry.date,
            dayOfWeek: entry.dayOfWeek,
            // Shift 1 (2000-0100)
            shift1Person1Name: entry.shift1Person1Name,
            shift1Person1Id: entry.shift1Person1Id || null,
            shift1Person2Name: entry.shift1Person2Name,
            shift1Person2Id: entry.shift1Person2Id || null,
            // Shift 2 (0100-0600)
            shift2Person1Name: entry.shift2Person1Name,
            shift2Person1Id: entry.shift2Person1Id || null,
            shift2Person2Name: entry.shift2Person2Name,
            shift2Person2Id: entry.shift2Person2Id || null,
            // Potential skip day indicator (before quiz/PT test)
            isPotentialSkipDay: entry.isPotentialSkipDay || false,
            skipDayReason: entry.skipDayReason || null,
            status: 'scheduled',
            importedBy: user.uid,
            importedAt: serverTimestamp(),
          })
        } else {
          // Update existing entry
          const existingDoc = existingSchedule.docs[0]
          batch.update(existingDoc.ref, {
            dayOfWeek: entry.dayOfWeek,
            shift1Person1Name: entry.shift1Person1Name,
            shift1Person1Id: entry.shift1Person1Id || null,
            shift1Person2Name: entry.shift1Person2Name,
            shift1Person2Id: entry.shift1Person2Id || null,
            shift2Person1Name: entry.shift2Person1Name,
            shift2Person1Id: entry.shift2Person1Id || null,
            shift2Person2Name: entry.shift2Person2Name,
            shift2Person2Id: entry.shift2Person2Id || null,
            isPotentialSkipDay: entry.isPotentialSkipDay || false,
            skipDayReason: entry.skipDayReason || null,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          })
        }
      }

      await batch.commit()
      setLoading(false)
      return { success: true, count: scheduleArray.length }
    } catch (err) {
      console.error('Error importing CQ schedule:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Import roster from parsed CSV data (legacy format)
   */
  async function importRoster(rosterArray) {
    setLoading(true)
    setError(null)

    try {
      const batch = writeBatch(db)

      // Clear existing roster
      const existingRoster = await getDocs(collection(db, 'cqRoster'))
      existingRoster.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref)
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
   * Generate schedule from roster for a date range (legacy - roster-based)
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
      const roster = rosterSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))

      if (roster.length === 0) {
        throw new Error('No CQ roster found. Import a roster first.')
      }

      // Get skipped dates
      const skipsSnapshot = await getDocs(collection(db, 'cqSkips'))
      const skippedDates = new Set(
        skipsSnapshot.docs.map((docSnap) => docSnap.data().date)
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
              // Legacy format - single person per shift
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
    importSchedule,
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
