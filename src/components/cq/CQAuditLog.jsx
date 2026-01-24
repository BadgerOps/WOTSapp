import { useState } from 'react'
import {
  useCQAuditLog,
  useCQAuditLogRange,
  formatAuditAction,
  groupEntriesByPersonnel,
  generateAuditSummary,
} from '../../hooks/useCQAuditLog'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useAppConfig } from '../../hooks/useAppConfig'
import { downloadSignoutRosterPdf, downloadBlankSignoutRosterPdf } from '../../lib/signoutRosterPdf'
import Loading from '../common/Loading'

function formatTime(date) {
  if (!date) return '--:--'
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function CQAuditLog() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [viewMode, setViewMode] = useState('timeline') // 'timeline' or 'grouped'
  const [showExportModal, setShowExportModal] = useState(false)

  const { entries, loading, error } = useCQAuditLog(selectedDate)
  const { personnel } = usePersonnel()
  const { config } = useAppConfig()
  const summary = entries.length > 0 ? generateAuditSummary(entries) : null
  const groupedEntries = viewMode === 'grouped' ? groupEntriesByPersonnel(entries) : []

  function getActionIcon(entry) {
    if (entry.action === 'sign_out' || entry.status === 'pass') {
      return (
        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      )
    }
    if (entry.action === 'stage_arrived') {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
    if (entry.action === 'stage_enroute_back') {
      return (
        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    }
    if (entry.action === 'arrived_barracks' || (entry.status === 'present' && entry.previousStatus === 'pass')) {
      return (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Pass Audit Log</h3>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-2 text-sm ${
                  viewMode === 'timeline'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-2 text-sm ${
                  viewMode === 'grouped'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                By Person
              </button>
            </div>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Export
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-700">{summary.totalSignOuts}</div>
              <div className="text-xs text-yellow-600">Sign Outs</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{summary.totalSignIns}</div>
              <div className="text-xs text-green-600">Sign Ins</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-700">{summary.uniquePersonnel}</div>
              <div className="text-xs text-blue-600">Personnel</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-700">{summary.entries}</div>
              <div className="text-xs text-gray-600">Total Events</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {loading && <Loading />}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No pass activities recorded for this date</p>
          </div>
        )}

        {/* Timeline View */}
        {!loading && viewMode === 'timeline' && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActionIcon(entry)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {entry.personnelRank && `${entry.personnelRank} `}
                      {entry.personnelName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {formatAuditAction(entry)}
                  </p>
                  {entry.companions?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      With: {entry.companions.map(c => c.name).join(', ')}
                    </p>
                  )}
                  {entry.contactNumber && (
                    <p className="text-xs text-gray-500">
                      Contact: {entry.contactNumber}
                    </p>
                  )}
                  {entry.expectedReturn && (
                    <p className="text-xs text-gray-500">
                      Expected back: {new Date(entry.expectedReturn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                {entry.selfUpdated ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Self</span>
                ) : entry.adminSignIn ? (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Admin</span>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Grouped View */}
        {!loading && viewMode === 'grouped' && groupedEntries.length > 0 && (
          <div className="space-y-4">
            {groupedEntries.map((group) => (
              <div key={group.personnelId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-900">
                    {group.personnelRank && `${group.personnelRank} `}
                    {group.personnelName}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({group.entries.length} events)
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="px-4 py-2 flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16">
                        {formatTime(entry.timestamp)}
                      </span>
                      {getActionIcon(entry)}
                      <span className="text-sm text-gray-700">
                        {formatAuditAction(entry)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          selectedDate={selectedDate}
          entries={entries}
          onClose={() => setShowExportModal(false)}
          personnel={personnel}
          config={config}
        />
      )}
    </div>
  )
}

function ExportModal({ selectedDate, entries, onClose, personnel, config }) {
  const { fetchRange, loading } = useCQAuditLogRange()
  const [startDate, setStartDate] = useState(selectedDate)
  const [endDate, setEndDate] = useState(selectedDate)
  const [trainingStartDate, setTrainingStartDate] = useState(config?.trainingStartDate || '')
  const [exportData, setExportData] = useState(null)

  // Build personnel data map for PDF export
  const personnelDataMap = (personnel || []).reduce((acc, p) => {
    acc[p.id] = p
    if (p.userId) acc[p.userId] = p
    return acc
  }, {})

  async function handleFetchRange() {
    const data = await fetchRange(startDate, endDate)
    setExportData(data)
  }

  function handleExportCSV() {
    const data = exportData || entries
    if (!data.length) return

    const headers = ['Date', 'Event Time', 'Time Out', 'Name', 'Rank', 'Action', 'Destination', 'Contact', 'Expected Return', 'With', 'Updated By']
    const rows = data.map(entry => [
      entry.timestamp ? formatDate(entry.timestamp) : '',
      entry.timestamp ? formatTime(entry.timestamp) : '',
      entry.timeOut ? new Date(entry.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      entry.personnelName || '',
      entry.personnelRank || '',
      formatAuditAction(entry),
      entry.destination || '',
      entry.contactNumber || '',
      entry.expectedReturn ? new Date(entry.expectedReturn).toLocaleString() : '',
      entry.companions?.map(c => c.name).join('; ') || '',
      entry.selfUpdated ? 'Self' : entry.updatedByName || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `cq-audit-log-${startDate}${startDate !== endDate ? `-to-${endDate}` : ''}.csv`
    link.click()
  }

  function handleExportJSON() {
    const data = exportData || entries
    if (!data.length) return

    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `cq-audit-log-${startDate}${startDate !== endDate ? `-to-${endDate}` : ''}.json`
    link.click()
  }

  function handleExportPDF() {
    const data = exportData || entries
    if (!data.length) return

    downloadSignoutRosterPdf(data, {
      startDate,
      endDate,
      personnelData: personnelDataMap,
      trainingStartDate: trainingStartDate || undefined
    })
  }

  function handleExportBlankPDF() {
    downloadBlankSignoutRosterPdf(startDate)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Export Audit Log</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {startDate !== endDate && (
            <button
              onClick={handleFetchRange}
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Date Range'}
            </button>
          )}

          {exportData && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              Loaded {exportData.length} entries from {startDate} to {endDate}
            </div>
          )}

          {/* Data Export Section */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Export Data ({exportData?.length || entries.length} entries)
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                disabled={!(exportData?.length || entries.length)}
                className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                CSV
              </button>
              <button
                onClick={handleExportJSON}
                disabled={!(exportData?.length || entries.length)}
                className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                JSON
              </button>
            </div>
          </div>

          {/* PDF Signout Roster Section */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Signout Roster (PDF)
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Military-format signout roster matching DA Form style
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Training Start Date (for week calculation)
              </label>
              <input
                type="date"
                value={trainingStartDate}
                onChange={(e) => setTrainingStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                disabled={!(exportData?.length || entries.length)}
                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                With Data
              </button>
              <button
                onClick={handleExportBlankPDF}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Blank Form
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
