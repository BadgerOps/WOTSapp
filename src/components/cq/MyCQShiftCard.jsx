import { useState } from 'react'
import { useMyCQShift, useCQScheduleActions, CQ_SHIFT_TIMES } from '../../hooks/useCQSchedule'
import { useAppConfig } from '../../hooks/useAppConfig'
import { useMySwapRequests } from '../../hooks/useCQSwapRequests'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import RequestSwapModal from './RequestSwapModal'

export default function MyCQShiftCard() {
  const { user } = useAuth()
  const { myShift, loading, error } = useMyCQShift()
  const { config } = useAppConfig()
  const { startShift, completeShift, loading: actionLoading, error: actionError } = useCQScheduleActions()
  const { requests: mySwapRequests } = useMySwapRequests()
  const [showSwapModal, setShowSwapModal] = useState(false)

  if (loading) return null

  // Only show if user has a CQ shift
  if (!myShift) {
    return null
  }

  const isShift1 = myShift.myShiftType === 'shift1'
  const isActive = myShift.status === 'active'
  const isScheduled = myShift.status === 'scheduled'
  const isTomorrow = myShift.shiftContext === 'tomorrow' // Tomorrow's shift

  // Determine if current time is within the shift window (only for today's shifts)
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
  let isUpcoming = false // Shift is today but not starting soon

  if (isTomorrow) {
    // Tomorrow's shift - always show as upcoming
    isWithinShiftWindow = false
    isUpcoming = true
  } else if (isOvernight) {
    // For overnight shift (e.g., 20:00-01:00), window is 20:00-23:59 OR 00:00-01:00
    isWithinShiftWindow = currentTime >= shiftStart || currentTime <= shiftEnd
    // "Upcoming" if it's before the shift starts (e.g., before 2000 for shift 1)
    isUpcoming = !isWithinShiftWindow && currentTime < shiftStart
  } else {
    isWithinShiftWindow = currentTime >= shiftStart && currentTime <= shiftEnd
    // "Upcoming" if it's before the shift starts
    isUpcoming = !isWithinShiftWindow && currentTime < shiftStart
  }

  // Format times for display
  function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Format military time for display
  function formatMilitary(timeStr) {
    return timeStr.replace(':', '')
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
    if (isTomorrow) return 'bg-blue-50 border-blue-200'
    if (isUpcoming) return 'bg-purple-50 border-purple-200'
    return 'bg-gray-50 border-gray-200'
  }

  function getStatusBadge() {
    if (isActive) return { bg: 'bg-green-100', text: 'text-green-800', label: 'On Duty' }
    if (isWithinShiftWindow) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Shift Starting' }
    if (isTomorrow) return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Tomorrow' }
    if (isUpcoming) return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Today' }
    return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Scheduled' }
  }

  const statusBadge = getStatusBadge()
  const shiftLabel = isShift1
    ? `Shift 1 (${CQ_SHIFT_TIMES.shift1.label})`
    : `Shift 2 (${CQ_SHIFT_TIMES.shift2.label})`
  const partner = myShift.myPartnerName

  // Check if there's a pending swap request for this shift
  const pendingSwapRequest = mySwapRequests.find(
    (req) => req.scheduleId === myShift.id && req.status === 'pending'
  )

  // Can request swap if shift is scheduled (not active or completed) and no pending request
  const canRequestSwap = isScheduled && !pendingSwapRequest

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
                {format(new Date(myShift.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                {isTomorrow && (
                  <span className="ml-1 text-blue-600 font-medium">(tomorrow)</span>
                )}
              </div>
              {partner && (
                <div className="text-gray-600">
                  <span className="font-medium">Partner:</span>{' '}
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

          {isScheduled && isUpcoming && !isTomorrow && (
            <div className="text-sm text-purple-600 italic">
              CQ duty today - shift starts at {formatTime(myShift.myShiftStart)}
            </div>
          )}

          {isScheduled && !isWithinShiftWindow && !isTomorrow && !isUpcoming && (
            <div className="text-sm text-gray-600 italic">
              Shift starts at {formatTime(myShift.myShiftStart)}
            </div>
          )}

          {isTomorrow && (
            <div className="text-sm text-blue-600 italic">
              CQ duty tomorrow - shift starts at {formatTime(myShift.myShiftStart)}
            </div>
          )}

          {/* Request Swap Button */}
          {canRequestSwap && (
            <button
              onClick={() => setShowSwapModal(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Request Swap
            </button>
          )}

          {/* Pending Swap Request Indicator */}
          {pendingSwapRequest && (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <span className="text-yellow-700 font-medium">Swap Request Pending</span>
              <span className="text-yellow-600 ml-1">
                {pendingSwapRequest.swapType === 'fullShift'
                  ? `- Full shift swap with ${new Date(pendingSwapRequest.targetScheduleDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : `- Proposed: ${pendingSwapRequest.proposedPersonnelName}`}
              </span>
            </div>
          )}
        </div>

        {(error || actionError) && (
          <div className="text-sm text-red-600">
            {error || actionError}
          </div>
        )}
      </div>

      {/* Swap Request Modal */}
      {showSwapModal && (
        <RequestSwapModal
          shift={{ ...myShift, requesterId: user?.uid }}
          onClose={() => setShowSwapModal(false)}
          onSuccess={() => {
            // Could add a success toast here
          }}
        />
      )}
    </div>
  )
}
