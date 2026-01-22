import { useState, useRef } from 'react'
import { useCQShifts, useCQShiftActions } from '../../hooks/useCQShifts'
import { usePersonnel } from '../../hooks/usePersonnel'
import Loading from '../common/Loading'
import Papa from 'papaparse'

const STATUS_COLORS = {
  upcoming: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
}

/**
 * Parse shift time from day and shift string
 * @param {string} day - Date string (e.g., "2026-01-21" or "01/21/2026")
 * @param {string} shift - Shift identifier (e.g., "day", "night", "swing", or time like "0600-1800")
 * @returns {{ startTime: Date, endTime: Date }}
 */
function parseShiftTime(day, shift) {
  // Parse the date
  let date
  if (day.includes('/')) {
    // MM/DD/YYYY format
    const [month, dayNum, year] = day.split('/')
    date = new Date(year, parseInt(month) - 1, parseInt(dayNum))
  } else {
    // YYYY-MM-DD format
    date = new Date(day)
  }

  // Shift times based on common patterns
  const shiftLower = shift.toLowerCase().trim()
  let startHour, startMin, endHour, endMin

  if (shiftLower === 'day' || shiftLower === 'days') {
    startHour = 6
    startMin = 0
    endHour = 18
    endMin = 0
  } else if (shiftLower === 'night' || shiftLower === 'nights') {
    startHour = 18
    startMin = 0
    endHour = 6
    endMin = 0
  } else if (shiftLower === 'swing') {
    startHour = 14
    startMin = 0
    endHour = 22
    endMin = 0
  } else if (shiftLower.match(/^\d{2}:?\d{2}\s*-\s*\d{2}:?\d{2}$/)) {
    // Time range format like "0600-1800" or "06:00-18:00"
    const times = shiftLower.replace(/:/g, '').split('-')
    startHour = parseInt(times[0].slice(0, 2))
    startMin = parseInt(times[0].slice(2, 4))
    endHour = parseInt(times[1].slice(0, 2))
    endMin = parseInt(times[1].slice(2, 4))
  } else {
    // Default to day shift
    startHour = 6
    startMin = 0
    endHour = 18
    endMin = 0
  }

  const startTime = new Date(date)
  startTime.setHours(startHour, startMin, 0, 0)

  const endTime = new Date(date)
  endTime.setHours(endHour, endMin, 0, 0)

  // If end is before start (overnight shift), add a day to end
  if (endTime <= startTime) {
    endTime.setDate(endTime.getDate() + 1)
  }

  return { startTime, endTime }
}

