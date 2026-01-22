import { useMyCQShift, useCQScheduleActions } from '../../hooks/useCQSchedule'
import { useAppConfig } from '../../hooks/useAppConfig'
import { format } from 'date-fns'

export default function MyCQShiftCard() {
  const { myShift, loading, error } = useMyCQShift()
  const { config } = useAppConfig()
  const { startShift, completeShift, loading: actionLoading, error: actionError } = useCQScheduleActions()

  if (loading) return null

  // Only show if user has a CQ shift today
  if (!myShift) {
    return null
  }

  const isFirstShift = myShift.myShiftType === 'first'
  const isActive = myShift.status === 'active'
  const isScheduled = myShift.status === 'scheduled'

  // Determine if current time is within the shift window
  const now = new Date()
  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()
  const currentTime = currentHours * 60 + currentMinutes

  // Parse shift times
  const [startH, startM] = myShift.myShiftStart.split(':').map(Number)
  const [endH, endM] = myShift.myShiftEnd.split(':').map(Number)
  const shiftStart = startH * 60 + startM
  let shiftEnd = endH * 60 + endM

  // Handle overnight shifts (end time is next day)
  const isOvernight = shiftEnd < shiftStart
  let isWithinShiftWindow = false

  if (isOvernight) {
    // For overnight shift (e.g., 20:00-01:00), window is 20:00-23:59 OR 00:00-01:00
    isWithinShiftWindow = currentTime >= shiftStart || currentTime <= shiftEnd
  } else {
    isWithinShiftWindow = currentTime >= shiftStart && currentTime <= shiftEnd
  }

  // Format times for display
  function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  async function handleStart() {
    try {
      await startShift(myShift.id)
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleComplete() {
    try {
      await completeShift(myShift.id)
    } catch (err) {
      // Error handled by hook
    }
  }

  function getStatusColor() {
    if (isActive) return 'bg-green-50 border-green-200'
    if (isWithinShiftWindow) return 'bg-yellow-50 border-yellow-200'
    return 'bg-purple-50 border-purple-200'
  }

  function getStatusBadge() {
    if (isActive) return { bg: 'bg-green-100', text: 'text-green-800', label: 'On Duty' }
    if (isWithinShiftWindow) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Shift Starting' }
    return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Scheduled' }
  }

  const statusBadge = getStatusBadge()
  const shiftLabel = isFirstShift ? 'First Shift' : 'Second Shift'
  const partner = isFirstShift ? myShift.secondShiftName : myShift.firstShiftName

  return (
    <div className={`rounded-lg border p-4 mb-6 ${getStatusColor()}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                CQ Duty
              </span>
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
            </div>

            <h3 className="font-semibold text-gray-900">{shiftLabel}</h3>

            <div className="mt-2 space-y-1 text-sm">
              <div className="text-gray-700">
                <span className="font-medium">Time:</span>{' '}
                {formatTime(myShift.myShiftStart)} - {formatTime(myShift.myShiftEnd)}
              </div>
              <div className="text-gray-700">
                <span className="font-medium">Date:</span>{' '}
                {format(new Date(myShift.date), 'EEEE, MMMM d, yyyy')}
              </div>
              {partner && (
                <div className="text-gray-600">
                  <span className="font-medium">Partner ({isFirstShift ? 'Second Shift' : 'First Shift'}):</span>{' '}
                  {partner}
                </div>
              )}
            </div>

            {/* Stage Progress Tracker */}
            <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
              <span className={isScheduled && !isWithinShiftWindow ? 'text-purple-600 font-semibold' : 'text-gray-400'}>
                Scheduled
              </span>
              <span className="text-gray-300">→</span>
              <span className={isScheduled && isWithinShiftWindow ? 'text-yellow-600 font-semibold' : 'text-gray-400'}>
                Starting
              </span>
              <span className="text-gray-300">→</span>
              <span className={isActive ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                On Duty
              </span>
              <span className="text-gray-300">→</span>
              <span className="text-gray-400">Complete</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {isScheduled && isWithinShiftWindow && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Starting...' : 'Start CQ Shift'}
            </button>
          )}

          {isActive && (
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Completing...' : 'Complete Shift'}
            </button>
          )}

          {isScheduled && !isWithinShiftWindow && (
            <div className="text-sm text-gray-600 italic">
              Shift starts at {formatTime(myShift.myShiftStart)}
            </div>
          )}
        </div>

        {(error || actionError) && (
          <div className="text-sm text-red-600">
            {error || actionError}
          </div>
        )}
      </div>
    </div>
  )
}
