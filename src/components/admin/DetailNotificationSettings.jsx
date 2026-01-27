import { useState, useEffect } from 'react'
import { useDetailConfig, useDetailConfigActions } from '../../hooks/useDetailConfig'
import { useAppConfig } from '../../hooks/useAppConfig'

export default function DetailNotificationSettings() {
  const { config, loading: configLoading, error: configError } = useDetailConfig()
  const { updateConfig, loading: saving, error: saveError } = useDetailConfigActions()
  const { config: appConfig } = useAppConfig()

  const [morningTime, setMorningTime] = useState('07:00')
  const [eveningTime, setEveningTime] = useState('19:00')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [success, setSuccess] = useState(false)

  // Load config values when available
  useEffect(() => {
    if (config) {
      setMorningTime(config.morningNotificationTime || '07:00')
      setEveningTime(config.eveningNotificationTime || '19:00')
      setNotificationsEnabled(config.notificationEnabled !== false)
    }
  }, [config])

  async function handleSave(e) {
    e.preventDefault()
    setSuccess(false)

    try {
      await updateConfig({
        morningNotificationTime: morningTime,
        eveningNotificationTime: eveningTime,
        notificationEnabled: notificationsEnabled,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving notification settings:', err)
    }
  }

  if (configLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const timezone = appConfig?.timezone || 'America/New_York'

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Detail Notification Settings
      </h2>

      <p className="text-sm text-gray-600 mb-4">
        Configure when push notifications are sent to remind personnel of their cleaning detail assignments.
        Times are in the configured timezone: <span className="font-medium">{timezone}</span>
      </p>

      {(configError || saveError) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {configError || saveError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="font-medium text-gray-900">
              Enable Detail Notifications
            </label>
            <p className="text-sm text-gray-500">
              Send push notifications at configured times
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              notificationsEnabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Time Inputs */}
        <div className={`space-y-4 ${!notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label htmlFor="morningTime" className="block text-sm font-medium text-gray-700 mb-1">
              Morning Notification Time
            </label>
            <input
              type="time"
              id="morningTime"
              value={morningTime}
              onChange={(e) => setMorningTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Notifications sent for morning time slot details
            </p>
          </div>

          <div>
            <label htmlFor="eveningTime" className="block text-sm font-medium text-gray-700 mb-1">
              Evening Notification Time
            </label>
            <input
              type="time"
              id="eveningTime"
              value={eveningTime}
              onChange={(e) => setEveningTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Notifications sent for evening time slot details
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-1">How it works</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Notifications are sent to personnel with assigned tasks for that time slot</li>
            <li>• Only assignments with status "assigned", "in progress", or "rejected" trigger notifications</li>
            <li>• Personnel must have push notifications enabled in the app to receive them</li>
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
