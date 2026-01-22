import { useState } from 'react'
import { useCQNotes, useCQNoteActions, NOTE_TYPES } from '../../hooks/useCQNotes'
import { useCQShifts } from '../../hooks/useCQShifts'
import Loading from '../common/Loading'

const TYPE_COLORS = {
  routine: 'bg-gray-100 text-gray-800',
  incident: 'bg-red-100 text-red-800',
  visitor: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
}

export default function CQNotesLog({ shiftId = null, readOnly = false }) {
  const { notes, loading, error } = useCQNotes(shiftId)
  const { shifts } = useCQShifts()
  const { addNote, loading: actionLoading, error: actionError } = useCQNoteActions()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    type: 'routine',
    severity: 'normal',
    shiftId: shiftId || '',
  })

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading CQ notes: {error}</p>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await addNote(formData)
      setShowForm(false)
      setFormData({
        description: '',
        type: 'routine',
        severity: 'normal',
        shiftId: shiftId || '',
      })
    } catch (err) {
      // Error handled by hook
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* Add Note Button */}
      {!readOnly && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Note
        </button>
      )}

      {/* Add Note Form */}
      {!readOnly && showForm && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add CQ Note</h3>

          {actionError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{actionError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {Object.entries(NOTE_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                name="severity"
                value={formData.severity}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {!shiftId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Associated Shift (Optional)
                </label>
                <select
                  name="shiftId"
                  value={formData.shiftId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">No specific shift</option>
                  {shifts
                    .filter((s) => s.status === 'active' || s.status === 'upcoming')
                    .map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.cqNcoName || 'Shift'} -{' '}
                        {shift.startTime?.toDate
                          ? shift.startTime.toDate().toLocaleDateString()
                          : 'Unknown date'}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                required
                placeholder="Describe the event or note..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">CQ Notes Log</h3>
        </div>

        {notes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No notes recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notes.map((note) => (
              <div key={note.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          TYPE_COLORS[note.type]
                        }`}
                      >
                        {NOTE_TYPES[note.type]?.label || note.type}
                      </span>
                      {note.severity === 'high' && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          High
                        </span>
                      )}
                      {note.severity === 'critical' && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Critical
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900">{note.description}</p>
                    <div className="mt-2 text-sm text-gray-500">
                      <span>{formatTimestamp(note.timestamp)}</span>
                      <span className="mx-2">|</span>
                      <span>by {note.createdByName}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
