import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useMyLibertyRequests,
  getNextWeekendDates,
  isBeforeDeadline,
  getDeadlineDate,
  getDeadlineDayName,
} from '../../hooks/useLibertyRequests'
import { useAppConfig } from '../../hooks/useAppConfig'
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

export default function MyLibertyCard() {
  const { requests, loading, error } = useMyLibertyRequests()
  const { config, loading: configLoading } = useAppConfig()

  // Get weekend dates
  const { saturday, sunday } = getNextWeekendDates()
  const weekendDateStr = saturday.toISOString().split('T')[0]
  const canSubmit = isBeforeDeadline(config)
  const deadline = getDeadlineDate(config)
  const deadlineDayName = getDeadlineDayName(config?.libertyDeadlineDayOfWeek)

  // Get pending or approved liberty request for this weekend
  const weekendRequest = useMemo(() => {
    return requests.find(
      (r) =>
        (r.status === 'pending' || r.status === 'approved') &&
        r.weekendDate === weekendDateStr
    )
  }, [requests, weekendDateStr])

  // Don't show if loading or no relevant request and deadline passed
  if (loading || configLoading) return null

  // Don't show card if no request and can't submit
  if (!weekendRequest && !canSubmit) return null

  // If there's an approved request, show it prominently
  if (weekendRequest?.status === 'approved') {
    return (
      <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <svg
              className="w-6 h-6 text-green-600"
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
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-green-800">Weekend Liberty Approved</h3>
            </div>
            <div className="mt-1 text-sm text-green-700 space-y-1">
              <p>
                <span className="font-medium">Destination:</span> {weekendRequest.destination}
              </p>
              <p>
                <span className="font-medium">Depart:</span> {formatDate(weekendRequest.departureDate)} at {formatTime(weekendRequest.departureTime)}
              </p>
              <p>
                <span className="font-medium">Return:</span> {formatDate(weekendRequest.returnDate)} at {formatTime(weekendRequest.returnTime)}
              </p>
              {weekendRequest.isDriver && (
                <p>
                  <span className="font-medium">Driver:</span> {weekendRequest.passengers?.length || 0}/{weekendRequest.passengerCapacity} passengers
                </p>
              )}
              {weekendRequest.companions?.length > 0 && (
                <p>
                  <span className="font-medium">With:</span> {weekendRequest.companions.map(c => c.name).join(', ')}
                </p>
              )}
            </div>
            <Link
              to="/cq"
              className="inline-block mt-2 text-sm text-green-600 hover:text-green-800 font-medium"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // If there's a pending request, show it
  if (weekendRequest?.status === 'pending') {
    return (
      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-yellow-800">Liberty Request Pending</h3>
              <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
            </div>
            <div className="mt-1 text-sm text-yellow-700">
              <p>{weekendRequest.destination}</p>
              <p className="text-xs mt-1">
                {formatDate(weekendRequest.departureDate)} - {formatDate(weekendRequest.returnDate)}
              </p>
            </div>
            <Link
              to="/cq"
              className="inline-block mt-2 text-sm text-yellow-600 hover:text-yellow-800 font-medium"
            >
              View Request
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // If no request and can submit, show prompt
  if (canSubmit) {
    return (
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-800">Plan Your Weekend Liberty</h3>
            <p className="mt-1 text-sm text-blue-700">
              Submit your liberty request for {saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Deadline: {deadlineDayName} {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <Link
              to="/cq"
              className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Submit Request
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}
