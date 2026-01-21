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

export function useDetailTemplates(activeOnly = true) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q

    if (activeOnly) {
      q = query(
        collection(db, 'detailTemplates'),
        where('active', '==', true),
        orderBy('createdAt', 'desc')
      )
    } else {
      q = query(
        collection(db, 'detailTemplates'),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const templatesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setTemplates(templatesData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching detail templates:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [activeOnly])

  return { templates, loading, error }
}

export function useDetailTemplateActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createTemplate(templateData) {
    setLoading(true)
    setError(null)
    try {
      const templateRef = await addDoc(collection(db, 'detailTemplates'), {
        ...templateData,
        active: true,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return templateRef.id
    } catch (err) {
      console.error('Error creating detail template:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateTemplate(templateId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'detailTemplates', templateId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating detail template:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteTemplate(templateId) {
    setLoading(true)
    setError(null)
    try {
      // Soft delete by setting active to false
      await updateDoc(doc(db, 'detailTemplates', templateId), {
        active: false,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error deleting detail template:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function permanentlyDeleteTemplate(templateId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'detailTemplates', templateId))
      setLoading(false)
    } catch (err) {
      console.error('Error permanently deleting detail template:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { createTemplate, updateTemplate, deleteTemplate, permanentlyDeleteTemplate, loading, error }
}
