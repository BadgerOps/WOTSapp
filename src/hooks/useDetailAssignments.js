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
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export function useDetailAssignments(statusFilter = null) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q

    if (statusFilter) {
      q = query(
        collection(db, 'detailAssignments'),
        where('status', '==', statusFilter),
        orderBy('dueDateTime', 'desc')
      )
    } else {
      q = query(
        collection(db, 'detailAssignments'),
        orderBy('dueDateTime', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assignmentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setAssignments(assignmentsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching detail assignments:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [statusFilter])

  return { assignments, loading, error }
}

export function usePendingDetailApprovals() {
  const [pendingAssignments, setPendingAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'detailAssignments'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pendingData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setPendingAssignments(pendingData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching pending detail approvals:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { pendingAssignments, loading, error, count: pendingAssignments.length }
}

export function useMyDetailAssignments(statusFilter = null) {
  const { user } = useAuth()
  const [myAssignments, setMyAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // Query assignments where user is in the assignedTo array
    let q

    if (statusFilter) {
      q = query(
        collection(db, 'detailAssignments'),
        where('status', '==', statusFilter),
        orderBy('dueDateTime', 'asc')
      )
    } else {
      q = query(
        collection(db, 'detailAssignments'),
        orderBy('dueDateTime', 'asc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter on client side to check if user has any tasks assigned
        const allAssignments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        console.log('useMyDetailAssignments - Raw assignments:', allAssignments.length)
        console.log('useMyDetailAssignments - User UID:', user.uid)

        const filtered = allAssignments.filter((assignment) => {
          // Check if user is in assignedTo array
          const inAssignedTo = assignment.assignedTo?.some(person => person.personnelId === user.uid)
          // OR check if user has any tasks assigned to them
          const hasTasks = assignment.tasks?.some(task => task.assignedTo?.personnelId === user.uid)

          console.log(`Assignment ${assignment.id}:`, {
            inAssignedTo,
            hasTasks,
            assignedToArray: assignment.assignedTo,
            tasksCount: assignment.tasks?.length,
            sampleTask: assignment.tasks?.[0]
          })

          return inAssignedTo || hasTasks
        })

        console.log('useMyDetailAssignments - Filtered assignments:', filtered.length)
        setMyAssignments(filtered)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching my detail assignments:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [user, statusFilter])

  return { myAssignments, loading, error }
}

export function useDetailAssignmentActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createAssignment(assignmentData) {
    setLoading(true)
    setError(null)
    try {
      // Calculate dueDateTime based on assignmentDate and timeSlot
      const dueDateTime = calculateDueDateTime(
        assignmentData.assignmentDate,
        assignmentData.timeSlot,
        assignmentData.morningTime || '08:00',
        assignmentData.eveningTime || '18:00'
      )

      const assignmentRef = await addDoc(collection(db, 'detailAssignments'), {
        ...assignmentData,
        dueDateTime,
        status: 'assigned',
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return assignmentRef.id
    } catch (err) {
      console.error('Error creating detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateAssignment(assignmentId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function startAssignment(assignmentId) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error starting detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function completeAssignment(assignmentId, completionNotes = '') {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completionNotes,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error completing detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function approveAssignment(assignmentId, approverNotes = '') {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email,
        approverNotes,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error approving detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function rejectAssignment(assignmentId, rejectionReason) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailAssignments', assignmentId), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid,
        rejectionReason,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error rejecting detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteAssignment(assignmentId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'detailAssignments', assignmentId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting detail assignment:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    createAssignment,
    updateAssignment,
    startAssignment,
    completeAssignment,
    approveAssignment,
    rejectAssignment,
    deleteAssignment,
    loading,
    error
  }
}

export function useDetailHistory({ dateRange, templateId, personnelId, status }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [templates, setTemplates] = useState([])
  const [personnel, setPersonnel] = useState([])

  useEffect(() => {
    // Query for completed or approved/rejected details
    const q = query(
      collection(db, 'detailAssignments'),
      where('status', 'in', ['approved', 'rejected']),
      orderBy('completedAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let historyData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Client-side filtering for date range
        if (dateRange === 'week') {
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
          const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
          historyData = historyData.filter((record) => {
            const completedDate = record.completedAt?.toDate ? record.completedAt.toDate() : new Date(record.completedAt)
            return completedDate >= weekStart && completedDate <= weekEnd
          })
        } else if (dateRange === 'month') {
          const monthStart = startOfMonth(new Date())
          const monthEnd = endOfMonth(new Date())
          historyData = historyData.filter((record) => {
            const completedDate = record.completedAt?.toDate ? record.completedAt.toDate() : new Date(record.completedAt)
            return completedDate >= monthStart && completedDate <= monthEnd
          })
        }

        // Filter by template
        if (templateId) {
          historyData = historyData.filter((record) => record.templateId === templateId)
        }

        // Filter by personnel
        if (personnelId) {
          historyData = historyData.filter((record) => {
            // Check if any tasks are assigned to this personnel
            return record.tasks?.some(task => task.assignedTo?.personnelId === personnelId)
          })
        }

        // Filter by status
        if (status) {
          historyData = historyData.filter((record) => record.status === status)
        }

        // Extract unique templates for filter dropdown
        const uniqueTemplates = []
        const templateMap = new Map()
        snapshot.docs.forEach((doc) => {
          const data = doc.data()
          if (data.templateId && data.templateName && !templateMap.has(data.templateId)) {
            templateMap.set(data.templateId, true)
            uniqueTemplates.push({
              id: data.templateId,
              name: data.templateName,
            })
          }
        })

        // Extract unique personnel for filter dropdown
        const uniquePersonnel = []
        const personnelMap = new Map()
        snapshot.docs.forEach((doc) => {
          const data = doc.data()
          data.tasks?.forEach((task) => {
            if (task.assignedTo && !personnelMap.has(task.assignedTo.personnelId)) {
              personnelMap.set(task.assignedTo.personnelId, true)
              uniquePersonnel.push({
                userId: task.assignedTo.personnelId,
                firstName: task.assignedTo.name.split(' ')[0] || '',
                lastName: task.assignedTo.name.split(' ').slice(1).join(' ') || '',
                rank: task.assignedTo.rank || '',
              })
            }
          })
        })

        setHistory(historyData)
        setTemplates(uniqueTemplates)
        setPersonnel(uniquePersonnel)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching detail history:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [dateRange, templateId, personnelId, status])

  return { history, loading, error, templates, personnel }
}

// Helper function to calculate due date/time
function calculateDueDateTime(assignmentDate, timeSlot, morningTime, eveningTime) {
  const date = new Date(assignmentDate)

  if (timeSlot === 'morning') {
    const [hours, minutes] = morningTime.split(':')
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
  } else if (timeSlot === 'evening') {
    const [hours, minutes] = eveningTime.split(':')
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
  } else if (timeSlot === 'both') {
    // For "both", set due time to end of evening slot (add 4 hours to evening time)
    const [hours, minutes] = eveningTime.split(':')
    date.setHours(parseInt(hours) + 4, parseInt(minutes), 0, 0)
  }

  return Timestamp.fromDate(date)
}