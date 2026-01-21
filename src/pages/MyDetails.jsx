import { useState } from 'react'
import { useMyDetailAssignments } from '../hooks/useDetailAssignments'
import { useAuth } from '../contexts/AuthContext'
import Loading from '../components/common/Loading'
import DetailChecklistView from '../components/details/DetailChecklistView'
import { format } from 'date-fns'

export default function MyDetails() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const { myAssignments, loading, error } = useMyDetailAssignments(statusFilter)

  // Debug logging
  console.log('MyDetails Debug:', {
    userUid: user?.uid,
    assignmentsCount: myAssignments.length,
    assignments: myAssignments,
    statusFilter
  })

  if (loading) {
    return <Loading />
  }

  const upcomingAssignments = myAssignments.filter(a =>
    a.status === 'assigned' || a.status === 'in_progress'
  )
  const completedAssignments = myAssignments.filter(a =>
    a.status === 'completed' || a.status === 'approved'
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Cleaning Details</h1>
        <p className="text-gray-600">View and complete your assigned cleaning tasks</p>

        {/* Debug Info */}
        {/* <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <strong>Debug:</strong> Your Firebase UID: <code className="bg-yellow-100 px-1">{user?.uid}</code>
          <br />
          Check Firestore → personnel collection → your record → userId field must match this UID
        </div> */}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === null
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({myAssignments.length})
        </button>
        <button
          onClick={() => setStatusFilter('assigned')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'assigned'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Upcoming ({upcomingAssignments.length})
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'completed'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Completed ({completedAssignments.length})
        </button>
      </div>

      {/* Assignments List */}
      {myAssignments.length === 0 ? (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No assignments yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have any cleaning details assigned at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {myAssignments.map((assignment) => {
            const dueDate = assignment.dueDateTime?.toDate
              ? assignment.dueDateTime.toDate()
              : new Date(assignment.dueDateTime)

            // Get tasks assigned to this user
            const myTasks = assignment.tasks?.filter(
              t => t.assignedTo?.personnelId === user.uid
            ) || []

            const completedTasks = myTasks.filter(t => t.completed).length
            const totalTasks = myTasks.length

            const statusColors = {
              assigned: 'bg-blue-100 text-blue-700',
              in_progress: 'bg-yellow-100 text-yellow-700',
              completed: 'bg-purple-100 text-purple-700',
              approved: 'bg-green-100 text-green-700',
            }

            const statusLabels = {
              assigned: 'Assigned',
              in_progress: 'In Progress',
              completed: 'Completed',
              approved: 'Approved',
            }

            return (
              <div key={assignment.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{assignment.templateName}</h3>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                      <span>{format(new Date(assignment.assignmentDate), 'EEEE, MMM d, yyyy')}</span>
                      <span>•</span>
                      <span className="capitalize">{assignment.timeSlot}</span>
                      <span>•</span>
                      <span>Due: {format(dueDate, 'h:mm a')}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                      statusColors[assignment.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusLabels[assignment.status] || assignment.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900">
                      {completedTasks}/{totalTasks} tasks
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Task Summary */}
                <div className="text-sm text-gray-600 mb-3">
                  <div className="font-medium mb-1">Your tasks:</div>
                  <div className="space-y-1">
                    {myTasks.slice(0, 3).map((task, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={task.completed ? 'line-through text-gray-400' : ''}>
                          • {task.areaName} - {task.taskText}
                          {task.location !== 'All' && ` (${task.location})`}
                        </span>
                      </div>
                    ))}
                    {myTasks.length > 3 && (
                      <div className="text-gray-500 italic">
                        + {myTasks.length - 3} more task{myTasks.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {assignment.notes && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 mb-3">
                    <span className="font-medium">Note: </span>
                    {assignment.notes}
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedAssignment(assignment)}
                    className="btn-primary w-full"
                  >
                    {assignment.status === 'assigned' ? 'Start Detail' : 'View Details'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Checklist Modal */}
      {selectedAssignment && (
        <DetailChecklistView
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
        />
      )}
    </div>
  )
}
