import { useState, useEffect, useMemo } from 'react'
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
  getDocs,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to fetch peer feedback sessions with optional status filter
 */
export function usePeerFeedbackSessions(statusFilter = null) {
  const { user, isAdmin, isCandidateLeadership } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let q
    if (statusFilter) {
      q = query(
        collection(db, 'peerFeedbackSessions'),
        where('status', '==', statusFilter),
        orderBy('createdAt', 'desc')
      )
    } else if (isAdmin || isCandidateLeadership) {
      q = query(
        collection(db, 'peerFeedbackSessions'),
        orderBy('createdAt', 'desc')
      )
    } else {
      q = query(
        collection(db, 'peerFeedbackSessions'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        setSessions(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching peer feedback sessions:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [statusFilter, user, isAdmin, isCandidateLeadership])

  return { sessions, loading, error }
}

/**
 * Hook to fetch a single peer feedback session
 */
export function usePeerFeedbackSession(sessionId) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    const unsubscribe = onSnapshot(
      doc(db, 'peerFeedbackSessions', sessionId),
      (docSnap) => {
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() })
        } else {
          setSession(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching peer feedback session:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [sessionId])

  return { session, loading, error }
}

/**
 * Hook for peer feedback session CRUD operations
 */
export function usePeerFeedbackSessionActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createSession({ title, description, questions }) {
    setLoading(true)
    setError(null)
    try {
      const ref = await addDoc(collection(db, 'peerFeedbackSessions'), {
        title,
        description: description || '',
        questions,
        status: 'draft',
        createdBy: user.uid,
        createdByName: user.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return ref.id
    } catch (err) {
      console.error('Error creating peer feedback session:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateSession(sessionId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'peerFeedbackSessions', sessionId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating peer feedback session:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteSession(sessionId) {
    setLoading(true)
    setError(null)
    try {
      // Delete all responses for this session first
      const responsesQuery = query(
        collection(db, 'peerFeedbackResponses'),
        where('sessionId', '==', sessionId)
      )
      const responsesSnap = await getDocs(responsesQuery)
      const deletePromises = responsesSnap.docs.map((d) =>
        deleteDoc(doc(db, 'peerFeedbackResponses', d.id))
      )
      await Promise.all(deletePromises)

      await deleteDoc(doc(db, 'peerFeedbackSessions', sessionId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting peer feedback session:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function activateSession(sessionId) {
    return updateSession(sessionId, { status: 'active' })
  }

  async function closeSession(sessionId) {
    return updateSession(sessionId, { status: 'closed' })
  }

  return {
    createSession,
    updateSession,
    deleteSession,
    activateSession,
    closeSession,
    loading,
    error,
  }
}

/**
 * Hook to fetch all responses for a session
 */
export function usePeerFeedbackResponses(sessionId) {
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) {
      setResponses([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'peerFeedbackResponses'),
      where('sessionId', '==', sessionId),
      orderBy('submittedAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        setResponses(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching peer feedback responses:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [sessionId])

  return { responses, loading, error }
}

/**
 * Hook to fetch the current user's responses for a session
 */
export function useMyPeerFeedbackResponses(sessionId) {
  const { user } = useAuth()
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId || !user) {
      setResponses([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'peerFeedbackResponses'),
      where('sessionId', '==', sessionId),
      where('reviewerId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        setResponses(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching my peer feedback responses:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [sessionId, user])

  // Build a map of subjectId -> response for quick lookup
  const responsesBySubject = useMemo(() => {
    const map = {}
    responses.forEach((r) => {
      map[r.subjectId] = r
    })
    return map
  }, [responses])

  return { responses, responsesBySubject, loading, error }
}

/**
 * Hook for peer feedback response actions
 */
export function usePeerFeedbackResponseActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submitFeedback(sessionId, subjectId, subjectName, answers) {
    setLoading(true)
    setError(null)
    try {
      const ref = await addDoc(collection(db, 'peerFeedbackResponses'), {
        sessionId,
        reviewerId: user.uid,
        reviewerName: user.displayName,
        subjectId,
        subjectName,
        answers,
        submittedAt: serverTimestamp(),
      })
      setLoading(false)
      return ref.id
    } catch (err) {
      console.error('Error submitting peer feedback:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateFeedback(responseId, answers) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'peerFeedbackResponses', responseId), {
        answers,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating peer feedback:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { submitFeedback, updateFeedback, loading, error }
}

/**
 * Hook to aggregate peer feedback results for a session, grouped by subject
 */
export function usePeerFeedbackResultsAggregation(sessionId, questions) {
  const { responses, loading, error } = usePeerFeedbackResponses(sessionId)

  const resultsBySubject = useMemo(() => {
    if (!questions || !responses.length) return {}

    // Group responses by subject
    const grouped = {}
    responses.forEach((r) => {
      if (!grouped[r.subjectId]) {
        grouped[r.subjectId] = {
          subjectId: r.subjectId,
          subjectName: r.subjectName,
          responses: [],
        }
      }
      grouped[r.subjectId].responses.push(r)
    })

    // Aggregate per subject
    Object.keys(grouped).forEach((subjectId) => {
      const subjectResponses = grouped[subjectId].responses
      const aggregated = {}

      questions.forEach((question) => {
        const qId = question.id

        if (question.type === 'rating') {
          const ratings = subjectResponses
            .map((r) => r.answers?.[qId])
            .filter((r) => r !== undefined && r !== null)
          const sum = ratings.reduce((acc, r) => acc + Number(r), 0)
          const average = ratings.length > 0 ? sum / ratings.length : 0
          const distribution = {}
          for (let i = 1; i <= (question.maxRating || 5); i++) {
            distribution[i] = ratings.filter((r) => Number(r) === i).length
          }
          aggregated[qId] = {
            type: 'rating',
            average: Math.round(average * 10) / 10,
            distribution,
            total: ratings.length,
          }
        } else if (question.type === 'text' || question.type === 'long_text') {
          const textResponses = subjectResponses
            .map((r) => ({
              text: r.answers?.[qId] || '',
              reviewer: r.reviewerName,
              submittedAt: r.submittedAt,
            }))
            .filter((r) => r.text)
          aggregated[qId] = {
            type: question.type,
            responses: textResponses,
            total: textResponses.length,
          }
        } else if (question.type === 'single_choice' || question.type === 'multiple_choice') {
          const counts = {}
          question.options?.forEach((opt) => {
            counts[opt] = 0
          })
          subjectResponses.forEach((r) => {
            const answer = r.answers?.[qId]
            if (Array.isArray(answer)) {
              answer.forEach((a) => {
                if (counts[a] !== undefined) counts[a]++
              })
            } else if (answer && counts[answer] !== undefined) {
              counts[answer]++
            }
          })
          aggregated[qId] = {
            type: question.type,
            counts,
            total: subjectResponses.length,
          }
        }
      })

      grouped[subjectId].aggregated = aggregated
      grouped[subjectId].responseCount = subjectResponses.length
    })

    return grouped
  }, [responses, questions])

  return { resultsBySubject, responses, loading, error }
}
