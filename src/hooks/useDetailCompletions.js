import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useDetailCompletions(assignmentId) {
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!assignmentId) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'detailCompletions'),
      where('assignmentId', '==', assignmentId)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const completionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setCompletions(completionsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching detail completions:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [assignmentId])

  return { completions, loading, error }
}

export function useMyDetailCompletion(assignmentId) {
  const { user } = useAuth()
  const [completion, setCompletion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!assignmentId || !user) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'detailCompletions'),
      where('assignmentId', '==', assignmentId),
      where('personnelId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.docs.length > 0) {
          setCompletion({
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
          })
        } else {
          setCompletion(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching my detail completion:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [assignmentId, user])

  return { completion, loading, error }
}

export function useDetailCompletionActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createCompletion(assignmentId, templateSnapshot, checklistData) {
    setLoading(true)
    setError(null)
    try {
      // Calculate area failures and overall rating
      const { areasFailed, overallRating } = calculateRating(checklistData, templateSnapshot.failureThreshold)

      const completionRef = await addDoc(collection(db, 'detailCompletions'), {
        assignmentId,
        personnelId: user.uid,
        personnelName: user.displayName || user.email,
        personnelRank: '', // Can be enriched from personnel collection
        checklist: checklistData,
        totalAreas: checklistData.length,
        areasCompleted: checklistData.filter(area => area.items.every(item => item.checked)).length,
        areasFailed,
        overallRating,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return completionRef.id
    } catch (err) {
      console.error('Error creating detail completion:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateCompletion(completionId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailCompletions', completionId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating detail completion:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateChecklistItem(completionId, areaIndex, itemIndex, checked, notes = '') {
    setLoading(true)
    setError(null)
    try {
      // First, fetch the current completion to get the checklist
      const completionRef = doc(db, 'detailCompletions', completionId)
      const completionSnap = await getDocs(query(collection(db, 'detailCompletions'), where('__name__', '==', completionId)))

      if (completionSnap.empty) {
        throw new Error('Completion not found')
      }

      const currentData = completionSnap.docs[0].data()
      const checklist = [...currentData.checklist]

      // Update the specific item
      checklist[areaIndex].items[itemIndex] = {
        ...checklist[areaIndex].items[itemIndex],
        checked,
        checkedAt: checked ? serverTimestamp() : null,
        notes,
      }

      // Recalculate ratings
      const { areasFailed, overallRating } = calculateRating(checklist, currentData.failureThreshold || 2)

      await updateDoc(completionRef, {
        checklist,
        areasCompleted: checklist.filter(area => area.items.every(item => item.checked)).length,
        areasFailed,
        overallRating,
        updatedAt: serverTimestamp(),
      })

      setLoading(false)
    } catch (err) {
      console.error('Error updating checklist item:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { createCompletion, updateCompletion, updateChecklistItem, loading, error }
}

// Helper function to calculate area failures and overall rating
function calculateRating(checklist, failureThreshold) {
  let areasFailed = 0

  checklist.forEach((area) => {
    // Check for critical failures (instant area fail)
    const hasCriticalFailure = area.items.some(
      (item) => item.criticalFailure && !item.checked
    )

    if (hasCriticalFailure) {
      areasFailed++
      return
    }

    // Count unchecked items (demerits)
    const uncheckedCount = area.items.filter((item) => !item.checked).length

    // Check if unchecked count exceeds demerit limit
    if (uncheckedCount > (area.demeritLimit || 4)) {
      areasFailed++
    }
  })

  // Determine overall rating based on failure threshold
  const overallRating = areasFailed > failureThreshold ? 'unsatisfactory' : 'satisfactory'

  return { areasFailed, overallRating }
}
