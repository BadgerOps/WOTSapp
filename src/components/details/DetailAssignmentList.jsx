import { useState } from 'react'
import { useDetailAssignments, useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import Loading from '../common/Loading'
import { format } from 'date-fns'

export default function DetailAssignmentList() {
  const { assignments, loading, error } = useDetailAssignments()
  const { deleteAssignment, loading: deleting } = useDetailAssignmentActions()
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  async function handleDelete(assignmentId) {
    try {
      await deleteAssignment(assignmentId)
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('Error deleting assignment:', err)
      alert('Failed to delete assignment: ' + err.message)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Assignments</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500 italic py-4">
          No assignments yet. Create an assignment using the form above.
        </p>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const dueDate = assignment.dueDateTime?.toDate
              ? assignment.dueDateTime.toDate()
              : new Date(assignment.dueDateTime)

            const isExpanded = expandedId === assignment.id

            const statusColors = {
              assigned: 'bg-blue-100 text-blue-700',
              in_progress: 'bg-yellow-100 text-yellow-700',
              completed: 'bg-purple-100 text-purple-700',
              approved: 'bg-green-100 text-green-700',
              rejected: 'bg-red-100 text-red-700',
            }

            const statusLabels = {
              assigned: 'Assigned',
              in_progress: 'In Progress',
              completed: 'Completed',
              approved: 'Approved',
              rejected: 'Rejected',
            }

            // Get unique personnel with task assignments
            const tasksByPerson = {}
            assignment.tasks?.forEach(task => {
              if (task.assignedTo) {
                const personKey = task.assignedTo.personnelId
                if (!tasksByPerson[personKey]) {
                  tasksByPerson[personKey] = {
                    name: task.assignedTo.name,
                    rank: task.assignedTo.rank,
                    tasks: []
                  }
                }
                tasksByPerson[personKey].tasks.push(task)
              }
            })

            const completedTaskCount = assignment.tasks?.filter(t => t.completed).length || 0
            const totalTaskCount = assignment.tasks?.length || 0

            return (
              <div
                key={assignment.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="font-medium text-gray-900 flex-1">{assignment.templateName}</h3>
                      <button
                        onClick={() => setDeleteConfirmId(assignment.id)}
                        className="text-red-600 hover:text-red-700 text-xs"
                        title="Delete assignment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                      <span>
                        {format(new Date(assignment.assignmentDate), 'MMM d, yyyy')}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{assignment.timeSlot}</span>
                      <span>•</span>
                      <span className="capitalize">{assignment.assignmentType}</span>
                      {assignment.squad && (
                        <>
                          <span>•</span>
                          <span>Squad: {assignment.squad}</span>
                        </>
                      )}
                      {assignment.flight && (
                        <>
                          <span>•</span>
                          <span>Flight: {assignment.flight}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[assignment.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusLabels[assignment.status] || assignment.status}
                  </span>
                </div>

                {/* Personnel Assigned Summary */}
                <div className="mt-2 text-sm">
                  <span className="font-medium text-gray-700">Assigned to: </span>
                  <span className="text-gray-600">
                    {Object.values(tasksByPerson).map(person => person.name).join(', ') || 'No assignments yet'}
                  </span>
                </div>

                {/* Task Progress */}
                {totalTaskCount > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Tasks: {completedTaskCount}/{totalTaskCount} completed
                  </div>
                )}

                {assignment.notes && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <span className="font-medium">Notes: </span>
                    {assignment.notes}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Due: {format(dueDate, 'MMM d, yyyy h:mm a')}
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    {/* Completion/Approval Info */}
                    {assignment.completionNotes && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                        <span className="font-medium text-blue-900">Completion Notes: </span>
                        <span className="text-blue-800">{assignment.completionNotes}</span>
                      </div>
                    )}

                    {assignment.rejectionReason && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                        <span className="font-medium text-red-900">Rejection Reason: </span>
                        <span className="text-red-800">{assignment.rejectionReason}</span>
                      </div>
                    )}

                    {assignment.approvedBy && (
                      <div className="text-xs text-gray-600">
                        Approved by: {assignment.approvedByName} on {assignment.approvedAt && format(assignment.approvedAt.toDate(), 'MMM d, h:mm a')}
                      </div>
                    )}

                    {assignment.rejectedBy && (
                      <div className="text-xs text-gray-600">
                        Rejected by: {assignment.rejectedByName} on {assignment.rejectedAt && format(assignment.rejectedAt.toDate(), 'MMM d, h:mm a')}
                      </div>
                    )}

                    {/* Task Breakdown by Person */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Task Assignments</h4>
                      {Object.keys(tasksByPerson).length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No tasks assigned yet</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.values(tasksByPerson).map((person, idx) => (
                            <div key={idx} className="border border-gray-200 rounded p-2">
                              <div className="font-medium text-xs text-gray-900 mb-1">
                                {person.name} ({person.tasks.filter(t => t.completed).length}/{person.tasks.length} completed)
                              </div>
                              <div className="space-y-1">
                                {person.tasks.map((task, taskIdx) => (
                                  <div key={taskIdx} className="flex items-start gap-2 text-xs">
                                    {task.completed ? (
                                      <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                      </svg>
                                    )}
                                    <div className="flex-1">
                                      <span className={task.completed ? 'text-gray-600 line-through' : 'text-gray-900'}>
                                        {task.taskText}
                                        {task.location !== 'All' && ` (${task.location})`}
                                      </span>
                                      {task.notes && (
                                        <div className="mt-1 text-gray-700 italic">
                                          Note: {task.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Assignment?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this assignment? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
