import { usePosts, useTodaysPosts } from '../../hooks/usePosts'
import PostCard from './PostCard'
import Loading from '../common/Loading'

export default function PostFeed({ filter = null, todayOnly = false }) {
  const allPosts = usePosts(filter)
  const todayPosts = useTodaysPosts()

  const { posts, loading, error } = todayOnly ? todayPosts : allPosts

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="card text-center py-8">
        <p className="text-red-600">Error loading posts: {error}</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="card text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
        <p className="text-gray-500">
          {todayOnly ? 'No updates yet today' : 'No posts yet'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
