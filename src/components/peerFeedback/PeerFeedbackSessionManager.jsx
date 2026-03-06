import { useState } from 'react'
import {
  usePeerFeedbackSessions,
  usePeerFeedbackSessionActions,
  usePeerFeedbackResponses,
} from '../../hooks/usePeerFeedback'
import { usePersonnel } from '../../hooks/usePersonnel'
import Loading from '../common/Loading'

function SessionProgressSummary({ sessionId, personnelCount }) {
  const { responses, loading } = usePeerFeedbackResponses(sessionId)

  if (loading) return <span className="text-xs text-gray-400">...</span>

  // Count unique reviewers
  const uniqueReviewers = new Set(responses.map((r) => r.reviewerId)).size
  const totalExpected = personnelCount * (personnelCount - 1) // each person reviews everyone else

  return (
    <div className="text-xs text-gray-500">
      <span className="font-medium">{uniqueReviewers}</span>/{personnelCount} reviewers
      {' | '}
      <span className="font-medium">{responses.length}</span>/{totalExpected} total reviews
    </div>
  )
}

export default function PeerFeedbackSessionManager({ onEdit, onViewResults }) {
  const { sessions, loading } = usePeerFeedbackSessions()
  const { activateSession, closeSession, deleteSession, loading: actionLoading } =
    usePeerFeedbackSessionActions()
  const { personnel } = usePersonnel()
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (loading) return <Loading />

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    closed: 'bg-red-100 text-red-800',
  }

  async function handleDelete(sessionId) {
    try {
      await deleteSession(sessionId)
      setConfirmDelete(null)
    } catch {
      // error handled in hook
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage Feedback Sessions</h2>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-sm">No peer feedback sessions yet.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 truncate">{session.title}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        statusColors[session.status] || statusColors.draft
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  {session.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {session.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{session.questions?.length || 0} questions</span>
                    <span>by {session.createdByName}</span>
                    {session.createdAt?.toDate && (
                      <span>{session.createdAt.toDate().toLocaleDateString()}</span>
                    )}
                  </div>
                  {session.status === 'active' && (
                    <div className="mt-2">
                      <SessionProgressSummary
                        sessionId={session.id}
                        personnelCount={personnel.length}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {session.status === 'draft' && (
                    <>
                      <button
                        onClick={() => activateSession(session.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => onEdit(session)}
                        className="px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  {session.status === 'active' && (
                    <>
                      <button
                        onClick={() => onViewResults(session)}
                        className="px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg"
                      >
                        Results
                      </button>
                      <button
                        onClick={() => closeSession(session.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg"
                      >
                        Close
                      </button>
                    </>
                  )}
                  {session.status === 'closed' && (
                    <button
                      onClick={() => onViewResults(session)}
                      className="px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg"
                    >
                      Results
                    </button>
                  )}
                  {confirmDelete === session.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={actionLoading}
                        className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(session.id)}
                      className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
