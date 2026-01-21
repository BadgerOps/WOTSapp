import PostFeed from '../components/posts/PostFeed'

export default function Schedule() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-600">View upcoming events and schedule updates</p>
      </div>

      <PostFeed filter="schedule" />
    </div>
  )
}
