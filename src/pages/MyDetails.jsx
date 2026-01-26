import { useState } from 'react'
import { useMyDetailAssignments, useDetailAssignments } from '../hooks/useDetailAssignments'
import { useAuth } from '../contexts/AuthContext'
import { useMyPersonnelIds } from '../hooks/useMyPersonnelIds'
import Loading from '../components/common/Loading'
import DetailChecklistView from '../components/details/DetailChecklistView'
import { format } from 'date-fns'

export default function MyDetails() {
  const { user } = useAuth()
  const { isCurrentUser } = useMyPersonnelIds()
  const [activeTab, setActiveTab] = useState('available') // 'my' or 'available' - default to available
  const [statusFilter, setStatusFilter] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState(null)

  // Get user's assignments
  const { myAssignments, loading: myLoading, error: myError } = useMyDetailAssignments(statusFilter)

  // Get all assignments (for browsing available tasks)
  const { assignments: allAssignments, loading: allLoading, error: allError } = useDetailAssignments()

  // Wait for both to load to avoid flicker
  const loading = myLoading || allLoading
  const error = activeTab === 'my' ? myError : allError

  if (loading) {
    return <Loading />
  }

  const upcomingAssignments = myAssignments.filter(a =>
    a.status === 'assigned' || a.status === 'in_progress' || a.status === 'rejected'
  )
  const completedAssignments = myAssignments.filter(a =>
    a.status === 'completed' || a.status === 'approved'
  )

  // Show all active assignments (not completed/approved) for browsing and claiming
  const availableAssignments = allAssignments.filter(a => {
    // Only show active assignments (not completed/approved)
    return a.status !== 'completed' && a.status !== 'approved'
  })

  // Count unclaimed tasks across all available assignments
  const totalUnclaimedTasks = availableAssignments.reduce((count, a) => {
    return count + (a.tasks?.filter(t => !t.assignedTo?.personnelId).length || 0)
  }, 0)

  const displayedAssignments = activeTab === 'my' ? myAssignments : availableAssignments

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cleaning Details</h1>
        <p className="text-gray-600">View, claim, and complete your cleaning tasks</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Main Tabs: My Details vs Available */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => { setActiveTab('my'); setStatusFilter(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'my'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          My Details ({myAssignments.length})
        </button>
        <button
          onClick={() => { setActiveTab('available'); setStatusFilter(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'available'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Available Tasks
          {totalUnclaimedTasks > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full">
              {totalUnclaimedTasks} unclaimed
            </span>
          )}
        </button>
      </div>

      {/* Sub-filter Tabs for My Details */}
      {activeTab === 'my' && (
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
      )}

      {/* Info Banner for Available Tab */}
      {activeTab === 'available' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Browse and claim tasks:</strong> Click on any detail to view all tasks.
          You can claim unclaimed tasks (shown in yellow) for yourself.
        </div>
      )}

      {/* Assignments List */}
      {displayedAssignments.length === 0 ? (
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {activeTab === 'my' ? 'No assignments yet' : 'No cleaning details available'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === 'my'
              ? "You don't have any cleaning details assigned at this time. Check the 'Available Tasks' tab to claim tasks."
              : "No cleaning detail assignments have been created yet. An admin needs to create a detail assignment first."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedAssignments.map((assignment) => {
            const dueDate = assignment.dueDateTime?.toDate
              ? assignment.dueDateTime.toDate()
              : new Date(assignment.dueDateTime)

            // Get tasks for display
            const myTasks = assignment.tasks?.filter(
              t => isCurrentUser(t.assignedTo?.personnelId)
            ) || []

            const unclaimedTasks = assignment.tasks?.filter(
              t => !t.assignedTo?.personnelId
            ) || []

            const completedTasks = myTasks.filter(t => t.completed).length
            const totalMyTasks = myTasks.length

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
              rejected: 'Needs Redo',
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
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                        statusColors[assignment.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {statusLabels[assignment.status] || assignment.status}
                    </span>
                    {unclaimedTasks.length > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        {unclaimedTasks.length} unclaimed
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar (for my tasks) */}
                {totalMyTasks > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Your Progress</span>
                      <span className="font-medium text-gray-900">
                        {completedTasks}/{totalMyTasks} tasks
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${totalMyTasks > 0 ? (completedTasks / totalMyTasks) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Task Summary */}
                <div className="text-sm text-gray-600 mb-3">
                  {totalMyTasks > 0 ? (
                    <>
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
                    </>
                  ) : unclaimedTasks.length > 0 ? (
                    <>
                      <div className="font-medium mb-1 text-yellow-700">Unclaimed tasks available:</div>
                      <div className="space-y-1">
                        {unclaimedTasks.slice(0, 3).map((task, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-yellow-700">
                            • {task.areaName} - {task.taskText}
                            {task.location !== 'All' && ` (${task.location})`}
                          </div>
                        ))}
                        {unclaimedTasks.length > 3 && (
                          <div className="text-yellow-600 italic">
                            + {unclaimedTasks.length - 3} more unclaimed
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="italic text-gray-500">All tasks are assigned to others</div>
                  )}
                </div>

                {assignment.notes && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 mb-3">
                    <span className="font-medium">Note: </span>
                    {assignment.notes}
                  </div>
                )}

                {assignment.rejectionReason && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-900 mb-3">
                    <span className="font-medium">Rejection Reason: </span>
                    {assignment.rejectionReason}
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedAssignment(assignment)}
                    className={`w-full ${
                      unclaimedTasks.length > 0 && totalMyTasks === 0
                        ? 'btn-secondary border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-800'
                        : 'btn-primary'
                    }`}
                  >
                    {totalMyTasks === 0 && unclaimedTasks.length > 0
                      ? 'View & Claim Tasks'
                      : assignment.status === 'assigned'
                        ? 'Start Detail'
                        : 'View Details'}
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
