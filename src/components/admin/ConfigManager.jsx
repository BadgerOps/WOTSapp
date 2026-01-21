import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DEFAULT_CONFIG } from '../../hooks/useAppConfig';

export default function ConfigManager() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [newFlight, setNewFlight] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, 'settings', 'appConfig');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...docSnap.data() });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Failed to load configuration');
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const docRef = doc(db, 'settings', 'appConfig');
      await setDoc(docRef, config);

      setSuccess(true);
      setSaving(false);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
      setSaving(false);
    }
  }

  function handleAddFlight() {
    if (!newFlight.trim()) return;

    if (config.flights.includes(newFlight.trim())) {
      setError('Flight already exists');
      return;
    }

    setConfig({
      ...config,
      flights: [...config.flights, newFlight.trim()],
    });
    setNewFlight('');
    setError(null);
  }

  function handleRemoveFlight(flight) {
    setConfig({
      ...config,
      flights: config.flights.filter((f) => f !== flight),
    });
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Application Configuration
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Configuration saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Timezone */}
        <div>
          <label
            htmlFor="timezone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Timezone
          </label>
          <select
            id="timezone"
            value={config.timezone}
            onChange={(e) =>
              setConfig({ ...config, timezone: e.target.value })
            }
            className="input"
          >
            <option value="America/New_York">Eastern (America/New_York)</option>
            <option value="America/Chicago">Central (America/Chicago)</option>
            <option value="America/Denver">Mountain (America/Denver)</option>
            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
            <option value="America/Anchorage">Alaska (America/Anchorage)</option>
            <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
            <option value="Europe/London">London (Europe/London)</option>
            <option value="Europe/Berlin">Berlin (Europe/Berlin)</option>
            <option value="Asia/Tokyo">Tokyo (Asia/Tokyo)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Used for scheduling weather checks and other time-based features
          </p>
        </div>

        {/* Class Number */}
        <div>
          <label
            htmlFor="classNumber"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Class Number
          </label>
          <input
            id="classNumber"
            type="text"
            value={config.classNumber}
            onChange={(e) =>
              setConfig({ ...config, classNumber: e.target.value })
            }
            className="input"
            placeholder="e.g., 26-01, 2024-B"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your class or cohort identifier
          </p>
        </div>

        {/* Flights */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Flights
          </label>

          <div className="space-y-2 mb-3">
            {config.flights.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                No flights configured. Add your first flight below.
              </p>
            )}

            {config.flights.map((flight) => (
              <div
                key={flight}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <span className="text-sm font-medium text-gray-900">
                  {flight}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFlight(flight)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newFlight}
              onChange={(e) => setNewFlight(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFlight();
                }
              }}
              className="input flex-1"
              placeholder="e.g., Flight A, Alpha Flight"
            />
            <button
              type="button"
              onClick={handleAddFlight}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Add Flight
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Flight names will be available when importing personnel rosters
          </p>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
}
