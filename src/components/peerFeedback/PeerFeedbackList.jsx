import { usePersonnel } from '../../hooks/usePersonnel'
import { useMyPeerFeedbackResponses } from '../../hooks/usePeerFeedback'
import { useAuth } from '../../contexts/AuthContext'
import Loading from '../common/Loading'

export default function PeerFeedbackList({ session, onSelectPeer }) {
  const { user } = useAuth()
  const { personnel, loading: personnelLoading } = usePersonnel()
  const { responsesBySubject, loading: responsesLoading } =
    useMyPeerFeedbackResponses(session.id)

  if (personnelLoading || responsesLoading) return <Loading />

  // Filter out self - candidates only review others
  // Build a display list from personnel, matching by userId or email
  const peers = personnel
    .filter((p) => p.userId !== user.uid)
    .map((p) => ({
      id: p.userId || p.id,
      personnelId: p.id,
      displayName: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      hasResponse: !!(responsesBySubject[p.userId] || responsesBySubject[p.id]),
      response: responsesBySubject[p.userId] || responsesBySubject[p.id] || null,
    }))

  const completedCount = peers.filter((p) => p.hasResponse).length
  const totalPeers = peers.length
  const progressPercent = totalPeers > 0 ? Math.round((completedCount / totalPeers) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">{session.title}</h2>
        {session.description && (
          <p className="text-sm text-gray-500 mt-1">{session.description}</p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">
              Your progress: {completedCount} of {totalPeers} peers reviewed
            </span>
            <span className="font-medium text-gray-900">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                progressPercent === 100 ? 'bg-green-500' : 'bg-primary-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {peers.map((peer) => (
          <button
            key={peer.id}
            onClick={() => onSelectPeer(peer)}
            className={`text-left p-4 rounded-lg border-2 transition-colors ${
              peer.hasResponse
                ? 'border-green-200 bg-green-50 hover:bg-green-100'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{peer.displayName}</p>
                <p className="text-xs text-gray-500">{peer.email}</p>
              </div>
              {peer.hasResponse ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Done
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-400">Pending</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {peers.length === 0 && (
        <div className="card text-center text-gray-500 text-sm">
          No peers found in the personnel roster.
        </div>
      )}
    </div>
  )
}
