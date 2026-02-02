import { useState, useMemo } from 'react'
import {
  useAllLibertyRequests,
  getNextWeekendDates,
  LIBERTY_REQUEST_STATUS,
} from '../../hooks/useLibertyRequests'
import Loading from '../common/Loading'

function formatDate(dateString) {
  if (!dateString) return '--'
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeString) {
  if (!timeString) return '--:--'
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '--'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function LibertyRequestsManager() {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWeekend, setFilterWeekend] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { requests, loading, error } = useAllLibertyRequests(
    filterStatus || null,
    filterWeekend || null
  )

  // Get upcoming weekends for filter dropdown
  const weekendOptions = useMemo(() => {
    const options = []
    const today = new Date()

    // Get next 4 weekends
    for (let i = 0; i < 4; i++) {
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
      const saturday = new Date(today)
      saturday.setDate(today.getDate() + daysUntilSaturday + i * 7)
      saturday.setHours(0, 0, 0, 0)

      const dateStr = saturday.toISOString().split('T')[0]
      const label = saturday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })

      options.push({ value: dateStr, label: `Weekend of ${label}` })
    }

    // Also include past 2 weekends
    for (let i = 1; i <= 2; i++) {
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
      const saturday = new Date(today)
      saturday.setDate(today.getDate() + daysUntilSaturday - i * 7)
      saturday.setHours(0, 0, 0, 0)

      const dateStr = saturday.toISOString().split('T')[0]
      const label = saturday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })

      options.unshift({ value: dateStr, label: `Weekend of ${label} (past)` })
    }

    return options
  }, [])

  // Export to CSV
  function exportToCSV() {
    if (requests.length === 0) return

    const headers = [
      'Requester',
      'Destination',
      'Departure Date',
      'Departure Time',
      'Return Date',
      'Return Time',
      'Contact Number',
      'Purpose',
      'Companions',
      'Status',
      'Submitted At',
      'Approved/Rejected By',
      'Notes',
    ]

    const rows = requests.map((r) => [
      r.requesterName || '',
      r.destination || '',
      r.departureDate || '',
      r.departureTime || '',
      r.returnDate || '',
      r.returnTime || '',
      r.contactNumber || '',
      r.purpose || '',
      r.companions?.map((c) => c.name).join('; ') || '',
      r.status || '',
      r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : '',
      r.approvedByName || r.rejectedByName || '',
      r.notes || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    const weekendLabel = filterWeekend
      ? `_${filterWeekend}`
      : `_${new Date().toISOString().split('T')[0]}`
    const statusLabel = filterStatus ? `_${filterStatus}` : ''

    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `liberty_requests${weekendLabel}${statusLabel}.csv`
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return <Loading />

  // Count by status
  const statusCounts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Liberty Requests
          </h2>
          <p className="text-sm text-gray-600">
            View and export weekend liberty requests
          </p>
        </div>

        <button
          onClick={exportToCSV}
          disabled={requests.length === 0}
          className="btn-primary disabled:opacity-50 flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export CSV ({requests.length})
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weekend
            </label>
            <select
              value={filterWeekend}
              onChange={(e) => setFilterWeekend(e.target.value)}
              className="input"
            >
              <option value="">All Weekends</option>
              {weekendOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            Total: <strong>{requests.length}</strong>
          </span>
          {Object.entries(statusCounts).map(([status, count]) => (
            <span
              key={status}
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[status]}`}
            >
              {LIBERTY_REQUEST_STATUS[status]?.label || status}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Requests Table */}
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No liberty requests found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {filterStatus || filterWeekend
              ? 'Try adjusting your filters.'
              : 'No requests have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Departure
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Return
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => {
                  const isExpanded = expandedId === request.id
                  const companionCount = request.companions?.length || 0

                  return (
                    <>
                      <tr
                        key={request.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : request.id)
                        }
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {request.requesterName}
                          </div>
                          {companionCount > 0 && (
                            <div className="text-xs text-gray-500">
                              +{companionCount} companion
                              {companionCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {request.destination}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">
                          {formatDate(request.departureDate)}{' '}
                          {formatTime(request.departureTime)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">
                          {formatDate(request.returnDate)}{' '}
                          {formatTime(request.returnTime)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[request.status]}`}
                          >
                            {LIBERTY_REQUEST_STATUS[request.status]?.label ||
                              request.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button className="text-primary-600 hover:text-primary-700">
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr key={`${request.id}-details`}>
                          <td
                            colSpan={6}
                            className="px-4 py-4 bg-gray-50 border-t border-b border-gray-200"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">
                                  Weekend:{' '}
                                </span>
                                <span className="text-gray-600">
                                  {formatDate(request.weekendDate)}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Contact:{' '}
                                </span>
                                <span className="text-gray-600">
                                  {request.contactNumber || '--'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Submitted:{' '}
                                </span>
                                <span className="text-gray-600">
                                  {formatTimestamp(request.createdAt)}
                                </span>
                              </div>
                              <div className="md:col-span-2 lg:col-span-3">
                                <span className="font-medium text-gray-700">
                                  Purpose:{' '}
                                </span>
                                <span className="text-gray-600">
                                  {request.purpose || '--'}
                                </span>
                              </div>
                              {companionCount > 0 && (
                                <div className="md:col-span-2 lg:col-span-3">
                                  <span className="font-medium text-gray-700">
                                    Companions:{' '}
                                  </span>
                                  <span className="text-gray-600">
                                    {request.companions
                                      .map((c) => c.name)
                                      .join(', ')}
                                  </span>
                                </div>
                              )}
                              {request.notes && (
                                <div className="md:col-span-2 lg:col-span-3">
                                  <span className="font-medium text-gray-700">
                                    Notes:{' '}
                                  </span>
                                  <span className="text-gray-600">
                                    {request.notes}
                                  </span>
                                </div>
                              )}
                              {request.status === 'approved' && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Approved by:{' '}
                                  </span>
                                  <span className="text-gray-600">
                                    {request.approvedByName} (
                                    {request.approverInitials})
                                  </span>
                                </div>
                              )}
                              {request.status === 'rejected' && (
                                <>
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Rejected by:{' '}
                                    </span>
                                    <span className="text-gray-600">
                                      {request.rejectedByName}
                                    </span>
                                  </div>
                                  {request.rejectionReason && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-gray-700">
                                        Reason:{' '}
                                      </span>
                                      <span className="text-gray-600">
                                        {request.rejectionReason}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
