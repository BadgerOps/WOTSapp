import { useAuth } from '../contexts/AuthContext'
import PostFeed from '../components/posts/PostFeed'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, Candidate {user?.displayName?.split(' ')[1]}
        </h1>
        <p className="text-gray-600">Stay updated with the latest announcements</p>
      </div>

      <PostFeed />
    </div>
  )
}
