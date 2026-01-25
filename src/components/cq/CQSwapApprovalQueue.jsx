import { useState } from 'react'
import {
  usePendingSwapRequests,
  useSwapApprovalActions,
  SWAP_REQUEST_STATUS,
  SWAP_TYPES,
} from '../../hooks/useCQSwapRequests'
import { CQ_SHIFT_TIMES } from '../../hooks/useCQSchedule'
import { getActualShiftDate } from '../../lib/timezone'
import Loading from '../common/Loading'

function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr, shiftType = null) {
  if (!dateStr) return ''
  const actualDate = shiftType ? getActualShiftDate(dateStr, shiftType) : dateStr
  return new Date(actualDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function CQSwapApprovalQueue() {
  const { requests, loading, error } = usePendingSwapRequests()
  const { approveSwapRequest, rejectSwapRequest, loading: actionLoading } = useSwapApprovalActions()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [expandedId, setExpandedId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState(null)

  function toggleSelection(requestId) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId)
    } else {
      newSelected.add(requestId)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    setSelectedIds(new Set(requests.map((r) => r.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function handleApprove(requestId) {
    setProcessing(true)
    setActionError(null)

    try {
      await approveSwapRequest(requestId)
      setSelectedIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
    } catch (err) {
      console.error('Error approving swap request:', err)
      setActionError('Failed to approve: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) {
      setActionError('Please select at least one request to approve')
      return
    }

    if (!confirm(`Approve ${selectedIds.size} swap request${selectedIds.size !== 1 ? 's' : ''}?`)) {
      return
    }

    setProcessing(true)
    setActionError(null)

    let successCount = 0
    let failCount = 0

    for (const requestId of selectedIds) {
      try {
        await approveSwapRequest(requestId)
        successCount++
      } catch (err) {
        console.error('Error approving swap request:', err)
        failCount++
      }
    }

    setProcessing(false)
    setSelectedIds(new Set())

    if (failCount > 0) {
      setActionError(`Approved ${successCount}, failed ${failCount}`)
    }
  }

  function openRejectModal(requestId = null) {
    if (!requestId && selectedIds.size === 0) {
      setActionError('Please select at least one request to reject')
      return
    }
    setRejectingId(requestId)
    setRejectionReason('')
    setShowRejectModal(true)
    setActionError(null)
  }

  async function handleReject() {
    const idsToReject = rejectingId ? [rejectingId] : Array.from(selectedIds)

    if (idsToReject.length === 0) return

    setProcessing(true)
    setActionError(null)

    let successCount = 0
    let failCount = 0

    for (const requestId of idsToReject) {
      try {
        await rejectSwapRequest(requestId, rejectionReason)
        successCount++
      } catch (err) {
        console.error('Error rejecting swap request:', err)
        failCount++
      }
    }

    setProcessing(false)
    setShowRejectModal(false)
    setRejectionReason('')
    setRejectingId(null)
    setSelectedIds(new Set())

    if (failCount > 0) {
      setActionError(`Rejected ${successCount}, failed ${failCount}`)
    }
  }

  if (loading) {
    return <Loading />
  }

  const allSelected = requests.length > 0 && selectedIds.size === requests.length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">CQ Shift Swap Requests</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and approve shift swap requests from candidates
          </p>
        </div>
        {requests.length > 0 && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
            {requests.length} Pending
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="card text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending swap requests</h3>
          <p className="mt-1 text-sm text-gray-500">
            All CQ shift swap requests have been reviewed.
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Action Bar */}
          <div className="card bg-gray-50 border-2 border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({requests.length})
                  </span>
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={selectedIds.size === 0 || processing}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : `Approve ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
                </button>
                <button
                  onClick={() => openRejectModal()}
                  disabled={selectedIds.size === 0 || processing}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-3">
            {requests.map((request) => {
              const isSelected = selectedIds.has(request.id)
              const isExpanded = expandedId === request.id
              const swapType = request.swapType || SWAP_TYPES.individual
              const isFullShift = swapType === SWAP_TYPES.fullShift
              const shiftLabel =
                request.currentShiftType === 'shift1'
                  ? `Shift 1 (${CQ_SHIFT_TIMES.shift1.label})`
                  : `Shift 2 (${CQ_SHIFT_TIMES.shift2.label})`
              const targetShiftLabel = request.targetShiftType
                ? (request.targetShiftType === 'shift1'
                    ? `Shift 1 (${CQ_SHIFT_TIMES.shift1.label})`
                    : `Shift 2 (${CQ_SHIFT_TIMES.shift2.label})`)
                : ''

              return (
                <div
                  key={request.id}
                  className={`card transition-all ${
                    isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(request.id)}
                      className="mt-1 w-5 h-5 rounded border-gray-300"
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{request.requesterName}</h3>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                              {shiftLabel}
                            </span>
                            {isFullShift && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                Full Shift Swap
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                            <span>{formatRelativeTime(request.createdAt)}</span>
                            <span>•</span>
                            <span>{formatDate(request.scheduleDate, request.currentShiftType)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                          className="text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap ml-2"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>

                      {/* Quick Info */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {isFullShift ? (
                          <div>
                            <span className="text-gray-500">Swap with:</span>{' '}
                            <span className="font-medium">
                              {formatDate(request.targetScheduleDate, request.targetShiftType)} - {targetShiftLabel}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-gray-500">Swap with:</span>{' '}
                            <span className="font-medium">{request.proposedPersonnelName}</span>
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Requester: </span>
                            <span className="text-sm text-gray-600">{request.requesterName}</span>
                          </div>

                          <div>
                            <span className="text-sm font-medium text-gray-700">Swap Type: </span>
                            <span className="text-sm text-gray-600">
                              {isFullShift ? 'Full Shift (both people swap)' : 'Individual (replace one person)'}
                            </span>
                          </div>

                          <div>
                            <span className="text-sm font-medium text-gray-700">Current Shift: </span>
                            <span className="text-sm text-gray-600">
                              {formatDate(request.scheduleDate, request.currentShiftType)} - {shiftLabel}
                              {!isFullShift && `, Position ${request.currentPosition}`}
                            </span>
                          </div>

                          {isFullShift ? (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Target Shift: </span>
                              <span className="text-sm text-gray-600">
                                {formatDate(request.targetScheduleDate, request.targetShiftType)} - {targetShiftLabel}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Proposed Replacement: </span>
                              <span className="text-sm text-gray-600">{request.proposedPersonnelName}</span>
                            </div>
                          )}

                          {request.reason && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Reason: </span>
                              <span className="text-sm text-gray-600">{request.reason}</span>
                            </div>
                          )}

                          {/* Individual Actions */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processing}
                              className="btn-primary text-sm disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(request.id)}
                              disabled={processing}
                              className="btn-secondary text-sm disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                Reject Swap Request{rejectingId ? '' : 's'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {rejectingId
                  ? 'Provide a reason for rejection (optional).'
                  : `Rejecting ${selectedIds.size} request${selectedIds.size > 1 ? 's' : ''}.`}
              </p>
            </div>

            <div className="px-6 py-4">
              {actionError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Rejection Reason (Optional)
                </span>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., 'Proposed replacement not available for that date'"
                  className="input mt-1"
                  rows={3}
                />
              </label>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleReject}
                disabled={processing}
                className="btn-primary flex-1 disabled:opacity-50 bg-red-600 hover:bg-red-700"
              >
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason('')
                  setRejectingId(null)
                  setActionError(null)
                }}
                disabled={processing}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
