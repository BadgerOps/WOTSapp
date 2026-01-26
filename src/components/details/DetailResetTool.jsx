import { useState } from 'react'
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useDetailAssignments } from '../../hooks/useDetailAssignments'

export default function DetailResetTool() {
  const { assignments, loading } = useDetailAssignments()
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [resetType, setResetType] = useState('assignments') // 'assignments' or 'status'
  const [statusToReset, setStatusToReset] = useState('all') // 'all', 'assigned', 'in_progress', etc.
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Count assignments by status
  const statusCounts = assignments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  // Count total task assignments across all detail assignments
  const totalTaskAssignments = assignments.reduce((count, a) => {
    return count + (a.tasks?.filter(t => t.assignedTo?.personnelId).length || 0)
  }, 0)

  async function handleResetAssignments() {
    setResetting(true)
    setError(null)
    setResult(null)

    try {
      const batch = writeBatch(db)
      let updatedCount = 0

      // Filter assignments based on status selection
      const assignmentsToReset = statusToReset === 'all'
        ? assignments
        : assignments.filter(a => a.status === statusToReset)

      for (const assignment of assignmentsToReset) {
        // Clear all task assignments (set assignedTo to null)
        const clearedTasks = assignment.tasks?.map(task => ({
          ...task,
          assignedTo: null,
          completed: false,
          completedAt: null,
          notes: ''
        })) || []

        const docRef = doc(db, 'detailAssignments', assignment.id)
        batch.update(docRef, {
          tasks: clearedTasks,
          status: 'assigned', // Reset status back to assigned
          startedAt: null,
          startedBy: null,
          completedAt: null,
          completedBy: null,
          approvedAt: null,
          approvedBy: null,
          rejectionReason: null,
          completionNotes: null
        })
        updatedCount++
      }

      await batch.commit()
      setResult(`Successfully reset ${updatedCount} assignment(s). All task assignments have been cleared.`)
      setShowConfirm(false)
    } catch (err) {
      console.error('Error resetting assignments:', err)
      setError('Failed to reset assignments: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  async function handleResetStatus() {
    setResetting(true)
    setError(null)
    setResult(null)

    try {
      const batch = writeBatch(db)
      let updatedCount = 0

      // Filter assignments based on status selection
      const assignmentsToReset = statusToReset === 'all'
        ? assignments.filter(a => a.status !== 'assigned')
        : assignments.filter(a => a.status === statusToReset)

      for (const assignment of assignmentsToReset) {
        // Reset completion status on tasks but keep assignments
        const resetTasks = assignment.tasks?.map(task => ({
          ...task,
          completed: false,
          completedAt: null,
          notes: ''
        })) || []

        const docRef = doc(db, 'detailAssignments', assignment.id)
        batch.update(docRef, {
          tasks: resetTasks,
          status: 'assigned',
          startedAt: null,
          startedBy: null,
          completedAt: null,
          completedBy: null,
          approvedAt: null,
          approvedBy: null,
          rejectionReason: null,
          completionNotes: null
        })
        updatedCount++
      }

      await batch.commit()
      setResult(`Successfully reset status on ${updatedCount} assignment(s). Task assignments preserved.`)
      setShowConfirm(false)
    } catch (err) {
      console.error('Error resetting status:', err)
      setError('Failed to reset status: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  function handleReset() {
    if (resetType === 'assignments') {
      handleResetAssignments()
    } else {
      handleResetStatus()
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">Loading assignments...</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset Detail Assignments</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {result}
        </div>
      )}

      {/* Current Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Current Assignment Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Assignments:</span>
            <span className="ml-2 font-semibold">{assignments.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Task Assignments:</span>
            <span className="ml-2 font-semibold">{totalTaskAssignments}</span>
          </div>
          <div>
            <span className="text-blue-600">Assigned:</span>
            <span className="ml-2 font-semibold">{statusCounts.assigned || 0}</span>
          </div>
          <div>
            <span className="text-yellow-600">In Progress:</span>
            <span className="ml-2 font-semibold">{statusCounts.in_progress || 0}</span>
          </div>
          <div>
            <span className="text-purple-600">Completed:</span>
            <span className="ml-2 font-semibold">{statusCounts.completed || 0}</span>
          </div>
          <div>
            <span className="text-green-600">Approved:</span>
            <span className="ml-2 font-semibold">{statusCounts.approved || 0}</span>
          </div>
          <div>
            <span className="text-red-600">Rejected:</span>
            <span className="ml-2 font-semibold">{statusCounts.rejected || 0}</span>
          </div>
        </div>
      </div>

      {/* Reset Options */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reset Type
          </label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="resetType"
                value="assignments"
                checked={resetType === 'assignments'}
                onChange={(e) => setResetType(e.target.value)}
                className="mt-1"
              />
              <div>
                <span className="font-medium text-gray-900">Clear All Task Assignments</span>
                <p className="text-sm text-gray-600">
                  Remove all personnel from tasks, reset completion status, and set status back to "Assigned".
                  Users will need to re-claim tasks.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="resetType"
                value="status"
                checked={resetType === 'status'}
                onChange={(e) => setResetType(e.target.value)}
                className="mt-1"
              />
              <div>
                <span className="font-medium text-gray-900">Reset Status Only</span>
                <p className="text-sm text-gray-600">
                  Keep task assignments but reset completion status and overall status back to "Assigned".
                  Personnel stay assigned to their tasks.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Apply To
          </label>
          <select
            value={statusToReset}
            onChange={(e) => setStatusToReset(e.target.value)}
            className="input"
          >
            <option value="all">All Assignments ({assignments.length})</option>
            <option value="assigned">Assigned Only ({statusCounts.assigned || 0})</option>
            <option value="in_progress">In Progress Only ({statusCounts.in_progress || 0})</option>
            <option value="completed">Completed Only ({statusCounts.completed || 0})</option>
            <option value="rejected">Rejected Only ({statusCounts.rejected || 0})</option>
          </select>
        </div>

        <div className="pt-4">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={assignments.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Assignments
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Confirm Reset</h3>
            <div className="text-sm text-gray-600 mb-4 space-y-2">
              <p>
                <strong>Reset Type:</strong>{' '}
                {resetType === 'assignments' ? 'Clear All Task Assignments' : 'Reset Status Only'}
              </p>
              <p>
                <strong>Apply To:</strong>{' '}
                {statusToReset === 'all' ? 'All Assignments' : `${statusToReset} assignments only`}
              </p>
              {resetType === 'assignments' && (
                <p className="text-red-600 font-medium">
                  This will remove all personnel from tasks. They will need to re-claim tasks.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
