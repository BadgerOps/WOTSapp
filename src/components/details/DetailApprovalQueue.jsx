import { useState } from 'react'
import { usePendingDetailApprovals } from '../../hooks/useDetailAssignments'
import { useAuth } from '../../contexts/AuthContext'
import Loading from '../common/Loading'
import { format } from 'date-fns'
import { doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../config/firebase'

export default function DetailApprovalQueue() {
  const { user } = useAuth()
  const { pendingAssignments, loading, error } = usePendingDetailApprovals()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [expandedId, setExpandedId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReasons, setRejectionReasons] = useState({})

  function toggleSelection(assignmentId) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(assignmentId)) {
      newSelected.delete(assignmentId)
      // Remove rejection reason if deselecting
      const newReasons = { ...rejectionReasons }
      delete newReasons[assignmentId]
      setRejectionReasons(newReasons)
    } else {
      newSelected.add(assignmentId)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    setSelectedIds(new Set(pendingAssignments.map(a => a.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
    setRejectionReasons({})
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) {
      setActionError('Please select at least one detail to approve')
      return
    }

    if (!confirm(`Approve ${selectedIds.size} cleaning detail${selectedIds.size !== 1 ? 's' : ''}?`)) {
      return
    }

    setProcessing(true)
    setActionError(null)

    try {
      const batch = writeBatch(db)

      selectedIds.forEach(assignmentId => {
        const assignmentRef = doc(db, 'detailAssignments', assignmentId)
        batch.update(assignmentRef, {
          status: 'approved',
          approvedAt: serverTimestamp(),
          approvedBy: user.uid,
          approvedByName: user.displayName || user.email,
        })
      })

      await batch.commit()

      setSelectedIds(new Set())
      alert(`Successfully approved ${selectedIds.size} detail${selectedIds.size !== 1 ? 's' : ''}!`)
    } catch (err) {
      console.error('Error approving details:', err)
      setActionError('Failed to approve details: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  function openRejectModal() {
    if (selectedIds.size === 0) {
      setActionError('Please select at least one detail to reject')
      return
    }
    setShowRejectModal(true)
    setActionError(null)
  }

  async function handleBulkReject() {
    // Validate that all selected items have rejection reasons
    const missingReasons = Array.from(selectedIds).filter(id => !rejectionReasons[id]?.trim())

    if (missingReasons.length > 0) {
      setActionError('Please provide a rejection reason for all selected details')
      return
    }

    if (!confirm(`Reject ${selectedIds.size} detail${selectedIds.size !== 1 ? 's' : ''}? Personnel will need to redo them.`)) {
      return
    }

    setProcessing(true)
    setActionError(null)

    try {
      const batch = writeBatch(db)

      selectedIds.forEach(assignmentId => {
        const assignmentRef = doc(db, 'detailAssignments', assignmentId)
        batch.update(assignmentRef, {
          status: 'assigned', // Reset to assigned so they can redo
          rejectedAt: serverTimestamp(),
          rejectedBy: user.uid,
          rejectedByName: user.displayName || user.email,
          rejectionReason: rejectionReasons[assignmentId],
        })
      })

      await batch.commit()

      setSelectedIds(new Set())
      setRejectionReasons({})
      setShowRejectModal(false)
      alert(`Rejected ${selectedIds.size} detail${selectedIds.size !== 1 ? 's' : ''}. Personnel will be notified.`)
    } catch (err) {
      console.error('Error rejecting details:', err)
      setActionError('Failed to reject details: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  const allSelected = pendingAssignments.length > 0 && selectedIds.size === pendingAssignments.length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Detail Approval Queue</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and approve completed cleaning details
          </p>
        </div>
        {pendingAssignments.length > 0 && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
            {pendingAssignments.length} Pending
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

      {pendingAssignments.length === 0 ? (
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">All caught up!</h3>
          <p className="mt-1 text-sm text-gray-500">
            No pending cleaning details to review.
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Action Bar - Top */}
          <div className="card bg-gray-50 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({pendingAssignments.length})
                  </span>
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedIds.size} selected
                  </span>
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
                  onClick={openRejectModal}
                  disabled={selectedIds.size === 0 || processing}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Details List */}
          <div className="space-y-3">
            {pendingAssignments.map((assignment) => {
              const isSelected = selectedIds.has(assignment.id)
              const isExpanded = expandedId === assignment.id
              const completedTasks = assignment.tasks?.filter(t => t.completed).length || 0
              const totalTasks = assignment.tasks?.length || 0
              const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

              return (
                <div
                  key={assignment.id}
                  className={`card transition-all ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:shadow-md'}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(assignment.id)}
                      className="mt-1 w-5 h-5 rounded border-gray-300"
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{assignment.templateName}</h3>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                            <span>{format(new Date(assignment.assignmentDate), 'MMM d, yyyy')}</span>
                            <span>•</span>
                            <span className="capitalize">{assignment.timeSlot}</span>
                            {assignment.completedAt && (
                              <>
                                <span>•</span>
                                <span>Completed: {format(assignment.completedAt.toDate(), 'h:mm a')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                          className="text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap ml-2"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>

                      {/* Personnel */}
                      <div className="mb-2 text-sm">
                        <span className="font-medium text-gray-700">Personnel: </span>
                        <span className="text-gray-600">
                          {assignment.assignedTo?.map(p => p.name).join(', ') || 'None'}
                        </span>
                      </div>

                      {/* Completion Progress */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">Completion</span>
                          <span className="font-medium text-gray-900">
                            {completedTasks}/{totalTasks} ({Math.round(completionRate)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-green-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>

                      {assignment.completionNotes && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <span className="font-medium text-blue-900">Notes: </span>
                          <span className="text-blue-800">{assignment.completionNotes}</span>
                        </div>
                      )}

                      {/* Expanded Task Details */}
                      {isExpanded && assignment.tasks && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Task Breakdown</h4>
                          <div className="space-y-2">
                            {Object.entries(
                              assignment.tasks.reduce((acc, task) => {
                                if (!acc[task.areaName]) acc[task.areaName] = []
                                acc[task.areaName].push(task)
                                return acc
                              }, {})
                            ).map(([areaName, tasks]) => (
                              <div key={areaName} className="text-xs">
                                <div className="font-medium text-gray-700 mb-1">{areaName}</div>
                                <div className="pl-3 space-y-1">
                                  {tasks.map((task, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      {task.completed ? (
                                        <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      <span className="text-gray-600">
                                        {task.taskText}
                                        {task.location !== 'All' && ` (${task.location})`}
                                        {task.assignedTo && ` - ${task.assignedTo.name}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bulk Action Bar - Bottom */}
          <div className="card bg-gray-50 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({pendingAssignments.length})
                  </span>
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedIds.size} selected
                  </span>
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
                  onClick={openRejectModal}
                  disabled={selectedIds.size === 0 || processing}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">
                Provide Rejection Reasons
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Explain why each detail needs to be redone. Personnel will see these messages.
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              {Array.from(selectedIds).map(assignmentId => {
                const assignment = pendingAssignments.find(a => a.id === assignmentId)
                if (!assignment) return null

                return (
                  <div key={assignmentId} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-2">
                      <h3 className="font-semibold text-gray-900">{assignment.templateName}</h3>
                      <p className="text-sm text-gray-600">
                        {format(new Date(assignment.assignmentDate), 'MMM d, yyyy')} • {assignment.timeSlot}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Personnel: {assignment.assignedTo?.map(p => p.name).join(', ')}
                      </p>
                    </div>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        Rejection Reason <span className="text-red-600">*</span>
                      </span>
                      <textarea
                        value={rejectionReasons[assignmentId] || ''}
                        onChange={(e) => setRejectionReasons({
                          ...rejectionReasons,
                          [assignmentId]: e.target.value
                        })}
                        placeholder="e.g., 'Stairwell 2nd floor not properly cleaned, trash still present'"
                        className="input mt-1"
                        rows={3}
                      />
                    </label>
                  </div>
                )
              })}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={handleBulkReject}
                disabled={processing || Array.from(selectedIds).some(id => !rejectionReasons[id]?.trim())}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
              >
                {processing ? 'Rejecting...' : `Reject ${selectedIds.size} Detail${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
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
