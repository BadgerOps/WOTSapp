import { useState } from 'react'
import { useMyDetailAssignments, useDetailAssignments } from '../hooks/useDetailAssignments'
import { useDetailTemplates } from '../hooks/useDetailTemplates'
import { useAuth } from '../contexts/AuthContext'
import { useMyPersonnelIds } from '../hooks/useMyPersonnelIds'
import Loading from '../components/common/Loading'
import DetailChecklistView from '../components/details/DetailChecklistView'
import { format } from 'date-fns'

export default function MyDetails() {
  const { user } = useAuth()
  const { isCurrentUser } = useMyPersonnelIds()
  const [activeTab, setActiveTab] = useState('available') // 'my', 'available', or 'templates'
  const [statusFilter, setStatusFilter] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Get user's assignments
  const { myAssignments, loading: myLoading, error: myError } = useMyDetailAssignments(statusFilter)

  // Get all assignments (for browsing available tasks)
  const { assignments: allAssignments, loading: allLoading, error: allError } = useDetailAssignments()

  // Get all active templates (for browsing available task lists)
  const { templates, loading: templatesLoading, error: templatesError } = useDetailTemplates(true)

  // Wait for all to load to avoid flicker
  const loading = myLoading || allLoading || templatesLoading
  const error = activeTab === 'my' ? myError : activeTab === 'templates' ? templatesError : allError

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

      {/* Main Tabs: My Details vs Available vs Templates */}
      <div className="mb-4 flex flex-wrap gap-2">
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
        <button
          onClick={() => { setActiveTab('templates'); setStatusFilter(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'templates'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Task Lists ({templates.length})
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

      {/* Info Banner for Templates Tab */}
      {activeTab === 'templates' && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
          <strong>Task Lists:</strong> Browse available cleaning task templates.
          These show what tasks are included in each detail type.
        </div>
      )}

      {/* Templates List */}
      {activeTab === 'templates' && (
        templates.length === 0 ? (
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No task lists available</h3>
            <p className="mt-1 text-sm text-gray-500">
              No cleaning detail templates have been created yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => {
              const totalTasks = template.areas?.reduce((count, area) => count + (area.tasks?.length || 0), 0) || 0
              const totalAreas = template.areas?.length || 0

              return (
                <div key={template.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {totalTasks} tasks
                    </span>
                  </div>

                  {/* Areas Summary */}
                  <div className="text-sm text-gray-600 mb-3">
                    <div className="font-medium mb-2">Areas ({totalAreas}):</div>
                    <div className="flex flex-wrap gap-2">
                      {template.areas?.slice(0, 6).map((area, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {area.name} ({area.tasks?.length || 0})
                        </span>
                      ))}
                      {template.areas?.length > 6 && (
                        <span className="px-2 py-1 text-gray-500 text-xs">
                          + {template.areas.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedTemplate(template)}
                      className="w-full btn-secondary"
                    >
                      View All Tasks
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Assignments List */}
      {activeTab !== 'templates' && (
        displayedAssignments.length === 0 ? (
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
                : "No cleaning detail assignments have been created yet. Check the 'Task Lists' tab to see available task templates."}
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
        )
      )}

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedTemplate.name}</h2>
                  {selectedTemplate.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {selectedTemplate.areas?.map((area, areaIdx) => (
                  <div key={areaIdx} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {area.name}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({area.tasks?.length || 0} tasks)
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {area.tasks?.map((task, taskIdx) => (
                        <div key={taskIdx} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <div className="flex-1">
                            <span className="text-gray-900">{task.text}</span>
                            {task.locations && task.locations.length > 0 && task.locations[0] !== 'All' && (
                              <span className="text-gray-500 ml-1">
                                (Locations: {task.locations.join(', ')})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="w-full btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
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
