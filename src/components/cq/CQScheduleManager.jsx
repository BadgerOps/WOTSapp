import { useState, useRef } from 'react'
import {
  useCQRoster,
  useCQSchedule,
  useCQSkips,
  useCQScheduleActions,
  CQ_SHIFT_TIMES,
} from '../../hooks/useCQSchedule'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useAuth } from '../../contexts/AuthContext'
import Loading from '../common/Loading'
import { format, addDays, parse } from 'date-fns'

export default function CQScheduleManager() {
  const { isAdmin, isCandidateLeadership } = useAuth()
  const { roster, loading: rosterLoading } = useCQRoster()
  const { schedule, loading: scheduleLoading } = useCQSchedule()
  const { skips, loading: skipsLoading } = useCQSkips()
  const { personnel } = usePersonnel()
  const {
    importSchedule,
    importRoster,
    generateSchedule,
    skipDate,
    removeSkip,
    updateShiftAssignment,
    loading: actionLoading,
    error: actionError,
  } = useCQScheduleActions()

  // Check if user can edit shifts (admin or candidate leadership)
  const canEditShifts = isAdmin || isCandidateLeadership

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

  // Edit modal state
  const [editingShift, setEditingShift] = useState(null) // { scheduleId, shiftType, position, currentName, currentId }
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('')
  const [personnelSearch, setPersonnelSearch] = useState('')

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

  /**
   * Detect CSV format and parse accordingly
   * New format: date,shift,user1,user2,isPotentialSkip (one row per shift)
   * Legacy format: Order, LastName, Shift
   */
  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row')
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())

    // Detect new format: date,shift,user1,user2
    const dateIndex = header.findIndex((h) => h === 'date')
    const shiftIndex = header.findIndex((h) => h === 'shift')
    const user1Index = header.findIndex((h) => h === 'user1')
    const user2Index = header.findIndex((h) => h === 'user2')
    const isPotentialSkipIndex = header.findIndex((h) => h === 'ispotentialskip')

    const isNewFormat = dateIndex !== -1 && shiftIndex !== -1 && user1Index !== -1 && user2Index !== -1

    if (isNewFormat) {
      return parseNewFormatCSV(lines, { dateIndex, shiftIndex, user1Index, user2Index, isPotentialSkipIndex })
    } else {
      return parseLegacyCSV(lines, header)
    }
  }

  /**
   * Parse new format CSV: date,shift,user1,user2,isPotentialSkip
   * Each row is a single shift assignment
   */
  function parseNewFormatCSV(lines, indices) {
    const { dateIndex, shiftIndex, user1Index, user2Index, isPotentialSkipIndex } = indices
    const shiftsByDate = new Map() // Group shifts by date
    const currentYear = new Date().getFullYear()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Handle CSV with quoted fields
      const values = parseCSVLine(line)

      const dateStr = values[dateIndex]?.trim()
      const shiftNum = values[shiftIndex]?.trim()
      const user1 = values[user1Index]?.trim() || ''
      const user2 = values[user2Index]?.trim() || ''
      const isPotentialSkip = isPotentialSkipIndex !== -1
        ? values[isPotentialSkipIndex]?.trim().toLowerCase() === 'true'
        : false

      if (!dateStr || !shiftNum) continue

      // Parse date (format: "12-Jan" or "1-Feb")
      const parsedDate = parseDateString(dateStr, currentYear)
      if (!parsedDate) continue

      // Match to personnel database
      const matchPersonnel = (name) => {
        if (!name) return { name, id: null, matched: false }
        const cleanName = name.trim()
        const person = personnel.find(
          (p) => p.lastName?.toLowerCase() === cleanName.toLowerCase()
        )
        return {
          name: person
            ? `${person.rank || ''} ${person.lastName}`.trim()
            : cleanName,
          id: person?.userId || person?.id || null,
          matched: !!person,
        }
      }

      const p1 = matchPersonnel(user1)
      const p2 = matchPersonnel(user2)

      // Get or create entry for this date
      if (!shiftsByDate.has(parsedDate)) {
        shiftsByDate.set(parsedDate, {
          date: parsedDate,
          dayOfWeek: '',
          shift1Person1Name: null,
          shift1Person1Id: null,
          shift1Person2Name: null,
          shift1Person2Id: null,
          shift2Person1Name: null,
          shift2Person1Id: null,
          shift2Person2Name: null,
          shift2Person2Id: null,
          isPotentialSkipDay: false,
          skipDayReason: null,
          _matchStatus: { shift1: [false, false], shift2: [false, false] },
          _format: 'new',
        })
      }

      const entry = shiftsByDate.get(parsedDate)

      // Populate the appropriate shift
      if (shiftNum === '1') {
        entry.shift1Person1Name = p1.name
        entry.shift1Person1Id = p1.id
        entry.shift1Person2Name = p2.name
        entry.shift1Person2Id = p2.id
        entry._matchStatus.shift1 = [p1.matched, p2.matched]
      } else if (shiftNum === '2') {
        entry.shift2Person1Name = p1.name
        entry.shift2Person1Id = p1.id
        entry.shift2Person2Name = p2.name
        entry.shift2Person2Id = p2.id
        entry._matchStatus.shift2 = [p1.matched, p2.matched]
      }

      // Mark as potential skip if any shift for this date has the flag
      if (isPotentialSkip) {
        entry.isPotentialSkipDay = true
        entry.skipDayReason = 'Potential Skip (Quiz/PT Test)'
      }
    }

    // Convert map to sorted array
    return Array.from(shiftsByDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  /**
   * Parse date string like "12-Jan" or "1-Feb" into YYYY-MM-DD
   */
  function parseDateString(dateStr, year) {
    try {
      // Handle format: "12-Jan", "1-Feb", etc.
      const parsed = parse(dateStr, 'd-MMM', new Date(year, 0, 1))
      if (isNaN(parsed.getTime())) return null

      // Adjust year if the month has passed (handle year rollover)
      const now = new Date()
      if (parsed < now && (now.getMonth() - parsed.getMonth()) > 6) {
        parsed.setFullYear(year + 1)
      }

      return format(parsed, 'yyyy-MM-dd')
    } catch (e) {
      return null
    }
  }

  /**
   * Parse legacy format CSV: Order, LastName, Shift
   */
  function parseLegacyCSV(lines, header) {
    const orderIndex = header.indexOf('order')
    const lastNameIndex = header.indexOf('lastname')
    const shiftIndex = header.indexOf('shift')

    if (orderIndex === -1 || lastNameIndex === -1) {
      throw new Error('CSV must have "Order" and "LastName" columns (legacy format) or "Date", "Shift 1", "Shift 2" columns (new format)')
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
        _format: 'legacy',
      })
    }

    return entries.sort((a, b) => a.order - b.order || (a.shift === 'first' ? -1 : 1))
  }

  async function handleImportConfirm() {
    if (!importPreview) return

    try {
      // Check format and use appropriate import method
      const isNewFormat = importPreview[0]?._format === 'new'

      if (isNewFormat) {
        await importSchedule(importPreview)
        setImportPreview(null)
        setSuccess(`Schedule imported successfully! ${importPreview.length} days added.`)
      } else {
        await importRoster(importPreview)
        setImportPreview(null)
        setSuccess('Roster imported successfully!')
      }
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

  function openEditModal(scheduleId, shiftType, position, currentName, currentId) {
    setEditingShift({ scheduleId, shiftType, position, currentName, currentId })
    setSelectedPersonnelId(currentId || '')
    setPersonnelSearch('')
  }

  function closeEditModal() {
    setEditingShift(null)
    setSelectedPersonnelId('')
    setPersonnelSearch('')
  }

  async function handleSaveAssignment() {
    if (!editingShift) return

    const selectedPerson = personnel.find(p => (p.userId || p.id) === selectedPersonnelId)
    const newName = selectedPerson
      ? `${selectedPerson.rank || ''} ${selectedPerson.lastName}`.trim()
      : ''

    try {
      await updateShiftAssignment(
        editingShift.scheduleId,
        editingShift.shiftType,
        editingShift.position,
        selectedPersonnelId || null,
        newName
      )
      setSuccess('Shift assignment updated!')
      setTimeout(() => setSuccess(null), 3000)
      closeEditModal()
    } catch (err) {
      // Error handled by hook
    }
  }

  // Filter personnel for search
  const filteredPersonnel = personnelSearch
    ? personnel.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(personnelSearch.toLowerCase()) ||
        p.lastName?.toLowerCase().includes(personnelSearch.toLowerCase())
      )
    : personnel

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
                No upcoming schedule. Import a CSV schedule or generate from roster.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {upcomingSchedule.map((entry) => {
                  // Support both new format (shift1/shift2) and legacy format (firstShift/secondShift)
                  const isNewFormat = entry.shift1Person1Name !== undefined
                  const shift1Display = isNewFormat
                    ? [entry.shift1Person1Name, entry.shift1Person2Name].filter(Boolean).join(' / ')
                    : entry.firstShiftName
                  const shift2Display = isNewFormat
                    ? [entry.shift2Person1Name, entry.shift2Person2Name].filter(Boolean).join(' / ')
                    : entry.secondShiftName

                  // Check for potential skip day (supports both old and new field names)
                  const isPotentialSkip = entry.isPotentialSkipDay || entry.isLikelySkipDay

                  return (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg border ${
                        isPotentialSkip
                          ? 'bg-orange-50 border-orange-200'
                          : entry.date === today
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 flex flex-wrap items-center gap-2">
                            {format(new Date(entry.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                            {entry.date === today && (
                              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                                Today
                              </span>
                            )}
                            {isPotentialSkip && (
                              <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                                {entry.skipDayReason || 'Potential Skip'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-2 space-y-2">
                            <div>
                              <span className="font-medium text-gray-700">Shift 1 ({CQ_SHIFT_TIMES.shift1.label}):</span>
                              {isNewFormat ? (
                                <div className="ml-4 mt-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span>{entry.shift1Person1Name || '-'}</span>
                                    {canEditShifts && (
                                      <button
                                        onClick={() => openEditModal(entry.id, 'shift1', 1, entry.shift1Person1Name, entry.shift1Person1Id)}
                                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span>{entry.shift1Person2Name || '-'}</span>
                                    {canEditShifts && (
                                      <button
                                        onClick={() => openEditModal(entry.id, 'shift1', 2, entry.shift1Person2Name, entry.shift1Person2Id)}
                                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="ml-1">{shift1Display || '-'}</span>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Shift 2 ({CQ_SHIFT_TIMES.shift2.label}):</span>
                              {isNewFormat ? (
                                <div className="ml-4 mt-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span>{entry.shift2Person1Name || '-'}</span>
                                    {canEditShifts && (
                                      <button
                                        onClick={() => openEditModal(entry.id, 'shift2', 1, entry.shift2Person1Name, entry.shift2Person1Id)}
                                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span>{entry.shift2Person2Name || '-'}</span>
                                    {canEditShifts && (
                                      <button
                                        onClick={() => openEditModal(entry.id, 'shift2', 2, entry.shift2Person2Name, entry.shift2Person2Id)}
                                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="ml-1">{shift2Display || '-'}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
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
                  )
                })}
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
                {pastSchedule.map((entry) => {
                  // Support both formats
                  const isNewFormat = entry.shift1Person1Name !== undefined
                  const shift1Display = isNewFormat
                    ? [entry.shift1Person1Name, entry.shift1Person2Name].filter(Boolean).join('/')
                    : entry.firstShiftName
                  const shift2Display = isNewFormat
                    ? [entry.shift2Person1Name, entry.shift2Person2Name].filter(Boolean).join('/')
                    : entry.secondShiftName

                  // Check for potential skip day (supports both old and new field names)
                  const isPotentialSkip = entry.isPotentialSkipDay || entry.isLikelySkipDay

                  return (
                    <div
                      key={entry.id}
                      className={`p-2 rounded border text-sm ${
                        isPotentialSkip
                          ? 'bg-orange-50 border-orange-100'
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-gray-700">
                          {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}
                          {isPotentialSkip && (
                            <span className="ml-1 text-xs text-orange-600">(*)</span>
                          )}
                        </span>
                        <div className="text-right text-gray-500 text-xs">
                          <div>S1: {shift1Display || '-'}</div>
                          <div>S2: {shift2Display || '-'}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roster Tab */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Import Schedule/Roster */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Import CQ Schedule</h3>
            <p className="text-xs text-gray-600 mb-3">
              <strong>New format (recommended):</strong> CSV with columns: date, shift, user1, user2, isPotentialSkip.
              Each row is one shift assignment (shift 1 or 2). Set isPotentialSkip to true for quiz/PT test days.
            </p>
            <p className="text-xs text-gray-500 mb-3">
              <em>Legacy format:</em> Order, LastName, Shift (first/second).
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
                Import Preview ({importPreview.length} {importPreview[0]?._format === 'new' ? 'CQ days' : 'entries'})
              </h3>
              {importPreview[0]?._format === 'new' && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded text-sm">
                  Detected new schedule format with 2 people per shift.
                  {importPreview.filter(e => e.isPotentialSkipDay).length > 0 && (
                    <span className="ml-1">
                      Days marked with <span className="bg-orange-200 text-orange-800 px-1 rounded">*</span> are potential skip days (before quiz/PT test).
                    </span>
                  )}
                </div>
              )}
              {importError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {importError}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto mb-3">
                {importPreview[0]?._format === 'new' ? (
                  /* New format preview */
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Shift 1 (2000-0100)</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Shift 2 (0100-0600)</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {importPreview.map((entry, idx) => (
                        <tr key={idx} className={entry.isPotentialSkipDay ? 'bg-orange-50' : ''}>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {format(new Date(entry.date + 'T12:00:00'), 'MMM d')}
                            <span className="text-gray-400 ml-1 text-xs">{entry.dayOfWeek}</span>
                          </td>
                          <td className="px-2 py-2">
                            <div>{entry.shift1Person1Name || '-'}</div>
                            <div>{entry.shift1Person2Name || '-'}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div>{entry.shift2Person1Name || '-'}</div>
                            <div>{entry.shift2Person2Name || '-'}</div>
                          </td>
                          <td className="px-2 py-2">
                            {entry.isPotentialSkipDay && (
                              <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded">
                                *
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  /* Legacy format preview */
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
                )}
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

      {/* Edit Shift Assignment Modal */}
      {editingShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                Edit Shift Assignment
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {editingShift.shiftType === 'shift1' ? 'Shift 1 (2000-0100)' : 'Shift 2 (0100-0600)'},
                Position {editingShift.position}
              </p>
              {editingShift.currentName && (
                <p className="text-sm text-gray-500 mt-1">
                  Current: {editingShift.currentName}
                </p>
              )}
            </div>

            <div className="px-6 py-4 space-y-4">
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
                  Select Personnel
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {/* Option to clear/unassign */}
                  <label
                    className={`flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                      selectedPersonnelId === '' ? 'bg-primary-50' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="personnel"
                      value=""
                      checked={selectedPersonnelId === ''}
                      onChange={() => setSelectedPersonnelId('')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-500 italic">Unassigned</span>
                  </label>

                  {filteredPersonnel.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 italic">
                      No personnel found
                    </p>
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
                            {person.rank && <span className="text-gray-500">{person.rank} </span>}
                            {person.lastName}, {person.firstName}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSaveAssignment}
                disabled={actionLoading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={closeEditModal}
                disabled={actionLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
