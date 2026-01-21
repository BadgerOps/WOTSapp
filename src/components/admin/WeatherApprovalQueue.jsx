import { useState } from 'react'
import {
  usePendingRecommendations,
  useWeatherRecommendations,
  useRecommendationActions,
} from '../../hooks/useWeatherRecommendations'
import Loading from '../common/Loading'

function RecommendationCard({ recommendation, onApprove, onReject, processing }) {
  const [showRejectReason, setShowRejectReason] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showCustomize, setShowCustomize] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customContent, setCustomContent] = useState('')

  const weather = recommendation.weather || {}
  const tempDisplay = `${Math.round(weather.temperature || 0)}°F`
  const isExpired = recommendation.expiresAt && new Date(recommendation.expiresAt) < new Date()

  function handleApprove() {
    if (showCustomize && (customTitle || customContent)) {
      onApprove(recommendation.id, { customTitle, customContent })
    } else {
      onApprove(recommendation.id)
    }
  }

  function handleReject() {
    onReject(recommendation.id, rejectReason || null)
    setShowRejectReason(false)
    setRejectReason('')
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatTime(timestamp) {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className={`card ${isExpired ? 'border-red-200 bg-red-50' : ''}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-700 font-bold rounded-lg">
              {recommendation.uniformNumber}
            </span>
            <div>
              <h4 className="font-medium text-gray-900">{recommendation.uniformName}</h4>
              <p className="text-sm text-gray-600">
                {recommendation.targetSlot?.charAt(0).toUpperCase() + recommendation.targetSlot?.slice(1)} - {formatDate(recommendation.targetDate)}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
              recommendation.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : recommendation.status === 'approved'
                ? 'bg-green-100 text-green-800'
                : recommendation.status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {recommendation.status}
          </span>
          {isExpired && recommendation.status === 'pending' && (
            <p className="text-xs text-red-600 mt-1">Expired</p>
          )}
        </div>
      </div>

      {/* Weather Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Weather Conditions</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Temperature:</span>{' '}
            <span className="font-medium">{tempDisplay}</span>
          </div>
          <div>
            <span className="text-gray-500">Humidity:</span>{' '}
            <span className="font-medium">{weather.humidity}%</span>
          </div>
          <div>
            <span className="text-gray-500">Wind:</span>{' '}
            <span className="font-medium">{Math.round(weather.windSpeed || 0)} mph</span>
          </div>
          <div>
            <span className="text-gray-500">Conditions:</span>{' '}
            <span className="font-medium">{weather.weatherMain || 'Unknown'}</span>
          </div>
          {weather.precipitationChance > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">Precipitation Chance:</span>{' '}
              <span className="font-medium">{Math.round(weather.precipitationChance)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Matched Rule */}
      <p className="text-sm text-gray-600 mb-4">
        <span className="text-gray-500">Matched Rule:</span>{' '}
        <span className="font-medium">{recommendation.matchedRuleName || 'Default'}</span>
      </p>

      {/* Customize Option */}
      {recommendation.status === 'pending' && (
        <>
          <button
            type="button"
            onClick={() => setShowCustomize(!showCustomize)}
            className="text-sm text-primary-600 hover:text-primary-700 mb-3"
          >
            {showCustomize ? 'Hide customization' : 'Customize post content'}
          </button>

          {showCustomize && (
            <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Title (optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="input"
                  placeholder={`Uniform #${recommendation.uniformNumber} - ${recommendation.uniformName}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Content (optional)
                </label>
                <textarea
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Leave blank for auto-generated weather summary"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {recommendation.status === 'pending' && (
        <div className="flex gap-2">
          {showRejectReason ? (
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input flex-1"
                placeholder="Reason (optional)"
              />
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowRejectReason(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Approve & Post'}
              </button>
              <button
                onClick={() => setShowRejectReason(true)}
                disabled={processing}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}

      {/* Approved/Rejected Info */}
      {recommendation.status === 'approved' && (
        <div className="text-sm text-green-600">
          Approved {formatTime(recommendation.approvedAt)}
          {recommendation.postId && (
            <span className="text-gray-500"> - Post created</span>
          )}
        </div>
      )}

      {recommendation.status === 'rejected' && (
        <div className="text-sm text-red-600">
          Rejected {formatTime(recommendation.rejectedAt)}
          {recommendation.rejectionReason && (
            <span className="text-gray-500"> - {recommendation.rejectionReason}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function WeatherApprovalQueue() {
  const [viewMode, setViewMode] = useState('pending')
  const { recommendations: pending, loading: pendingLoading } = usePendingRecommendations()
  const { recommendations: all, loading: allLoading } = useWeatherRecommendations()
  const { approve, reject, loading: processing, error } = useRecommendationActions()

  const [success, setSuccess] = useState(null)

  async function handleApprove(id, options) {
    try {
      await approve(id, options)
      setSuccess('Recommendation approved and UOTD post created!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      // Error handled in hook
    }
  }

  async function handleReject(id, reason) {
    try {
      await reject(id, reason)
      setSuccess('Recommendation rejected')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      // Error handled in hook
    }
  }

  const loading = viewMode === 'pending' ? pendingLoading : allLoading
  const recommendations = viewMode === 'pending' ? pending : all

  if (loading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('pending')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'pending'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'all'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All History
        </button>
      </div>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">
            {viewMode === 'pending'
              ? 'No pending recommendations. Weather checks will create recommendations automatically.'
              : 'No recommendation history yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onApprove={handleApprove}
              onReject={handleReject}
              processing={processing}
            />
          ))}
        </div>
      )}
    </div>
  )
}
