import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useDetailConfig } from './useDetailConfig'
import {
  getTodayInTimezone,
  getCurrentTimeMinutesInTimezone,
  DEFAULT_TIMEZONE,
} from '../lib/timezone'

/**
 * Detail stages for tracking progress (similar to pass stages)
 * Flow: not_started -> in_progress -> completed -> (approved by admin)
 */
export const DETAIL_STAGES = {
  not_started: { label: 'Not Started', color: 'gray', next: 'in_progress' },
  in_progress: { label: 'In Progress', color: 'yellow', next: 'completed' },
  completed: { label: 'Completed', color: 'blue', next: null },
  approved: { label: 'Approved', color: 'green', next: null },
}

/**
 * Convert a time string "HH:MM" to minutes since midnight
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/**
 * Determine the current time slot based on configured times.
 * Uses threshold logic: at or after the configured time, the slot activates
 * and stays active until the next slot begins.
 *   - At/after evening time → evening
 *   - At/after morning time → morning
 *   - Before morning time → null (no active slot)
 */
function getCurrentTimeSlot(morningTime = '07:00', eveningTime = '19:00') {
  const timeValue = getCurrentTimeMinutesInTimezone(DEFAULT_TIMEZONE) // minutes since midnight
  const eveningMinutes = timeToMinutes(eveningTime)
  const morningMinutes = timeToMinutes(morningTime)

  // At or after evening time → evening slot
  if (timeValue >= eveningMinutes) return 'evening'

  // At or after morning time → morning slot
  if (timeValue >= morningMinutes) return 'morning'

  // Before morning time → no active slot
  return null
}

/**
 * Check if a detail assignment is active for the current time slot
 */
function isDetailActiveNow(assignment, morningTime, eveningTime) {
  const currentSlot = getCurrentTimeSlot(morningTime, eveningTime)
  if (!currentSlot) return false

  if (assignment.timeSlot === 'both') return true
  if (assignment.timeSlot === currentSlot) return true

  return false
}

/**
 * Hook to get any active detail for the current time slot (regardless of user assignment)
 * This is used to show the detail card to ALL users during the time window
 */
