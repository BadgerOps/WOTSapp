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
  limit,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Note types for CQ log
 */
export const NOTE_TYPES = {
  routine: { label: 'Routine', color: 'gray' },
  incident: { label: 'Incident', color: 'red' },
  visitor: { label: 'Visitor', color: 'blue' },
  maintenance: { label: 'Maintenance', color: 'yellow' },
  other: { label: 'Other', color: 'gray' },
}

/**
 * Hook to fetch CQ notes for a specific shift
 */
export function useCQNotes(shiftId = null) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q

    if (shiftId) {
      q = query(
        collection(db, 'cqNotes'),
        where('shiftId', '==', shiftId),
        orderBy('timestamp', 'desc')
      )
    } else {
      // Get all notes, most recent first
      q = query(
        collection(db, 'cqNotes'),
        orderBy('timestamp', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setNotes(notesData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching CQ notes:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [shiftId])

  return { notes, loading, error }
}

/**
 * Hook to fetch recent CQ notes (limited count)
 */
export function useRecentCQNotes(limitCount = 10) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, 'cqNotes'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setNotes(notesData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching recent CQ notes:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [limitCount])

  return { notes, loading, error }
}

/**
 * Hook for CQ note CRUD operations
 */
export function useCQNoteActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function addNote(noteData) {
    setLoading(true)
    setError(null)
    try {
      const noteRef = await addDoc(collection(db, 'cqNotes'), {
        ...noteData,
        type: noteData.type || 'routine',
        severity: noteData.severity || 'normal',
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return noteRef.id
    } catch (err) {
      console.error('Error adding CQ note:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateNote(noteId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'cqNotes', noteId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating CQ note:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteNote(noteId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'cqNotes', noteId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting CQ note:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    addNote,
    updateNote,
    deleteNote,
    loading,
    error,
  }
}
