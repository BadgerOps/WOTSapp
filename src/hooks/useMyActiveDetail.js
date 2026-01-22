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
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

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
 * Determine if current time is within the detail window
 * Morning window: 7:00 AM - 12:00 PM
 * Evening window: 7:30 PM - 11:59 PM
 */
function getCurrentTimeSlot() {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const timeValue = hours * 60 + minutes // minutes since midnight

  // Morning: 7:00 AM (420) to 12:00 PM (720)
  if (timeValue >= 420 && timeValue < 720) {
    return 'morning'
  }

  // Evening: 7:30 PM (1170) to 11:59 PM (1439)
  if (timeValue >= 1170 && timeValue <= 1439) {
    return 'evening'
  }

  return null
}

/**
 * Check if a detail assignment is active for the current time window
 */
function isDetailActiveNow(assignment) {
  const currentSlot = getCurrentTimeSlot()
  if (!currentSlot) return false

  // Check if assignment matches current time slot
  if (assignment.timeSlot === 'both') return true
  if (assignment.timeSlot === currentSlot) return true

  return false
}

/**
 * Hook to get the current user's active detail for the current time window
 * Returns the detail assignment that should be shown on the home screen
 */
export function useMyActiveDetail() {
  const { user } = useAuth()
  const [activeDetail, setActiveDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTimeSlot, setCurrentTimeSlot] = useState(getCurrentTimeSlot())

  // Update time slot every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeSlot(getCurrentTimeSlot())
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Query for active assignments (filter by date client-side to avoid extra index)
    const q = query(
      collection(db, 'detailAssignments'),
      where('status', 'in', ['assigned', 'in_progress', 'rejected']),
      orderBy('dueDateTime', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const today = new Date().toISOString().split('T')[0]
        const assignments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Filter for today's assignments where user has tasks AND is active now
        const myActiveAssignments = assignments.filter((assignment) => {
          // Filter by today's date (client-side)
          if (assignment.assignmentDate !== today) return false

          // Check if user has tasks assigned
          const hasTasks = assignment.tasks?.some(
            (task) => task.assignedTo?.personnelId === user.uid
          )
          if (!hasTasks) return false

          // Check if detail is active for current time slot
          return isDetailActiveNow(assignment)
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
  }, [user, currentTimeSlot])

  return { activeDetail, loading, error, currentTimeSlot }
}

/**
 * Hook for detail card actions (similar to pass actions)
 */
export function useDetailCardActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
          task.assignedTo?.personnelId === user.uid
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
        if (task.assignedTo?.personnelId === user.uid && !task.completed) {
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

  return {
    startDetail,
    completeTask,
    completeAllTasks,
    submitForApproval,
    loading,
    error,
  }
}
