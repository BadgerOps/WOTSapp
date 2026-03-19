import { useState } from 'react'
import { usePeerFeedbackSessions } from '../hooks/usePeerFeedback'
import { useAuth } from '../contexts/AuthContext'
import PeerFeedbackList from '../components/peerFeedback/PeerFeedbackList'
import PeerFeedbackForm from '../components/peerFeedback/PeerFeedbackForm'
import Loading from '../components/common/Loading'

export default function PeerFeedback() {
  const { user } = useAuth()
  const { sessions, loading } = usePeerFeedbackSessions('active')
  const [activeSession, setActiveSession] = useState(null)
  const [selectedPeer, setSelectedPeer] = useState(null)
  const [completedFeedback, setCompletedFeedback] = useState(false)

  if (loading) return <Loading />

  // If viewing a completed feedback confirmation
  if (completedFeedback) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="card text-center py-8">
          <svg
            className="w-16 h-16 text-green-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Feedback Submitted!</h2>
          <p className="text-gray-500 mb-4">Your peer feedback has been recorded.</p>
          <button
            onClick={() => {
              setCompletedFeedback(false)
              setSelectedPeer(null)
            }}
            className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg"
          >
            Continue reviewing peers
          </button>
        </div>
      </div>
    )
  }

  // If filling out feedback for a specific peer
  if (activeSession && selectedPeer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <PeerFeedbackForm
          session={activeSession}
          subject={selectedPeer}
          existingResponse={selectedPeer.response}
          onComplete={() => {
            setCompletedFeedback(true)
          }}
          onCancel={() => setSelectedPeer(null)}
        />
      </div>
    )
  }

  // If viewing a session's peer list
  if (activeSession) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4">
          <button
            onClick={() => setActiveSession(null)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to sessions
          </button>
        </div>
        <PeerFeedbackList
          session={activeSession}
          onSelectPeer={(peer) => {
            setSelectedPeer(peer)
            setCompletedFeedback(false)
          }}
        />
      </div>
    )
  }

  // Session list (default view)
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Peer Feedback</h1>
        <p className="text-gray-600">Provide feedback for your fellow candidates</p>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-8">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-gray-500">No active peer feedback sessions right now.</p>
          <p className="text-sm text-gray-400 mt-1">
            Check back later or ask your cadre to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session)}
              className="card w-full text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{session.title}</h3>
                  {session.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {session.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {session.questions?.length} questions
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
