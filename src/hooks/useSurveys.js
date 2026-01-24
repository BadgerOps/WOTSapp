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
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to fetch surveys with various filter options
 * @param {string} statusFilter - 'published', 'draft', 'closed', or null for all (requires creatorId or isAdmin)
 * @param {object} options - Additional options
 * @param {string} options.creatorId - Filter by creator (user's uid)
 */
export function useSurveys(statusFilter = null, options = {}) {
  const { user, isAdmin } = useAuth()
  const { creatorId } = options
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let q

    if (creatorId) {
      // Fetch surveys by specific creator
      if (statusFilter) {
        q = query(
          collection(db, 'surveys'),
          where('createdBy', '==', creatorId),
          where('status', '==', statusFilter),
          orderBy('createdAt', 'desc')
        )
      } else {
        q = query(
          collection(db, 'surveys'),
          where('createdBy', '==', creatorId),
          orderBy('createdAt', 'desc')
        )
      }
    } else if (statusFilter) {
      // Fetch by status (works for published which all users can read)
      q = query(
        collection(db, 'surveys'),
        where('status', '==', statusFilter),
        orderBy('createdAt', 'desc')
      )
    } else if (isAdmin) {
      // Admin can fetch all surveys
      q = query(collection(db, 'surveys'), orderBy('createdAt', 'desc'))
    } else {
      // Regular users without status filter - fetch their own surveys
      q = query(
        collection(db, 'surveys'),
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const surveysData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setSurveys(surveysData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching surveys:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [statusFilter, creatorId, user, isAdmin])

  return { surveys, loading, error }
}

/**
 * Hook to fetch all surveys for admin management
 * Combines user's own surveys with all published surveys
 */
export function useAllSurveys() {
  const { user, isAdmin } = useAuth()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // For admins, just fetch all surveys
    if (isAdmin) {
      const q = query(collection(db, 'surveys'), orderBy('createdAt', 'desc'))
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const surveysData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setSurveys(surveysData)
          setLoading(false)
        },
        (err) => {
          console.error('Error fetching surveys:', err)
          setError(err.message)
          setLoading(false)
        }
      )
      return unsubscribe
    }

    // For regular users, fetch their own surveys
    const q = query(
      collection(db, 'surveys'),
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const surveysData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setSurveys(surveysData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching surveys:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [user, isAdmin])

  return { surveys, loading, error }
}

/**
 * Hook to fetch a single survey by ID
 */
export function useSurvey(surveyId) {
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!surveyId) {
      setLoading(false)
      return
    }

    const unsubscribe = onSnapshot(
      doc(db, 'surveys', surveyId),
      (docSnap) => {
        if (docSnap.exists()) {
          setSurvey({ id: docSnap.id, ...docSnap.data() })
        } else {
          setSurvey(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching survey:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [surveyId])

  return { survey, loading, error }
}

/**
 * Hook for survey CRUD operations
 */
export function useSurveyActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createSurvey({
    title,
    description,
    type = 'survey',
    questions,
    status = 'draft',
    allowAnonymous = false,
    allowMultipleResponses = false,
    expiresAt = null,
  }) {
    setLoading(true)
    setError(null)
    try {
      const surveyRef = await addDoc(collection(db, 'surveys'), {
        title,
        description: description || '',
        type, // 'survey' or 'quiz'
        questions,
        status,
        allowAnonymous,
        allowMultipleResponses,
        expiresAt,
        createdBy: user.uid,
        createdByName: user.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responseCount: 0,
      })
      setLoading(false)
      return surveyRef.id
    } catch (err) {
      console.error('Error creating survey:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateSurvey(surveyId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'surveys', surveyId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating survey:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteSurvey(surveyId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'surveys', surveyId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting survey:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function publishSurvey(surveyId) {
    return updateSurvey(surveyId, { status: 'published' })
  }

  async function closeSurvey(surveyId) {
    return updateSurvey(surveyId, { status: 'closed' })
  }

  return {
    createSurvey,
    updateSurvey,
    deleteSurvey,
    publishSurvey,
    closeSurvey,
    loading,
    error,
  }
}
