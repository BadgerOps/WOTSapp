import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Swap request statuses
 */
export const SWAP_REQUEST_STATUS = {
  pending: { label: 'Pending', color: 'yellow' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'gray' },
}

/**
 * Hook to fetch pending swap requests (for candidate leadership/admin)
 */
export function usePendingSwapRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'cqSwapRequests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setRequests(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching pending swap requests:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { requests, loading, error }
}

/**
 * Hook to fetch user's own swap requests
 */
export function useMySwapRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'cqSwapRequests'),
      where('requesterId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setRequests(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching my swap requests:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [user])

  return { requests, loading, error }
}

/**
 * Hook for creating and cancelling swap requests
 */
export function useSwapRequestActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Create a new swap request
   * @param {Object} requestData - Swap request details
   * @param {string} requestData.scheduleId - The cqSchedule document ID
   * @param {string} requestData.scheduleDate - YYYY-MM-DD format
   * @param {string} requestData.currentShiftType - 'shift1' or 'shift2'
   * @param {number} requestData.currentPosition - 1 or 2
   * @param {string} requestData.proposedPersonnelId - User ID of person to swap with
   * @param {string} requestData.proposedPersonnelName - Name of person to swap with
   * @param {string} requestData.reason - Reason for swap request
   */
  async function createSwapRequest(requestData) {
    setLoading(true)
    setError(null)

    try {
      const docRef = await addDoc(collection(db, 'cqSwapRequests'), {
        requesterId: user.uid,
        requesterName: user.displayName || user.email,
        scheduleId: requestData.scheduleId,
        scheduleDate: requestData.scheduleDate,
        currentShiftType: requestData.currentShiftType,
        currentPosition: requestData.currentPosition,
        proposedPersonnelId: requestData.proposedPersonnelId,
        proposedPersonnelName: requestData.proposedPersonnelName,
        reason: requestData.reason || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setLoading(false)
      return { success: true, requestId: docRef.id }
    } catch (err) {
      console.error('Error creating swap request:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Cancel a pending swap request
   * @param {string} requestId
   */
  async function cancelSwapRequest(requestId) {
    setLoading(true)
    setError(null)

    try {
      const requestRef = doc(db, 'cqSwapRequests', requestId)
      const requestDoc = await getDoc(requestRef)

      if (!requestDoc.exists()) {
        throw new Error('Request not found')
      }

      if (requestDoc.data().requesterId !== user.uid) {
        throw new Error('You can only cancel your own requests')
      }

      if (requestDoc.data().status !== 'pending') {
        throw new Error('Can only cancel pending requests')
      }

      await updateDoc(requestRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Error cancelling swap request:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    createSwapRequest,
    cancelSwapRequest,
    loading,
    error,
  }
}

/**
 * Hook for candidate leadership to approve/reject swap requests
 */
export function useSwapApprovalActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Approve a swap request and update the schedule
   * @param {string} requestId - The swap request ID
   */
  async function approveSwapRequest(requestId) {
    setLoading(true)
    setError(null)

    try {
      const batch = writeBatch(db)

      // Get the request
      const requestRef = doc(db, 'cqSwapRequests', requestId)
      const requestDoc = await getDoc(requestRef)

      if (!requestDoc.exists()) {
        throw new Error('Request not found')
      }

      const request = requestDoc.data()

      if (request.status !== 'pending') {
        throw new Error('Request is no longer pending')
      }

      // Get the schedule document
      const scheduleRef = doc(db, 'cqSchedule', request.scheduleId)
      const scheduleDoc = await getDoc(scheduleRef)

      if (!scheduleDoc.exists()) {
        throw new Error('Schedule not found')
      }

      // Determine field names
      const currentFieldPrefix = `${request.currentShiftType}Person${request.currentPosition}`

      // Update the schedule to swap the user
      batch.update(scheduleRef, {
        [`${currentFieldPrefix}Name`]: request.proposedPersonnelName,
        [`${currentFieldPrefix}Id`]: request.proposedPersonnelId,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      })

      // Update the request status
      batch.update(requestRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email,
        updatedAt: serverTimestamp(),
      })

      await batch.commit()
      setLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Error approving swap request:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  /**
   * Reject a swap request
   * @param {string} requestId - The swap request ID
   * @param {string} reason - Reason for rejection
   */
  async function rejectSwapRequest(requestId, reason = '') {
    setLoading(true)
    setError(null)

    try {
      const requestRef = doc(db, 'cqSwapRequests', requestId)
      const requestDoc = await getDoc(requestRef)

      if (!requestDoc.exists()) {
        throw new Error('Request not found')
      }

      if (requestDoc.data().status !== 'pending') {
        throw new Error('Request is no longer pending')
      }

      await updateDoc(requestRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid,
        rejectedByName: user.displayName || user.email,
        rejectionReason: reason || null,
        updatedAt: serverTimestamp(),
      })

      setLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Error rejecting swap request:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    approveSwapRequest,
    rejectSwapRequest,
    loading,
    error,
  }
}

/**
 * Hook to get pending swap request count (for badge display)
 */
export function usePendingSwapRequestCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'cqSwapRequests'),
      where('status', '==', 'pending')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching pending swap count:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { count, loading }
}
