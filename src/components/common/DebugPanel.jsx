import { useState, useEffect } from 'react'
import { getAuthLogs, clearAuthLogs } from '../../lib/authDebugger'

/**
 * Mobile-friendly debug panel for iOS PWA
 * Access by tapping the version number 5 times in Profile page
 * Or by adding ?debug=true to the URL
 */
export default function DebugPanel({ onClose }) {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadLogs()

    if (autoRefresh) {
      const interval = setInterval(loadLogs, 2000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  function loadLogs() {
    const authLogs = getAuthLogs()
    setLogs(authLogs.reverse()) // newest first
  }

  function handleClear() {
    if (window.confirm('Clear all debug logs?')) {
      clearAuthLogs()
      setLogs([])
    }
  }

  function handleExport() {
    const data = JSON.stringify(logs, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wots-debug-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCopy() {
    const text = logs
      .map((log) => `${log.timestamp} [${log.category}] ${log.message}${log.data ? ' | ' + log.data : ''}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      alert('Logs copied to clipboard')
    })
  }

  const filteredLogs = filter
    ? logs.filter(
        (log) =>
          log.category.toLowerCase().includes(filter.toLowerCase()) ||
          log.message.toLowerCase().includes(filter.toLowerCase()) ||
          (log.data && log.data.toLowerCase().includes(filter.toLowerCase()))
      )
    : logs

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-lg font-bold">Debug Logs</h2>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-gray-700 rounded text-sm"
        >
          Close
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 rounded text-sm border border-gray-600"
          />
          <button
            onClick={loadLogs}
            className="px-3 py-2 bg-blue-600 rounded text-sm"
          >
            Refresh
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-gray-700 rounded text-xs"
          >
            Copy All
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1 bg-gray-700 rounded text-xs"
          >
            Export JSON
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1 bg-red-700 rounded text-xs"
          >
            Clear Logs
          </button>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
        </div>
        <div className="text-xs text-gray-400">
          {filteredLogs.length} logs {filter && `(filtered from ${logs.length})`}
        </div>
      </div>

      {/* Device Info */}
      <div className="p-3 bg-gray-800 border-b border-gray-700 text-xs space-y-1">
        <div><strong>UA:</strong> {navigator.userAgent}</div>
        <div><strong>Standalone:</strong> {window.matchMedia('(display-mode: standalone)').matches ? 'Yes (PWA)' : 'No (Browser)'}</div>
        <div><strong>URL:</strong> {window.location.href}</div>
        <div><strong>Time:</strong> {new Date().toISOString()}</div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No logs yet</div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 bg-gray-800 rounded text-xs border-l-2 border-blue-500"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-blue-400 font-mono">[{log.category}]</span>
                  <span className="text-gray-500 text-[10px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-200 mt-1">{log.message}</div>
                {log.data && (
                  <pre className="text-gray-400 mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                    {log.data}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
