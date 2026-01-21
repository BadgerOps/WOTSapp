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

export function usePosts(filter = null) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    )

    if (filter) {
      q = query(
        collection(db, 'posts'),
        where('status', '==', 'published'),
        where('type', '==', filter),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const postsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setPosts(postsData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching posts:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [filter])

  return { posts, loading, error }
}

export function usePostActions() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createPost({ title, content, type, status = 'published', adminNote = '' }) {
    setLoading(true)
    setError(null)
    try {
      const postRef = await addDoc(collection(db, 'posts'), {
        title,
        content,
        type,
        status,
        authorId: user.uid,
        authorName: user.displayName,
        adminNote: adminNote || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
      return postRef.id
    } catch (err) {
      console.error('Error creating post:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function updatePost(postId, updates) {
    setLoading(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'posts', postId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setLoading(false)
    } catch (err) {
      console.error('Error updating post:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  async function deletePost(postId) {
    setLoading(true)
    setError(null)
    try {
      await deleteDoc(doc(db, 'posts', postId))
      setLoading(false)
    } catch (err) {
      console.error('Error deleting post:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return { createPost, updatePost, deletePost, loading, error }
}
