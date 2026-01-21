import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setDocuments(docsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching documents:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  return { documents, loading, error }
}

export function useDocumentActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  async function uploadDocument(file, { name, category }) {
    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `documents/${timestamp}_${safeName}`
      const storageRef = ref(storage, storagePath)

      await uploadBytes(storageRef, file)
      setProgress(50)

      const downloadURL = await getDownloadURL(storageRef)
      setProgress(75)

      const docRef = await addDoc(collection(db, 'documents'), {
        name: name || file.name,
        category: category || 'General',
        storagePath,
        storageUrl: downloadURL,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: user.uid,
        uploaderName: user.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setProgress(100)
      setLoading(false)
      return docRef.id
    } catch (err) {
      console.error('Error uploading document:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deleteDocument(documentId, storagePath) {
    setLoading(true)
    setError(null)
    try {
      if (storagePath) {
        const storageRef = ref(storage, storagePath)
        await deleteObject(storageRef)
      }
      await deleteDoc(doc(db, 'documents', documentId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting document:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { uploadDocument, deleteDocument, loading, error, progress }
}
