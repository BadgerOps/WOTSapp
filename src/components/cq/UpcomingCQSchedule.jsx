import { useMemo } from 'react'
import { useCQSchedule, CQ_SHIFT_TIMES } from '../../hooks/useCQSchedule'
import { useAppConfig } from '../../hooks/useAppConfig'
import { getTodayInTimezone, DEFAULT_TIMEZONE } from '../../lib/timezone'
import { format } from 'date-fns'

/**
 * Read-only upcoming CQ schedule display for all users
 * Shows the next several days of CQ assignments
 */
export default function UpcomingCQSchedule({ limit = 7 }) {
  const { schedule, loading, error } = useCQSchedule()
  const { config } = useAppConfig()

  const timezone = config?.timezone || DEFAULT_TIMEZONE
  const today = getTodayInTimezone(timezone)

  // Filter to upcoming shifts and limit the display
  const upcomingSchedule = useMemo(() => {
    return schedule
      .filter((s) => s.date >= today && s.status !== 'completed')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, limit)
  }, [schedule, today, limit])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Upcoming CQ Schedule
        </h3>
        <div className="flex justify-center py-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Upcoming CQ Schedule
        </h3>
        <p className="text-sm text-red-600">Error loading schedule: {error}</p>
      </div>
    )
  }

  if (upcomingSchedule.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Upcoming CQ Schedule
        </h3>
        <p className="text-sm text-gray-500 italic">
          No upcoming CQ schedule available.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-900">Upcoming CQ Schedule</h3>
        <p className="text-xs text-gray-500 mt-0.5">Next {upcomingSchedule.length} days</p>
      </div>

      <div className="divide-y divide-gray-200">
        {upcomingSchedule.map((entry) => {
          // Support both new format (shift1/shift2) and legacy format (firstShift/secondShift)
          const isNewFormat = entry.shift1Person1Name !== undefined

          // Build shift display strings
          const shift1People = isNewFormat
            ? [entry.shift1Person1Name, entry.shift1Person2Name].filter(Boolean)
            : [entry.firstShiftName].filter(Boolean)
          const shift2People = isNewFormat
            ? [entry.shift2Person1Name, entry.shift2Person2Name].filter(Boolean)
            : [entry.secondShiftName].filter(Boolean)

          const isToday = entry.date === today
          const isPotentialSkip = entry.isPotentialSkipDay || entry.isLikelySkipDay

          return (
            <div
              key={entry.id}
              className={`p-4 ${
                isToday
                  ? 'bg-primary-50'
                  : isPotentialSkip
                  ? 'bg-orange-50'
                  : ''
              }`}
            >
              {/* Date header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {format(new Date(entry.date + 'T12:00:00'), 'EEE, MMM d')}
                  </span>
                  {isToday && (
                    <span className="text-xs bg-primary-200 text-primary-800 px-2 py-0.5 rounded-full font-medium">
                      Tonight
                    </span>
                  )}
                  {isPotentialSkip && (
                    <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                      {entry.skipDayReason || 'May be skipped'}
                    </span>
                  )}
                </div>
                {entry.status === 'active' && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>

              {/* Shifts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Shift 1 */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Shift 1 ({CQ_SHIFT_TIMES.shift1.label})
                  </div>
                  {shift1People.length > 0 ? (
                    <ul className="space-y-0.5">
                      {shift1People.map((name, idx) => (
                        <li key={idx} className="text-sm text-gray-900">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Unassigned</span>
                  )}
                </div>

                {/* Shift 2 */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Shift 2 ({CQ_SHIFT_TIMES.shift2.label})
                  </div>
                  {shift2People.length > 0 ? (
                    <ul className="space-y-0.5">
                      {shift2People.map((name, idx) => (
                        <li key={idx} className="text-sm text-gray-900">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Unassigned</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
