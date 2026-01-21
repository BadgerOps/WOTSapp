import { useState, useEffect } from 'react'
import { useUotdSchedule, useUotdScheduleActions } from '../../hooks/useUotdSchedule'
import { useUniforms } from '../../hooks/useUniforms'
import { useAppConfig, DEFAULT_CONFIG } from '../../hooks/useAppConfig'
import Loading from '../common/Loading'

const SLOT_CONFIG = {
  breakfast: { label: 'Breakfast', defaultTime: '0550', icon: '🌅' },
  lunch: { label: 'Lunch', defaultTime: '1115', icon: '☀️' },
  dinner: { label: 'Dinner', defaultTime: '1750', icon: '🌙' },
}

function formatTime(timeStr) {
  if (!timeStr || timeStr.length !== 4) return timeStr
  const hours = parseInt(timeStr.substring(0, 2), 10)
  const minutes = timeStr.substring(2)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes} ${ampm}`
}

function formatLastFired(timestamp, timezone) {
  if (!timestamp) return 'Never'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function TimeInput({ value, onChange }) {
  // Convert HHmm to HH:mm for the input
  const inputValue = value ? `${value.substring(0, 2)}:${value.substring(2)}` : ''

  function handleChange(e) {
    // Convert HH:mm back to HHmm
    const newValue = e.target.value.replace(':', '')
    onChange(newValue)
  }

  return (
    <input
      type="time"
      value={inputValue}
      onChange={handleChange}
      className="input"
    />
  )
}

function SlotCard({ slotKey, slot, uniforms, timezone, onUpdate, saving }) {
  const config = SLOT_CONFIG[slotKey]
  const [localSlot, setLocalSlot] = useState(slot)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSlot(slot)
    setHasChanges(false)
  }, [slot])

  function updateLocal(updates) {
    setLocalSlot((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  function handleSave() {
    onUpdate(slotKey, localSlot)
    setHasChanges(false)
  }

  function handleCancel() {
    setLocalSlot(slot)
    setHasChanges(false)
  }

  const selectedUniform = uniforms.find((u) => u.id === localSlot.uniformId)

  return (
    <div className={`card ${localSlot.enabled ? 'ring-2 ring-primary-500' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <h3 className="text-lg font-semibold text-gray-900">{config.label}</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={localSlot.enabled}
            onChange={(e) => updateLocal({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          <span className="ms-2 text-sm font-medium text-gray-700">
            {localSlot.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      <div className="space-y-4">
        {/* Uniform Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Uniform
          </label>
          <select
            value={localSlot.uniformId || ''}
            onChange={(e) => updateLocal({ uniformId: e.target.value || null })}
            className="input"
          >
            <option value="">Select a uniform...</option>
            {uniforms.map((uniform) => (
              <option key={uniform.id} value={uniform.id}>
                {uniform.number} - {uniform.name}
              </option>
            ))}
          </select>
          {selectedUniform?.description && (
            <p className="mt-1 text-xs text-gray-500">{selectedUniform.description}</p>
          )}
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Time
          </label>
          <TimeInput
            value={localSlot.time}
            onChange={(time) => updateLocal({ time })}
          />
        </div>

        {/* Last Fired */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Last fired: <span className="font-medium">{formatLastFired(slot.lastFired, timezone)}</span>
          </p>
        </div>

        {/* Save/Cancel Buttons */}
        {hasChanges && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UotdScheduleManager() {
  const { schedule, loading, error } = useUotdSchedule()
  const { updateSchedule, loading: saving } = useUotdScheduleActions()
  const { uniforms, loading: uniformsLoading } = useUniforms()
  const { config: appConfig, loading: configLoading } = useAppConfig()

  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Get timezone from app config (single source of truth)
  const timezone = appConfig?.timezone || DEFAULT_CONFIG.timezone

  async function handleSlotUpdate(slotKey, slotData) {
    setSaveError(null)
    try {
      await updateSchedule({
        slots: {
          ...schedule.slots,
          [slotKey]: slotData,
        },
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  if (loading || uniformsLoading || configLoading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="card text-center py-8 text-red-600">
        Error loading schedule: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          UOTD Auto-Posting Schedule
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Configure automatic Uniform of the Day posts at scheduled times.
          Each slot can have a different uniform and time.
        </p>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Settings saved successfully!
          </div>
        )}

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            Error: {saveError}
          </div>
        )}

        {/* Timezone Display (read-only, configured in Config tab) */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Timezone:</span> {timezone}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Change timezone in the Config tab
          </p>
        </div>
      </div>

      {/* Slot Cards */}
      {uniforms.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 mb-2">No uniforms defined yet.</p>
          <p className="text-sm text-gray-400">
            Add uniforms in the Uniforms tab before configuring the schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(SLOT_CONFIG).map(([slotKey]) => (
            <SlotCard
              key={slotKey}
              slotKey={slotKey}
              slot={schedule.slots?.[slotKey] || {
                enabled: false,
                uniformId: null,
                time: SLOT_CONFIG[slotKey].defaultTime,
                lastFired: null,
              }}
              uniforms={uniforms}
              timezone={timezone}
              onUpdate={handleSlotUpdate}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="card bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">How it works</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Enable a slot and select a uniform to auto-post at that time</li>
          <li>• Posts are created automatically and trigger push notifications</li>
          <li>• Each slot fires once per day at the configured time</li>
          <li>• The "Last fired" timestamp shows when the slot last posted</li>
        </ul>
      </div>
    </div>
  )
}
