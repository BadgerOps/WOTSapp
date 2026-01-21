import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export function useUniforms() {
  const [uniforms, setUniforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'uniforms'), orderBy('number', 'asc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const uniformsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setUniforms(uniformsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching uniforms:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { uniforms, loading, error }
}

export function useUniformActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createUniform({ number, name, description }) {
    setLoading(true)
    setError(null)
    try {
      const uniformRef = await addDoc(collection(db, 'uniforms'), {
        number,
        name,
        description: description || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return uniformRef.id
    } catch (err) {
      console.error('Error creating uniform:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updateUniform(uniformId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'uniforms', uniformId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating uniform:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteUniform(uniformId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'uniforms', uniformId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting uniform:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { createUniform, updateUniform, deleteUniform, loading, error }
}
