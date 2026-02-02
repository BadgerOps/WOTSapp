import { useState, useEffect } from 'react'
import { useAppConfig } from '../../hooks/useAppConfig'
import { formatTimeInTimezone, DEFAULT_TIMEZONE } from '../../lib/timezone'
import { APP_VERSION } from '../../config/appVersion'

export default function Footer() {
  const { config } = useAppConfig()
  const timezone = config?.timezone || DEFAULT_TIMEZONE
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Format the timezone for display (e.g., "America/Chicago" -> "Central Time")
  const timezoneLabel = timezone
    .replace('America/', '')
    .replace('_', ' ')
    .replace('New York', 'Eastern')
    .replace('Chicago', 'Central')
    .replace('Denver', 'Mountain')
    .replace('Los Angeles', 'Pacific')

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40">
      <div className="bg-gray-800 text-gray-300 py-2 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-gray-500">WOTS App v{APP_VERSION}</span>
          <span className="text-red-500 font-semibold">Candidate Led App</span>
          <span className="font-mono">
            {formatTimeInTimezone(currentTime, timezone)} {timezoneLabel}
          </span>
        </div>
      </div>
    </footer>
  )
}
