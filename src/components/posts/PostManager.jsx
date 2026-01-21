import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { usePostActions } from '../../hooks/usePosts'
import { format } from 'date-fns'
import Loading from '../common/Loading'

const typeLabels = {
  announcement: 'Announcement',
  uotd: 'UOTD',
  schedule: 'Schedule',
  general: 'General',
}

export default function PostManager({ onEdit }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const { deletePost, loading: deleting } = usePostActions()

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setPosts(postsData)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  async function handleDelete(postId) {
    try {
      await deletePost(postId)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete post:', error)
    }
  }

  if (loading) {
    return <Loading />
  }

  if (posts.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-500">No posts yet. Create your first post above.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Manage Posts</h3>

      {posts.map((post) => {
        const createdAt = post.createdAt?.toDate
          ? post.createdAt.toDate()
          : new Date(post.createdAt)

        return (
          <div key={post.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${
                    post.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {post.status === 'draft' ? 'Draft' : 'Published'}
                  </span>
                  <span className="badge bg-gray-100 text-gray-800">
                    {typeLabels[post.type] || post.type}
                  </span>
                </div>
                <h4 className="font-medium text-gray-900 truncate">{post.title}</h4>
                <p className="text-sm text-gray-500">
                  {format(createdAt, 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(post)}
                  className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Edit
                </button>

                {deleteConfirm === post.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deleting}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(post.id)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