export default function ShiftManager() {
  const { shifts, loading, error } = useCQShifts()
  const { personnel } = usePersonnel()
  const {
    createShift,
    updateShift,
    activateShift,
    completeShift,
    deleteShift,
    loading: actionLoading,
    error: actionError,
  } = useCQShiftActions()
  const [showForm, setShowForm] = useState(false)
  const [editingShift, setEditingShift] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    assignee1Id: '',
    assignee1Name: '',
    assignee2Id: '',
    assignee2Name: '',
    notes: '',
  })

  // CSV Import state
  const fileInputRef = useRef(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importPreview, setImportPreview] = useState(null)

  // Filter to CQ-eligible personnel
  const cqEligiblePersonnel = personnel.filter((p) => p.cqEligible !== false)

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading shifts: {error}</p>
      </div>
    )
  }

  // Filter shifts
  const filteredShifts = statusFilter
    ? shifts.filter((s) => s.status === statusFilter)
    : shifts

  function resetForm() {
    setFormData({
      startTime: '',
      endTime: '',
      assignee1Id: '',
      assignee1Name: '',
      assignee2Id: '',
      assignee2Name: '',
      notes: '',
    })
    setEditingShift(null)
    setShowForm(false)
  }

  function handleEdit(shift) {
    setEditingShift(shift)
    setFormData({
      startTime: shift.startTime?.toDate
        ? new Date(shift.startTime.toDate()).toISOString().slice(0, 16)
        : '',
      endTime: shift.endTime?.toDate
        ? new Date(shift.endTime.toDate()).toISOString().slice(0, 16)
        : '',
      assignee1Id: shift.assignee1Id || shift.cqNcoId || '',
      assignee1Name: shift.assignee1Name || shift.cqNcoName || '',
      assignee2Id: shift.assignee2Id || shift.cqRunnerId || '',
      assignee2Name: shift.assignee2Name || shift.cqRunnerName || '',
      notes: shift.notes || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingShift) {
        await updateShift(editingShift.id, formData)
      } else {
        await createShift(formData)
      }
      resetForm()
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleActivate(shiftId) {
    if (window.confirm('Are you sure you want to activate this shift?')) {
      try {
        await activateShift(shiftId)
      } catch (err) {
        // Error handled by hook
      }
    }
  }

  async function handleComplete(shiftId) {
    if (window.confirm('Are you sure you want to mark this shift as completed?')) {
      try {
        await completeShift(shiftId)
      } catch (err) {
        // Error handled by hook
      }
    }
  }

  async function handleDelete(shiftId) {
    if (window.confirm('Are you sure you want to delete this shift?')) {
      try {
        await deleteShift(shiftId)
      } catch (err) {
        // Error handled by hook
      }
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handlePersonnelSelect(field, personnelId) {
    const person = cqEligiblePersonnel.find((p) => p.id === personnelId)
    if (person) {
      const nameField = field === 'assignee1Id' ? 'assignee1Name' : 'assignee2Name'
      setFormData((prev) => ({
        ...prev,
        [field]: personnelId,
        [nameField]: `${person.rank || ''} ${person.lastName}, ${person.firstName}`.trim(),
      }))
    } else {
      const nameField = field === 'assignee1Id' ? 'assignee1Name' : 'assignee2Name'
      setFormData((prev) => ({
        ...prev,
        [field]: '',
        [nameField]: '',
      }))
    }
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString()
  }

  // CSV Import functions
  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function findPersonnelByName(name) {
    if (!name) return null
    const nameLower = name.toLowerCase().trim()

    // Try various name formats
    for (const person of cqEligiblePersonnel) {
      const fullName = `${person.firstName} ${person.lastName}`.toLowerCase()
      const reverseName = `${person.lastName}, ${person.firstName}`.toLowerCase()
      const reverseNoComma = `${person.lastName} ${person.firstName}`.toLowerCase()
      const withRank = `${person.rank || ''} ${person.lastName}, ${person.firstName}`.toLowerCase().trim()

      if (
        nameLower === fullName ||
        nameLower === reverseName ||
        nameLower === reverseNoComma ||
        nameLower === withRank ||
        nameLower === person.lastName.toLowerCase() ||
        nameLower === `${person.lastName.toLowerCase()}, ${person.firstName.toLowerCase().charAt(0)}`
      ) {
        return person
      }
    }
    return null
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportError(null)
    setImportLoading(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        const headerMap = {
          'day': 'day',
          'date': 'day',
          'shift': 'shift',
          'assignee_1': 'assignee1',
          'assignee1': 'assignee1',
          'assignee 1': 'assignee1',
          'cq1': 'assignee1',
          'assignee_2': 'assignee2',
          'assignee2': 'assignee2',
          'assignee 2': 'assignee2',
          'cq2': 'assignee2',
        }
        return headerMap[header.toLowerCase().trim()] || header.toLowerCase().trim()
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          setImportError(`Parse error: ${results.errors[0].message}`)
          setImportLoading(false)
          return
        }

        // Validate and transform data
        const parsedShifts = []
        const errors = []

        results.data.forEach((row, index) => {
          const rowNum = index + 2 // Account for header row

          if (!row.day) {
            errors.push(`Row ${rowNum}: Missing day/date`)
            return
          }

          if (!row.shift) {
            errors.push(`Row ${rowNum}: Missing shift`)
            return
          }

          try {
            const { startTime, endTime } = parseShiftTime(row.day, row.shift)

            const assignee1 = findPersonnelByName(row.assignee1)
            const assignee2 = findPersonnelByName(row.assignee2)

            parsedShifts.push({
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              assignee1Id: assignee1?.id || '',
              assignee1Name: assignee1
                ? `${assignee1.rank || ''} ${assignee1.lastName}, ${assignee1.firstName}`.trim()
                : row.assignee1 || '',
              assignee2Id: assignee2?.id || '',
              assignee2Name: assignee2
                ? `${assignee2.rank || ''} ${assignee2.lastName}, ${assignee2.firstName}`.trim()
                : row.assignee2 || '',
              notes: '',
              // Preview info
              _dayDisplay: row.day,
              _shiftDisplay: row.shift,
              _assignee1Match: !!assignee1,
              _assignee2Match: !!assignee2,
            })
          } catch (err) {
            errors.push(`Row ${rowNum}: Invalid date/shift format`)
          }
        })

        if (errors.length > 0) {
          setImportError(errors.join('\n'))
        }

        setImportPreview(parsedShifts)
        setImportLoading(false)
      },
      error: (err) => {
        setImportError(`Failed to read file: ${err.message}`)
        setImportLoading(false)
      },
    })

    // Reset file input
    e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!importPreview || importPreview.length === 0) return

    setImportLoading(true)
    try {
      for (const shift of importPreview) {
        // Remove preview-only fields
        const { _dayDisplay, _shiftDisplay, _assignee1Match, _assignee2Match, ...shiftData } = shift
        await createShift(shiftData)
      }
      setImportPreview(null)
      setImportError(null)
    } catch (err) {
      setImportError(`Failed to import: ${err.message}`)
    } finally {
      setImportLoading(false)
    }
  }

  function handleCancelImport() {
    setImportPreview(null)
    setImportError(null)
  }

  function downloadTemplate() {
    const template = `day,shift,assignee_1,assignee_2
2026-01-21,day,Doe John,Smith Jane
2026-01-21,night,Johnson Bob,Williams Mary
2026-01-22,day,Brown Tom,Davis Sarah`

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'cq_shifts_template.csv'
    link.click()
  }

  // Get display name for shifts (support both old and new field names)
  function getAssignee1Name(shift) {
    return shift.assignee1Name || shift.cqNcoName || '-'
  }

  function getAssignee2Name(shift) {
    return shift.assignee2Name || shift.cqRunnerName || ''
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Shifts</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportClick}
            disabled={importLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Import CSV
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Shift
            </button>
          )}
        </div>
      </div>

      {/* Import Preview */}
      {importPreview && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Import Preview ({importPreview.length} shifts)
          </h3>

          {importError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700 text-sm whitespace-pre-line">{importError}</p>
            </div>
          )}

          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignee 1</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Assignee 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {importPreview.map((shift, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-sm">{shift._dayDisplay}</td>
                    <td className="px-3 py-2 text-sm">{shift._shiftDisplay}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={shift._assignee1Match ? 'text-green-700' : 'text-yellow-700'}>
                        {shift.assignee1Name || '-'}
                      </span>
                      {!shift._assignee1Match && shift.assignee1Name && (
                        <span className="text-xs text-gray-500 ml-1">(not matched)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm hidden sm:table-cell">
                      <span className={shift._assignee2Match ? 'text-green-700' : 'text-yellow-700'}>
                        {shift.assignee2Name || '-'}
                      </span>
                      {!shift._assignee2Match && shift.assignee2Name && (
                        <span className="text-xs text-gray-500 ml-1">(not matched)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancelImport}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importLoading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {importLoading ? 'Importing...' : `Import ${importPreview.length} Shifts`}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Names in yellow were not matched to personnel. They will be imported as text only.{' '}
            <button onClick={downloadTemplate} className="text-primary-600 hover:underline">
              Download template
            </button>
          </p>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && !importPreview && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingShift ? 'Edit Shift' : 'Create New Shift'}
          </h3>

          {actionError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{actionError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CQ Assignee 1 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.assignee1Id}
                  onChange={(e) => handlePersonnelSelect('assignee1Id', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select Assignee</option>
                  {cqEligiblePersonnel.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.rank && `${person.rank} `}
                      {person.lastName}, {person.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CQ Assignee 2
                </label>
                <select
                  value={formData.assignee2Id}
                  onChange={(e) => handlePersonnelSelect('assignee2Id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select Assignee (Optional)</option>
                  {cqEligiblePersonnel.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.rank && `${person.rank} `}
                      {person.lastName}, {person.firstName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Any notes for this shift..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {actionLoading
                  ? 'Saving...'
                  : editingShift
                  ? 'Update Shift'
                  : 'Create Shift'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shifts List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredShifts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No shifts found.{' '}
            <button onClick={downloadTemplate} className="text-primary-600 hover:underline">
              Download CSV template
            </button>{' '}
            to import shifts.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredShifts.map((shift) => (
              <div key={shift.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          STATUS_COLORS[shift.status]
                        }`}
                      >
                        {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Time:</span>{' '}
                        {formatDateTime(shift.startTime)} - {formatDateTime(shift.endTime)}
                      </div>
                      <div>
                        <span className="font-medium">CQ 1:</span>{' '}
                        {getAssignee1Name(shift)}
                      </div>
                      {getAssignee2Name(shift) && (
                        <div>
                          <span className="font-medium">CQ 2:</span>{' '}
                          {getAssignee2Name(shift)}
                        </div>
                      )}
                      {shift.notes && (
                        <div className="text-gray-600">
                          <span className="font-medium">Notes:</span> {shift.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {shift.status === 'upcoming' && (
                      <button
                        onClick={() => handleActivate(shift.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    {shift.status === 'active' && (
                      <button
                        onClick={() => handleComplete(shift.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        Complete
                      </button>
                    )}
                    {shift.status !== 'completed' && (
                      <button
                        onClick={() => handleEdit(shift)}
                        className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {shift.status === 'upcoming' && (
                      <button
                        onClick={() => handleDelete(shift.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
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
