import { useState } from 'react'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useSwapRequestActions } from '../../hooks/useCQSwapRequests'

export default function RequestSwapModal({ shift, onClose, onSuccess }) {
  const { personnel } = usePersonnel()
  const { createSwapRequest, loading, error } = useSwapRequestActions()
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('')
  const [personnelSearch, setPersonnelSearch] = useState('')
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

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

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
              disabled={loading || !selectedPersonnelId}
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
