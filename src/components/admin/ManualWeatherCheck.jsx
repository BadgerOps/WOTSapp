import { useState } from 'react'
import { useWeatherCache, useWeatherActions } from '../../hooks/useWeatherCache'
import { useWeatherLocation } from '../../hooks/useWeatherLocation'
import Loading from '../common/Loading'

export default function ManualWeatherCheck() {
  const { weather, loading: cacheLoading } = useWeatherCache()
  const { location } = useWeatherLocation()
  const { refreshWeather, triggerWeatherCheck, loading, error } = useWeatherActions()

  const [targetSlot, setTargetSlot] = useState('')
  const [result, setResult] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showForceOption, setShowForceOption] = useState(false)

  async function handleRefresh() {
    try {
      await refreshWeather()
      setSuccess('Weather data refreshed')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      // Error handled in hook
    }
  }

  async function handleTriggerCheck(force = false) {
    setResult(null)
    setShowForceOption(false)
    try {
      const res = await triggerWeatherCheck(targetSlot || null, force)
      setResult(res)
      if (res.recommendation) {
        setSuccess(force
          ? 'Weather check complete - new recommendation created (previous superseded)!'
          : 'Weather check complete - recommendation created!')
      } else if (res.skipped) {
        setShowForceOption(true)
        setSuccess(null)
      } else {
        setSuccess('Weather check complete - no recommendation created')
      }
      if (!res.skipped) {
        setTimeout(() => setSuccess(null), 5000)
      }
    } catch (err) {
      // Error handled in hook
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (cacheLoading) {
    return <Loading />
  }

  const current = weather?.current
  const forecast = weather?.forecast

  return (
    <div className="space-y-6">
      {/* Location Check */}
      {!location?.coordinates && (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800 font-medium">Weather location not configured</p>
          <p className="text-sm text-yellow-700 mt-1">
            Please configure a weather location in the Weather UOTD tab before running weather checks.
          </p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Current Weather Display */}
      {current && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Weather</h3>
            <button
              onClick={handleRefresh}
              disabled={loading || !location?.coordinates}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold text-gray-900">
              {Math.round(current.temperature)}°
            </div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                {current.weatherMain || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500">
                Feels like {Math.round(current.feelsLike || current.temperature)}°
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500">Humidity</p>
              <p className="text-lg font-medium text-gray-900">{current.humidity}%</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500">Wind Speed</p>
              <p className="text-lg font-medium text-gray-900">{Math.round(current.windSpeed)} mph</p>
            </div>
            {current.uvIndex !== null && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">UV Index</p>
                <p className="text-lg font-medium text-gray-900">{current.uvIndex}</p>
              </div>
            )}
            {forecast?.precipitationChance > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Precip. Chance</p>
                <p className="text-lg font-medium text-gray-900">
                  {Math.round(forecast.precipitationChance)}%
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Location: {weather?.location?.name || 'Unknown'} | Last updated: {formatTime(weather?.fetchedAt)}
          </p>
        </div>
      )}

      {/* Manual Weather Check */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trigger Weather Check</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manually trigger a weather check to create a uniform recommendation based on current conditions.
        </p>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Slot (optional)
            </label>
            <select
              value={targetSlot}
              onChange={(e) => setTargetSlot(e.target.value)}
              className="input"
            >
              <option value="">Auto (based on time)</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => handleTriggerCheck(false)}
          disabled={loading || !location?.coordinates}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? 'Checking Weather...' : 'Run Weather Check'}
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className="card bg-blue-50 border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Check Result</h4>
          {result.recommendation ? (
            <div className="text-sm text-blue-800">
              <p>
                <strong>Recommended:</strong> #{result.recommendation.uniformNumber} -{' '}
                {result.recommendation.uniformName}
              </p>
              <p>
                <strong>Matched Rule:</strong> {result.recommendation.matchedRule}
              </p>
              <p>
                <strong>Target:</strong> {result.recommendation.targetSlot} on{' '}
                {result.recommendation.targetDate}
              </p>
              <p className="mt-2 text-blue-600">
                Recommendation created! Check the Approvals tab to review.
              </p>
            </div>
          ) : result.skipped ? (
            <div className="text-sm text-blue-800">
              <p className="text-blue-700 mb-3">
                A recommendation already exists for this slot. Check the Approvals tab.
              </p>
              {showForceOption && (
                <button
                  onClick={() => handleTriggerCheck(true)}
                  disabled={loading}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Override & Create New Recommendation'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-blue-700">{result.message}</p>
          )}
        </div>
      )}

      {/* Scheduled Checks Info */}
      <div className="card bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Automatic Weather Checks</h3>
        <p className="text-sm text-gray-600">
          Weather checks run automatically at 6:00 AM, 10:00 AM, and 3:00 PM Eastern Time.
          Each check creates a pending recommendation that must be approved before it becomes a UOTD post.
        </p>
      </div>
    </div>
  )
}
