import { useState } from 'react'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useSwapRequestActions, SWAP_TYPES } from '../../hooks/useCQSwapRequests'
import { useCQSchedule, CQ_SHIFT_TIMES } from '../../hooks/useCQSchedule'
import { useAppConfig } from '../../hooks/useAppConfig'
import { format } from 'date-fns'
import {
  getTodayInTimezone,
  getCurrentHourInTimezone,
  isDateToday,
  isDatePast,
  DEFAULT_TIMEZONE,
} from '../../lib/timezone'

export default function RequestSwapModal({ shift, onClose, onSuccess }) {
  const { personnel } = usePersonnel()
  const { schedule } = useCQSchedule()
  const { config } = useAppConfig()
  const { createSwapRequest, loading, error } = useSwapRequestActions()

  // Use configured timezone for all time calculations
  const timezone = config?.timezone || DEFAULT_TIMEZONE
  const [swapType, setSwapType] = useState(SWAP_TYPES.individual)
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('')
  const [selectedTargetShift, setSelectedTargetShift] = useState(null) // { scheduleId, shiftType, date }
  const [personnelSearch, setPersonnelSearch] = useState('')
  const [shiftSearch, setShiftSearch] = useState('')
  const [reason, setReason] = useState('')
  const [submitError, setSubmitError] = useState(null)

  // Filter personnel for search (exclude current user)
  const filteredPersonnel = personnel.filter((p) => {
    const personId = p.userId || p.id
    // Exclude the current requester
    if (personId === shift.requesterId) return false
    // Apply search filter
    if (personnelSearch) {
      const searchLower = personnelSearch.toLowerCase()
      return (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) ||
        p.lastName?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  // Get available shifts for full shift swap
  // We need to consider that shift times span across calendar days:
  // - Shift 1 (2000-0100): starts evening, ends after midnight
  // - Shift 2 (0100-0600): starts after midnight, ends morning
  //
  // A schedule entry date represents when the CQ "day" starts at 2000.
  // Today's Shift 2 (0100-0600) already happened this morning, but
  // today's Shift 1 (2000) is still upcoming tonight.
  //
  // Use configured timezone for date/time calculations
  const today = getTodayInTimezone(timezone)
  const currentHour = getCurrentHourInTimezone(timezone)

  const availableShifts = schedule
    .filter((s) => {
      // Filter out past dates entirely (using timezone-aware comparison)
      if (isDatePast(s.date, timezone)) return false
      // Don't include completed shifts
      if (s.status === 'completed') return false
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 30) // Limit to next 30 entries

  // Helper to check if a specific shift is available (not started yet)
  // Uses timezone-aware time checks
  function isShiftAvailable(scheduleEntry, shiftType) {
    // Don't allow swapping with your own shift on the same day and same type
    if (scheduleEntry.id === shift.id && shiftType === shift.myShiftType) {
      return false
    }

    // For today's schedule entry, check if the shift has already started
    // Using timezone-aware date/time comparison
    if (isDateToday(scheduleEntry.date, timezone)) {
      if (shiftType === 'shift1') {
        // Shift 1 starts at 2000 - available if before 2000 today (in configured timezone)
        return currentHour < 20
      } else if (shiftType === 'shift2') {
        // Shift 2 (0100-0600) from today's schedule already happened this morning
        // (it ran from 01:00-06:00 AM today)
        return false
      }
    }

    return true
  }

  // Apply search filter to shifts
  const filteredShifts = shiftSearch
    ? availableShifts.filter((s) => {
        const searchLower = shiftSearch.toLowerCase()
        const dateStr = format(new Date(s.date + 'T12:00:00'), 'MMM d')
        const shift1Names = [s.shift1Person1Name, s.shift1Person2Name].filter(Boolean).join(' ')
        const shift2Names = [s.shift2Person1Name, s.shift2Person2Name].filter(Boolean).join(' ')
        return (
          dateStr.toLowerCase().includes(searchLower) ||
          shift1Names.toLowerCase().includes(searchLower) ||
          shift2Names.toLowerCase().includes(searchLower)
        )
      })
    : availableShifts

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    if (swapType === SWAP_TYPES.individual) {
      if (!selectedPersonnelId) {
        setSubmitError('Please select someone to swap with')
        return
      }

      const selectedPerson = personnel.find(
        (p) => (p.userId || p.id) === selectedPersonnelId
      )
      if (!selectedPerson) {
        setSubmitError('Selected personnel not found')
        return
      }

      const selectedPersonName = `${selectedPerson.rank || ''} ${selectedPerson.lastName}`.trim()

      try {
        await createSwapRequest({
          scheduleId: shift.id,
          scheduleDate: shift.date,
          currentShiftType: shift.myShiftType,
          currentPosition: shift.myPosition,
          swapType: SWAP_TYPES.individual,
          proposedPersonnelId: selectedPersonnelId,
          proposedPersonnelName: selectedPersonName,
          reason,
        })

        if (onSuccess) {
          onSuccess()
        }
        onClose()
      } catch (err) {
        setSubmitError(err.message || 'Failed to submit swap request')
      }
    } else if (swapType === SWAP_TYPES.fullShift) {
      if (!selectedTargetShift) {
        setSubmitError('Please select a shift to swap with')
        return
      }

      try {
        await createSwapRequest({
          scheduleId: shift.id,
          scheduleDate: shift.date,
          currentShiftType: shift.myShiftType,
          swapType: SWAP_TYPES.fullShift,
          targetScheduleId: selectedTargetShift.scheduleId,
          targetScheduleDate: selectedTargetShift.date,
          targetShiftType: selectedTargetShift.shiftType,
          reason,
        })

        if (onSuccess) {
          onSuccess()
        }
        onClose()
      } catch (err) {
        setSubmitError(err.message || 'Failed to submit swap request')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Request Shift Swap</h2>
          <p className="text-sm text-gray-600 mt-1">
            {shift.myShiftType === 'shift1' ? 'Shift 1 (2000-0100)' : 'Shift 2 (0100-0600)'} on{' '}
            {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {(submitError || error) && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {submitError || error}
              </div>
            )}

            {/* Swap Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Swap Type
              </label>
              <div className="flex gap-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="swapType"
                    value={SWAP_TYPES.individual}
                    checked={swapType === SWAP_TYPES.individual}
                    onChange={() => setSwapType(SWAP_TYPES.individual)}
                    className="mr-2"
                  />
                  <span className="text-sm">Individual (replace me)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="swapType"
                    value={SWAP_TYPES.fullShift}
                    checked={swapType === SWAP_TYPES.fullShift}
                    onChange={() => setSwapType(SWAP_TYPES.fullShift)}
                    className="mr-2"
                  />
                  <span className="text-sm">Full Shift (swap entire shift)</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {swapType === SWAP_TYPES.individual
                  ? 'Replace your position with another person'
                  : 'Swap entire shift (both people) with another shift'}
              </p>
            </div>

            {/* Individual Swap - Personnel Selection */}
            {swapType === SWAP_TYPES.individual && (
              <>
                {/* Search input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Personnel
                  </label>
                  <input
                    type="text"
                    value={personnelSearch}
                    onChange={(e) => setPersonnelSearch(e.target.value)}
                    placeholder="Type to search..."
                    className="input text-sm"
                  />
                </div>

                {/* Personnel list */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Who do you want to swap with? <span className="text-red-500">*</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredPersonnel.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500 italic">No personnel found</p>
                    ) : (
                      filteredPersonnel.map((person) => {
                        const personId = person.userId || person.id
                        return (
                          <label
                            key={personId}
                            className={`flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                              selectedPersonnelId === personId ? 'bg-primary-50' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="personnel"
                              value={personId}
                              checked={selectedPersonnelId === personId}
                              onChange={() => setSelectedPersonnelId(personId)}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              {person.rank && (
                                <span className="text-gray-500">{person.rank} </span>
                              )}
                              {person.lastName}, {person.firstName}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Full Shift Swap - Shift Selection */}
            {swapType === SWAP_TYPES.fullShift && (
              <>
                {/* Search input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Shifts
                  </label>
                  <input
                    type="text"
                    value={shiftSearch}
                    onChange={(e) => setShiftSearch(e.target.value)}
                    placeholder="Search by date or name..."
                    className="input text-sm"
                  />
                </div>

                {/* Shift list */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select shift to swap with <span className="text-red-500">*</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredShifts.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500 italic">No available shifts found</p>
                    ) : (
                      filteredShifts.map((scheduleEntry) => {
                        const shift1Available = isShiftAvailable(scheduleEntry, 'shift1')
                        const shift2Available = isShiftAvailable(scheduleEntry, 'shift2')

                        // Skip this entry if neither shift is available
                        if (!shift1Available && !shift2Available) {
                          return null
                        }

                        return (
                        <div key={scheduleEntry.id} className="border-b border-gray-100 last:border-b-0">
                          {/* Shift 1 option */}
                          {shift1Available && (
                          <label
                            className={`flex items-start p-2 hover:bg-gray-50 cursor-pointer ${
                              selectedTargetShift?.scheduleId === scheduleEntry.id &&
                              selectedTargetShift?.shiftType === 'shift1'
                                ? 'bg-primary-50'
                                : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="targetShift"
                              checked={
                                selectedTargetShift?.scheduleId === scheduleEntry.id &&
                                selectedTargetShift?.shiftType === 'shift1'
                              }
                              onChange={() =>
                                setSelectedTargetShift({
                                  scheduleId: scheduleEntry.id,
                                  shiftType: 'shift1',
                                  date: scheduleEntry.date,
                                })
                              }
                              className="mr-2 mt-0.5"
                            />
                            <div className="text-sm">
                              <div className="font-medium">
                                {format(new Date(scheduleEntry.date + 'T12:00:00'), 'EEE, MMM d')} - Shift 1 ({CQ_SHIFT_TIMES.shift1.label})
                                {isDateToday(scheduleEntry.date, timezone) && <span className="ml-1 text-green-600">(Tonight)</span>}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {scheduleEntry.shift1Person1Name || '-'} / {scheduleEntry.shift1Person2Name || '-'}
                              </div>
                            </div>
                          </label>
                          )}

                          {/* Shift 2 option */}
                          {shift2Available && (
                          <label
                            className={`flex items-start p-2 hover:bg-gray-50 cursor-pointer ${shift1Available ? 'border-t border-gray-50' : ''} ${
                              selectedTargetShift?.scheduleId === scheduleEntry.id &&
                              selectedTargetShift?.shiftType === 'shift2'
                                ? 'bg-primary-50'
                                : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="targetShift"
                              checked={
                                selectedTargetShift?.scheduleId === scheduleEntry.id &&
                                selectedTargetShift?.shiftType === 'shift2'
                              }
                              onChange={() =>
                                setSelectedTargetShift({
                                  scheduleId: scheduleEntry.id,
                                  shiftType: 'shift2',
                                  date: scheduleEntry.date,
                                })
                              }
                              className="mr-2 mt-0.5"
                            />
                            <div className="text-sm">
                              <div className="font-medium">
                                {/* Shift 2 runs on the morning AFTER the schedule date */}
                                {format(new Date(new Date(scheduleEntry.date + 'T12:00:00').getTime() + 24 * 60 * 60 * 1000), 'EEE, MMM d')} AM - Shift 2 ({CQ_SHIFT_TIMES.shift2.label})
                                {isDateToday(scheduleEntry.date, timezone) && <span className="ml-1 text-blue-600">(Tonight's late shift)</span>}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {scheduleEntry.shift2Person1Name || '-'} / {scheduleEntry.shift2Person2Name || '-'}
                              </div>
                            </div>
                          </label>
                          )}
                        </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Swap
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Medical appointment, family emergency, etc."
                className="input text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional but helps approvers understand your request
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
            <button
              type="submit"
              disabled={
                loading ||
                (swapType === SWAP_TYPES.individual && !selectedPersonnelId) ||
                (swapType === SWAP_TYPES.fullShift && !selectedTargetShift)
              }
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
