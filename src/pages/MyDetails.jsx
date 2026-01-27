import { useState } from 'react'
import { useMyDetailAssignments } from '../hooks/useDetailAssignments'
import { useDetailTemplates } from '../hooks/useDetailTemplates'
import { useAuth } from '../contexts/AuthContext'
import { useMyPersonnelIds } from '../hooks/useMyPersonnelIds'
import Loading from '../components/common/Loading'
import DetailChecklistView from '../components/details/DetailChecklistView'
import TemplateTaskSelector from '../components/details/TemplateTaskSelector'
import { format, isValid, parseISO } from 'date-fns'

/**
 * Safely parse a date value that could be a Firestore Timestamp, Date, or string
 */
function safeParseDate(value) {
  if (!value) return null
  // Firestore Timestamp
  if (value?.toDate) {
    const date = value.toDate()
    return isValid(date) ? date : null
  }
  // Already a Date
  if (value instanceof Date) return isValid(value) ? value : null
  // ISO string or other string format
  if (typeof value === 'string') {
    // Handle YYYY-MM-DD format specifically
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(value + 'T00:00:00')
      return isValid(parsed) ? parsed : null
    }
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }
  // Number (timestamp in ms)
  if (typeof value === 'number') {
    const date = new Date(value)
    return isValid(date) ? date : null
  }
  return null
}

export default function MyDetails() {
  const { user } = useAuth()
  const { isCurrentUser } = useMyPersonnelIds()
  const [activeTab, setActiveTab] = useState('templates') // 'my' or 'templates'
  const [statusFilter, setStatusFilter] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Get user's assignments
  const { myAssignments, loading: myLoading, error: myError } = useMyDetailAssignments(statusFilter)

  // Get all active templates (for browsing and self-assignment)
  const { templates, loading: templatesLoading, error: templatesError } = useDetailTemplates(true)

  const loading = myLoading || templatesLoading
  const error = activeTab === 'my' ? myError : templatesError

  if (loading) {
    return <Loading />
  }

  const upcomingAssignments = myAssignments.filter(a =>
    a.status === 'assigned' || a.status === 'in_progress' || a.status === 'rejected'
  )
  const completedAssignments = myAssignments.filter(a =>
    a.status === 'completed' || a.status === 'approved'
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cleaning Details</h1>
        <p className="text-gray-600">View task lists and sign up for cleaning details</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Main Tabs: My Details vs Task Lists */}
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

      {/* Info Banner for Templates Tab */}
      {activeTab === 'templates' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Sign up for tasks:</strong> Click on any task list to view and select tasks to assign to yourself.
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
              const totalTasks = template.areas?.reduce((count, area) => {
                const locations = area.locations?.length > 0 ? area.locations.length : 1
                return count + ((area.items?.length || 0) * locations)
              }, 0) || 0
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
                      {template.areas?.slice(0, 6).map((area, idx) => {
                        const locations = area.locations?.length > 0 ? area.locations.length : 1
                        const taskCount = (area.items?.length || 0) * locations
                        return (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {area.name} ({taskCount})
                          </span>
                        )
                      })}
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
                      className="w-full btn-primary"
                    >
                      View Tasks & Sign Up
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* My Assignments List */}
      {activeTab === 'my' && (
        myAssignments.length === 0 ? (
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
              You don't have any cleaning details assigned. Go to the 'Task Lists' tab to sign up for tasks.
            </p>
            <button
              onClick={() => setActiveTab('templates')}
              className="mt-4 btn-primary"
            >
              Browse Task Lists
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myAssignments.map((assignment) => {
              const dueDate = safeParseDate(assignment.dueDateTime)
              const assignmentDate = safeParseDate(assignment.assignmentDate)

              // Get tasks for display
              const myTasks = assignment.tasks?.filter(
                t => isCurrentUser(t.assignedTo?.personnelId)
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
                        <span>{assignmentDate ? format(assignmentDate, 'EEEE, MMM d, yyyy') : 'Unknown date'}</span>
                        <span>•</span>
                        <span className="capitalize">{assignment.timeSlot}</span>
                        {dueDate && (
                          <>
                            <span>•</span>
                            <span>Due: {format(dueDate, 'h:mm a')}</span>
                          </>
                        )}
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
                      className="w-full btn-primary"
                    >
                      {assignment.status === 'assigned'
                        ? 'Start Detail'
                        : assignment.status === 'rejected'
                          ? 'Redo Detail'
                          : 'View Details'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Template Task Selector Modal */}
      {selectedTemplate && (
        <TemplateTaskSelector
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSuccess={() => setActiveTab('my')}
        />
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
