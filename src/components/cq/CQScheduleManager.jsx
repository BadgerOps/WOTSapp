import { useState, useRef } from 'react'
import {
  useCQRoster,
  useCQSchedule,
  useCQSkips,
  useCQScheduleActions,
} from '../../hooks/useCQSchedule'
import { usePersonnel } from '../../hooks/usePersonnel'
import Loading from '../common/Loading'
import { format, addDays } from 'date-fns'

export default function CQScheduleManager() {
  const { roster, loading: rosterLoading } = useCQRoster()
  const { schedule, loading: scheduleLoading } = useCQSchedule()
  const { skips, loading: skipsLoading } = useCQSkips()
  const { personnel } = usePersonnel()
  const {
    importRoster,
    generateSchedule,
    skipDate,
    removeSkip,
    loading: actionLoading,
    error: actionError,
  } = useCQScheduleActions()

  const [activeTab, setActiveTab] = useState('schedule')
  const [importPreview, setImportPreview] = useState(null)
  const [importError, setImportError] = useState(null)
  const [skipDateInput, setSkipDateInput] = useState('')
  const [skipReason, setSkipReason] = useState('')
  const [generateStartDate, setGenerateStartDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [generateDays, setGenerateDays] = useState(30)
  const [success, setSuccess] = useState(null)

  const fileInputRef = useRef(null)

  const loading = rosterLoading || scheduleLoading || skipsLoading

  if (loading) return <Loading />

  // Group schedule by upcoming/past
  const today = new Date().toISOString().split('T')[0]
  const upcomingSchedule = schedule
    .filter((s) => s.date >= today && s.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))
  const pastSchedule = schedule
    .filter((s) => s.date < today || s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10) // Show last 10

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return

    setImportError(null)
    setImportPreview(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const parsed = parseCSV(text)
        setImportPreview(parsed)
      } catch (err) {
        setImportError(err.message)
      }
    }
    reader.readAsText(file)

    // Reset file input
    e.target.value = ''
  }

  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row')
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const orderIndex = header.indexOf('order')
    const lastNameIndex = header.indexOf('lastname')
    const shiftIndex = header.indexOf('shift')

    if (orderIndex === -1 || lastNameIndex === -1) {
      throw new Error('CSV must have "Order" and "LastName" columns')
    }

    const entries = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map((v) => v.trim())
      const order = parseInt(values[orderIndex])
      const lastName = values[lastNameIndex]
      const shift = shiftIndex !== -1 ? values[shiftIndex]?.toLowerCase() : 'first'

      if (isNaN(order) || !lastName) continue

      // Match to personnel
      const person = personnel.find(
        (p) => p.lastName?.toLowerCase() === lastName.toLowerCase()
      )

      entries.push({
        order,
        lastName,
        shift: shift === 'second' ? 'second' : 'first',
        personnelId: person?.userId || person?.id || null,
        name: person
          ? `${person.rank || ''} ${person.lastName}, ${person.firstName}`.trim()
          : lastName,
        matched: !!person,
      })
    }

    return entries.sort((a, b) => a.order - b.order || (a.shift === 'first' ? -1 : 1))
  }

  async function handleImportConfirm() {
    if (!importPreview) return

    try {
      await importRoster(importPreview)
      setImportPreview(null)
      setSuccess('Roster imported successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setImportError(err.message)
    }
  }

  async function handleGenerateSchedule() {
    try {
      await generateSchedule(generateStartDate, generateDays)
      setSuccess(`Schedule generated for ${generateDays} days!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleSkipDate() {
    if (!skipDateInput) return

    try {
      await skipDate(skipDateInput, skipReason)
      setSkipDateInput('')
      setSkipReason('')
      setSuccess('Date skipped and schedule shifted!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleRemoveSkip(skipId) {
    if (!window.confirm('Remove this skip? The schedule will need to be regenerated.')) return

    try {
      await removeSkip(skipId)
    } catch (err) {
      // Error handled by hook
    }
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv"
        className="hidden"
      />

      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'schedule'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Schedule ({upcomingSchedule.length})
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'roster'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Roster ({roster.length})
        </button>
        <button
          onClick={() => setActiveTab('skips')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'skips'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Skips ({skips.length})
        </button>
      </div>

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Generate Schedule */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Generate Schedule</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={generateStartDate}
                  onChange={(e) => setGenerateStartDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Days</label>
                <input
                  type="number"
                  value={generateDays}
                  onChange={(e) => setGenerateDays(parseInt(e.target.value) || 30)}
                  min="1"
                  max="365"
                  className="input text-sm w-20"
                />
              </div>
              <button
                onClick={handleGenerateSchedule}
                disabled={actionLoading || roster.length === 0}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {actionLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {roster.length === 0 && (
              <p className="text-xs text-yellow-600 mt-2">
                Import a roster first before generating the schedule.
              </p>
            )}
          </div>

          {/* Skip a Date */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Skip a Date</h3>
            <p className="text-xs text-gray-600 mb-3">
              Skip a date (e.g., for exams or PT tests). All subsequent shifts will be pushed forward.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date to Skip</label>
                <input
                  type="date"
                  value={skipDateInput}
                  onChange={(e) => setSkipDateInput(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-gray-600 mb-1">Reason</label>
                <input
                  type="text"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="e.g., PT Test, Exam"
                  className="input text-sm"
                />
              </div>
              <button
                onClick={handleSkipDate}
                disabled={actionLoading || !skipDateInput}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Skip Date
              </button>
            </div>
          </div>

          {/* Upcoming Schedule */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-3">
              Upcoming CQ Schedule
            </h3>
            {upcomingSchedule.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No upcoming schedule. Generate a schedule from the roster.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {upcomingSchedule.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-lg border ${
                      entry.date === today
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          {format(new Date(entry.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                          {entry.date === today && (
                            <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">1st Shift:</span> {entry.firstShiftName || '-'}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">2nd Shift:</span> {entry.secondShiftName || '-'}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          entry.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : entry.status === 'completed'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Schedule */}
          {pastSchedule.length > 0 && (
            <div className="card">
              <h3 className="text-md font-semibold text-gray-900 mb-3">
                Recent History
              </h3>
              <div className="space-y-2">
                {pastSchedule.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2 bg-gray-50 rounded border border-gray-100 text-sm"
                  >
                    <div className="flex justify-between">
                      <span className="text-gray-700">
                        {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}
                      </span>
                      <span className="text-gray-500">
                        {entry.firstShiftName} / {entry.secondShiftName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roster Tab */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Import Roster */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Import CQ Roster</h3>
            <p className="text-xs text-gray-600 mb-3">
              Upload a CSV with columns: Order, LastName, Shift (first/second).
              Each order number represents one day's worth of CQ assignments.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-sm"
            >
              Select CSV File
            </button>
          </div>

          {/* Import Preview */}
          {importPreview && (
            <div className="card">
              <h3 className="text-md font-semibold text-gray-900 mb-3">
                Import Preview ({importPreview.length} entries)
              </h3>
              {importError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {importError}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto mb-3">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Order</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Shift</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {importPreview.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{entry.order}</td>
                        <td className="px-3 py-2">{entry.name}</td>
                        <td className="px-3 py-2 capitalize">{entry.shift}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs ${
                              entry.matched ? 'text-green-600' : 'text-yellow-600'
                            }`}
                          >
                            {entry.matched ? 'Matched' : 'Not found'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportPreview(null)}
                  className="btn-secondary text-sm flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={actionLoading}
                  className="btn-primary text-sm flex-1 disabled:opacity-50"
                >
                  {actionLoading ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
          )}

          {/* Current Roster */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-3">
              Current Roster ({roster.length} entries)
            </h3>
            {roster.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No roster imported. Upload a CSV to create the CQ rotation.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Day</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Shift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {roster.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2">{entry.order}</td>
                        <td className="px-3 py-2">{entry.name}</td>
                        <td className="px-3 py-2 capitalize">{entry.shift}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skips Tab */}
      {activeTab === 'skips' && (
        <div className="card">
          <h3 className="text-md font-semibold text-gray-900 mb-3">
            Skipped Dates ({skips.length})
          </h3>
          {skips.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No dates have been skipped.
            </p>
          ) : (
            <div className="space-y-2">
              {skips.map((skip) => (
                <div
                  key={skip.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {format(new Date(skip.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                    </div>
                    {skip.reason && (
                      <div className="text-sm text-gray-600">{skip.reason}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Skipped by {skip.skippedByName}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSkip(skip.id)}
                    disabled={actionLoading}
                    className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