export function useActiveDetailForTimeSlot() {
  const { config } = useDetailConfig()
  const morningTime = config?.morningNotificationTime || '07:00'
  const eveningTime = config?.eveningNotificationTime || '19:00'

  const [activeDetail, setActiveDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTimeSlot, setCurrentTimeSlot] = useState(getCurrentTimeSlot(morningTime, eveningTime))

  // Update time slot every minute and when config changes
  useEffect(() => {
    setCurrentTimeSlot(getCurrentTimeSlot(morningTime, eveningTime))
    const interval = setInterval(() => {
      setCurrentTimeSlot(getCurrentTimeSlot(morningTime, eveningTime))
    }, 60000)

    return () => clearInterval(interval)
  }, [morningTime, eveningTime])

  useEffect(() => {
    // Don't fetch if not in a time slot
    if (!currentTimeSlot) {
      setActiveDetail(null)
      setLoading(false)
      return
    }

    // Query all assignments (filter by date and time slot client-side)
    const q = query(
      collection(db, 'detailAssignments'),
      orderBy('dueDateTime', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const today = getTodayInTimezone(DEFAULT_TIMEZONE)
        const assignments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Filter for today's assignments that match current time slot
        const activeAssignments = assignments.filter((assignment) => {
          // Filter by today's date
          if (assignment.assignmentDate !== today) return false

          // Check if assignment matches current time slot
          if (assignment.timeSlot === 'both') return true
          if (assignment.timeSlot === currentTimeSlot) return true

          return false
        })

        // Return the first active assignment
        setActiveDetail(activeAssignments[0] || null)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching active detail for time slot:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [currentTimeSlot])

  return { activeDetail, loading, error, currentTimeSlot }
}

/**
 * Hook to get the current user's active detail for the current time window
 * Returns the detail assignment that should be shown on the home screen
 */
export function useMyActiveDetail() {
  const { user } = useAuth()
  const { config } = useDetailConfig()
  const morningTime = config?.morningNotificationTime || '07:00'
  const eveningTime = config?.eveningNotificationTime || '19:00'

  const [activeDetail, setActiveDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTimeSlot, setCurrentTimeSlot] = useState(getCurrentTimeSlot(morningTime, eveningTime))
  const [personnelDocId, setPersonnelDocId] = useState(null)

  // Update time slot every minute and when config changes
  useEffect(() => {
    setCurrentTimeSlot(getCurrentTimeSlot(morningTime, eveningTime))
    const interval = setInterval(() => {
      setCurrentTimeSlot(getCurrentTimeSlot(morningTime, eveningTime))
    }, 60000)

    return () => clearInterval(interval)
  }, [morningTime, eveningTime])

  // Look up the user's personnel record by email to get their personnel document ID
  useEffect(() => {
    if (!user?.email) return

    async function lookupPersonnel() {
      try {
        const q = query(
          collection(db, 'personnel'),
          where('email', '==', user.email)
        )
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const personnelDoc = snapshot.docs[0]
          setPersonnelDocId(personnelDoc.id)
        }
      } catch (err) {
        console.error('Error looking up personnel record:', err)
      }
    }

    lookupPersonnel()
  }, [user?.email])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Query all assignments (filter by date and time slot client-side)
    const q = query(
      collection(db, 'detailAssignments'),
      orderBy('dueDateTime', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const today = getTodayInTimezone(DEFAULT_TIMEZONE)
        const assignments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Match by either user.uid OR personnel document ID
        const matchIds = [user.uid]
        if (personnelDocId && personnelDocId !== user.uid) {
          matchIds.push(personnelDocId)
        }

        // Filter for today's assignments where user has tasks
        const myActiveAssignments = assignments.filter((assignment) => {
          // Filter by today's date (client-side)
          if (assignment.assignmentDate !== today) return false

          // Check if user has tasks assigned (by any matching ID)
          const hasTasks = assignment.tasks?.some(
            (task) => matchIds.includes(task.assignedTo?.personnelId)
          )
          if (!hasTasks) return false

          // Show if assignment matches current time slot (status doesn't matter)
          return isDetailActiveNow(assignment, morningTime, eveningTime)
        })

        // Return the first active assignment (should typically only be one)
        setActiveDetail(myActiveAssignments[0] || null)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching active detail:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [user, currentTimeSlot, personnelDocId])

  return { activeDetail, loading, error, currentTimeSlot }
}

/**
 * Hook for detail card actions (similar to pass actions)
 */
export function useDetailCardActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [personnelDocId, setPersonnelDocId] = useState(null)

  // Look up the user's personnel record by email
  useEffect(() => {
    if (!user?.email) return

    async function lookupPersonnel() {
      try {
        const q = query(
          collection(db, 'personnel'),
          where('email', '==', user.email)
        )
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          setPersonnelDocId(snapshot.docs[0].id)
        }
      } catch (err) {
        console.error('Error looking up personnel record:', err)
      }
    }

    lookupPersonnel()
  }, [user?.email])

  // Build array of matching IDs
  const matchIds = user ? [user.uid] : []
  if (personnelDocId && personnelDocId !== user?.uid) {
    matchIds.push(personnelDocId)
  }

  function isCurrentUser(personnelId) {
    return personnelId && matchIds.includes(personnelId)
  }

  /**
   * Start the detail (move from assigned to in_progress)
   */
  async function startDetail(assignmentId) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        startedBy: user.uid,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error starting detail:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Complete a single task
   */
  async function completeTask(assignmentId, taskId, location, allTasks) {
    setLoading(true)
    setError(null)
    try {
      const updatedTasks = allTasks.map((task) => {
        if (
          task.taskId === taskId &&
          task.location === location &&
          isCurrentUser(task.assignedTo?.personnelId)
        ) {
          return {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
          }
        }
        return task
      })

      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error completing task:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Complete all remaining tasks at once
   */
  async function completeAllTasks(assignmentId, allTasks) {
    setLoading(true)
    setError(null)
    try {
      const updatedTasks = allTasks.map((task) => {
        if (isCurrentUser(task.assignedTo?.personnelId) && !task.completed) {
          return {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
          }
        }
        return task
      })

      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        tasks: updatedTasks,
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error completing all tasks:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Submit detail for approval (all tasks completed)
   */
  async function submitForApproval(assignmentId) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: user.uid,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error submitting for approval:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Complete selected tasks (multi-select)
   * @param {string} assignmentId - The assignment ID
   * @param {Set<string>} selectedTaskKeys - Set of task keys in format "taskId-location"
   * @param {Array} allTasks - All tasks in the assignment
   */
  async function completeSelectedTasks(assignmentId, selectedTaskKeys, allTasks) {
    setLoading(true)
    setError(null)
    try {
      const updatedTasks = allTasks.map((task) => {
        const taskKey = `${task.taskId}-${task.location}`
        if (
          selectedTaskKeys.has(taskKey) &&
          isCurrentUser(task.assignedTo?.personnelId) &&
          !task.completed
        ) {
          return {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
          }
        }
        return task
      })

      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        tasks: updatedTasks,
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error completing selected tasks:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    startDetail,
    completeTask,
    completeAllTasks,
    completeSelectedTasks,
    submitForApproval,
    loading,
    error,
  }
}
