import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to get all IDs that can be used to identify the current user in personnel-related queries.
 * Returns both the Firebase Auth UID and the personnel document ID (if different).
 *
 * This is needed because:
 * - When personnel are imported from CSV, they get a Firestore document ID
 * - When assignments are created, they may use this document ID as the personnelId
 * - If the personnel record hasn't been linked to a Firebase user yet,
 *   the personnelId won't match the user's Firebase UID
 * - By matching against both IDs, users can see their assignments regardless of
 *   whether their personnel record has been properly linked
 */
export function useMyPersonnelIds() {
  const { user } = useAuth()
  const [personnelDocId, setPersonnelDocId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) {
      setLoading(false)
      return
    }

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
      } finally {
        setLoading(false)
      }
    }

    lookupPersonnel()
  }, [user?.email])

  // Build array of all IDs that can match the current user
  const matchIds = user ? [user.uid] : []
  if (personnelDocId && personnelDocId !== user?.uid) {
    matchIds.push(personnelDocId)
  }

  /**
   * Check if a personnelId matches the current user
   * @param {string} personnelId - The personnelId to check
   * @returns {boolean} True if the personnelId belongs to the current user
   */
  function isCurrentUser(personnelId) {
    if (!personnelId) return false
    return matchIds.includes(personnelId)
  }

  return {
    matchIds,
    personnelDocId,
    isCurrentUser,
    loading,
  }
}
