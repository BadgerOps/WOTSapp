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
  increment,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to fetch responses for a specific survey
 */
export function useSurveyResponses(surveyId) {
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!surveyId) {
      setResponses([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'surveyResponses'),
      where('surveyId', '==', surveyId),
      orderBy('submittedAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const responsesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setResponses(responsesData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching survey responses:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [surveyId])

  return { responses, loading, error }
}

/**
 * Hook to check if the current user has already responded to a survey
 */
export function useUserSurveyResponse(surveyId) {
  const { user } = useAuth()
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!surveyId || !user) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'surveyResponses'),
      where('surveyId', '==', surveyId),
      where('respondentId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0]
          setResponse({ id: doc.id, ...doc.data() })
        } else {
          setResponse(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching user response:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [surveyId, user])

  return { response, loading, error, hasResponded: !!response }
}

/**
 * Hook for survey response actions
 */
export function useSurveyResponseActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submitResponse(surveyId, answers, isAnonymous = false) {
    setLoading(true)
    setError(null)
    try {
      // Create the response
      const responseRef = await addDoc(collection(db, 'surveyResponses'), {
        surveyId,
        answers, // { questionId: answer } - answer can be string, array, or object
        respondentId: isAnonymous ? null : user.uid,
        respondentName: isAnonymous ? 'Anonymous' : user.displayName,
        respondentEmail: isAnonymous ? null : user.email,
        isAnonymous,
        submittedAt: serverTimestamp(),
      })

      // Update response count on the survey
      await updateDoc(doc(db, 'surveys', surveyId), {
        responseCount: increment(1),
      })

      setLoading(false)
      return responseRef.id
    } catch (err) {
      console.error('Error submitting response:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateResponse(responseId, answers) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'surveyResponses', responseId), {
        answers,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating response:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteResponse(responseId, surveyId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'surveyResponses', responseId))

      // Decrement response count on the survey
      await updateDoc(doc(db, 'surveys', surveyId), {
        responseCount: increment(-1),
      })

      setLoading(false)
    } catch (err) {
      console.error('Error deleting response:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { submitResponse, updateResponse, deleteResponse, loading, error }
}

/**
 * Hook to aggregate responses for a survey (useful for results display)
 */
export function useSurveyResultsAggregation(surveyId, questions) {
  const { responses, loading, error } = useSurveyResponses(surveyId)
  const [aggregatedResults, setAggregatedResults] = useState({})

  useEffect(() => {
    if (!questions || !responses.length) {
      setAggregatedResults({})
      return
    }

    const results = {}

    questions.forEach((question) => {
      const questionId = question.id

      if (question.type === 'single_choice' || question.type === 'multiple_choice') {
        // Count occurrences of each option
        const counts = {}
        question.options?.forEach((opt) => {
          counts[opt] = 0
        })

        responses.forEach((response) => {
          const answer = response.answers?.[questionId]
          if (Array.isArray(answer)) {
            // Multiple choice
            answer.forEach((a) => {
              if (counts[a] !== undefined) counts[a]++
            })
          } else if (answer) {
            // Single choice
            if (counts[answer] !== undefined) counts[answer]++
          }
        })

        results[questionId] = {
          type: question.type,
          counts,
          total: responses.length,
        }
      } else if (question.type === 'text' || question.type === 'long_text') {
        // Collect all text responses
        const textResponses = responses
          .map((r) => ({
            text: r.answers?.[questionId] || '',
            respondent: r.respondentName,
            submittedAt: r.submittedAt,
          }))
          .filter((r) => r.text)

        results[questionId] = {
          type: question.type,
          responses: textResponses,
          total: textResponses.length,
        }
      } else if (question.type === 'rating') {
        // Calculate average and distribution
        const ratings = responses
          .map((r) => r.answers?.[questionId])
          .filter((r) => r !== undefined && r !== null)

        const sum = ratings.reduce((acc, r) => acc + Number(r), 0)
        const average = ratings.length > 0 ? sum / ratings.length : 0

        const distribution = {}
        for (let i = 1; i <= (question.maxRating || 5); i++) {
          distribution[i] = ratings.filter((r) => Number(r) === i).length
        }

        results[questionId] = {
          type: 'rating',
          average: Math.round(average * 10) / 10,
          distribution,
          total: ratings.length,
        }
      } else if (question.type === 'open_contribution') {
        // For "favorite song" type questions - collect all unique contributions
        const contributions = responses
          .map((r) => ({
            value: r.answers?.[questionId] || '',
            respondent: r.respondentName,
            submittedAt: r.submittedAt,
          }))
          .filter((r) => r.value)

        results[questionId] = {
          type: 'open_contribution',
          contributions,
          total: contributions.length,
        }
      }
    })

    setAggregatedResults(results)
  }, [responses, questions])

  return { aggregatedResults, responses, loading, error }
}
