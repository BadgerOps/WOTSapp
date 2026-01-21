import { useState } from 'react'
import { useDetailHistory } from '../../hooks/useDetailAssignments'
import Loading from '../common/Loading'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export default function DetailHistory() {
  const [dateRange, setDateRange] = useState('week') // week, month, all
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedPersonnel, setSelectedPersonnel] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('approved') // approved, rejected, all
  const [expandedId, setExpandedId] = useState(null)

  const { history, loading, error, templates, personnel } = useDetailHistory({
    dateRange,
    templateId: selectedTemplate || null,
    personnelId: selectedPersonnel || null,
    status: selectedStatus === 'all' ? null : selectedStatus,
  })

  if (loading) {
    return <Loading />
  }

  // Calculate statistics
  const totalCompleted = history.length
  const approvedCount = history.filter(h => h.status === 'approved').length
  const rejectedCount = history.filter(h => h.status === 'rejected').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Detail History</h2>
        <p className="text-sm text-gray-600 mt-1">
          View completed cleaning detail records
        </p>
      </div>

      {/* Filters */}
      <div className="card bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input text-sm"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Template Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Templates</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Personnel Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personnel
            </label>
            <select
              value={selectedPersonnel}
              onChange={(e) => setSelectedPersonnel(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Personnel</option>
              {personnel.map((person) => (
                <option key={person.id} value={person.userId || person.id}>
                  {person.rank && `${person.rank} `}
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved Only</option>
              <option value="rejected">Rejected Only</option>
            </select>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-6">
          <div>
            <span className="text-xs text-gray-600">Total:</span>
            <span className="ml-2 font-semibold text-gray-900">{totalCompleted}</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">Approved:</span>
            <span className="ml-2 font-semibold text-green-700">{approvedCount}</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">Rejected:</span>
            <span className="ml-2 font-semibold text-red-700">{rejectedCount}</span>
          </div>
          {approvedCount + rejectedCount > 0 && (
            <div>
              <span className="text-xs text-gray-600">Approval Rate:</span>
              <span className="ml-2 font-semibold text-primary-700">
                {Math.round((approvedCount / (approvedCount + rejectedCount)) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* History List */}
      {history.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No history found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No completed details match your current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => {
            const isExpanded = expandedId === record.id
            const completedTasks = record.tasks?.filter(t => t.completed).length || 0
            const totalTasks = record.tasks?.length || 0
            const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

            const statusColors = {
              approved: 'bg-green-100 text-green-700 border-green-200',
              rejected: 'bg-red-100 text-red-700 border-red-200',
            }

            return (
              <div key={record.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <h3 className="font-semibold text-gray-900">{record.templateName}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                          statusColors[record.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {record.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                      <span>{format(new Date(record.assignmentDate), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span className="capitalize">{record.timeSlot}</span>
                      {record.completedAt && (
                        <>
                          <span>•</span>
                          <span>Completed: {format(record.completedAt.toDate(), 'h:mm a')}</span>
                        </>
                      )}
                      {record.approvedAt && (
                        <>
                          <span>•</span>
                          <span>Approved: {format(record.approvedAt.toDate(), 'MMM d, h:mm a')}</span>
                        </>
                      )}
                      {record.rejectedAt && (
                        <>
                          <span>•</span>
                          <span>Rejected: {format(record.rejectedAt.toDate(), 'MMM d, h:mm a')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className="text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap ml-2"
                  >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {/* Personnel with task assignments */}
                <div className="mb-2 text-sm">
                  <span className="font-medium text-gray-700">Personnel: </span>
                  <span className="text-gray-600">
                    {(() => {
                      const uniquePersonnel = new Set()
                      record.tasks?.forEach(task => {
                        if (task.assignedTo?.name) {
                          uniquePersonnel.add(task.assignedTo.name)
                        }
                      })
                      return Array.from(uniquePersonnel).join(', ') || 'None'
                    })()}
                  </span>
                </div>

                {/* Completion Stats */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Tasks Completed</span>
                    <span className="font-medium text-gray-900">
                      {completedTasks}/{totalTasks} ({Math.round(completionRate)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        record.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Notes */}
                {record.completionNotes && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <span className="font-medium text-blue-900">Completion Notes: </span>
                    <span className="text-blue-800">{record.completionNotes}</span>
                  </div>
                )}

                {record.rejectionReason && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <span className="font-medium text-red-900">Rejection Reason: </span>
                    <span className="text-red-800">{record.rejectionReason}</span>
                  </div>
                )}

                {/* Approver Info */}
                {record.approvedBy && (
                  <div className="text-xs text-gray-600">
                    Approved by: {record.approvedByName}
                  </div>
                )}
                {record.rejectedBy && (
                  <div className="text-xs text-gray-600">
                    Rejected by: {record.rejectedByName}
                  </div>
                )}

                {/* Expanded Task Details */}
                {isExpanded && record.tasks && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Task Breakdown</h4>
                    <div className="space-y-2">
                      {Object.entries(
                        record.tasks.reduce((acc, task) => {
                          if (!acc[task.areaName]) acc[task.areaName] = []
                          acc[task.areaName].push(task)
                          return acc
                        }, {})
                      ).map(([areaName, tasks]) => (
                        <div key={areaName} className="text-xs">
                          <div className="font-medium text-gray-700 mb-1">
                            {areaName} ({tasks.filter(t => t.completed).length}/{tasks.length})
                          </div>
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
                                <div className="flex-1">
                                  <span className="text-gray-600">
                                    {task.taskText}
                                    {task.location !== 'All' && ` (${task.location})`}
                                  </span>
                                  {task.assignedTo && (
                                    <span className="ml-2 text-gray-500">- {task.assignedTo.name}</span>
                                  )}
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
