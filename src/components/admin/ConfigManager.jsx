import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DEFAULT_CONFIG } from '../../hooks/useAppConfig';

// Validate class format (NN-NN)
function isValidClassFormat(classValue) {
  if (!classValue) return false;
  const classRegex = /^\d{2}-\d{2}$/;
  return classRegex.test(classValue.trim());
}

export default function ConfigManager() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [newFlight, setNewFlight] = useState('');
  const [newClass, setNewClass] = useState('');
  const [classError, setClassError] = useState('');
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

  function handleAddClass() {
    setClassError('');
    if (!newClass.trim()) return;

    if (!isValidClassFormat(newClass)) {
      setClassError('Invalid format. Use NN-NN (e.g., 26-03)');
      return;
    }

    if (config.classes?.includes(newClass.trim())) {
      setClassError('Class already exists');
      return;
    }

    setConfig({
      ...config,
      classes: [...(config.classes || []), newClass.trim()],
    });
    setNewClass('');
  }

  function handleRemoveClass(className) {
    setConfig({
      ...config,
      classes: (config.classes || []).filter((c) => c !== className),
    });
  }

  // Calculate days until graduation for preview
  function getGraduationCountdown() {
    if (!config.graduationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gradDate = new Date(config.graduationDate + 'T00:00:00');
    const diffTime = gradDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // "X days and a wakeup" means graduation day minus 1
    return diffDays - 1;
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  const daysLeft = getGraduationCountdown();

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
            Current Class Number
          </label>
          <select
            id="classNumber"
            value={config.classNumber}
            onChange={(e) =>
              setConfig({ ...config, classNumber: e.target.value })
            }
            className="input"
          >
            <option value="">Select a class...</option>
            {(config.classes || []).map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            The active class for this instance
          </p>
        </div>

        {/* Graduation Date */}
        <div>
          <label
            htmlFor="graduationDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Graduation Date
          </label>
          <input
            id="graduationDate"
            type="date"
            value={config.graduationDate || ''}
            onChange={(e) =>
              setConfig({ ...config, graduationDate: e.target.value })
            }
            className="input"
          />
          {daysLeft !== null && (
            <p className="mt-1 text-sm text-primary-600 font-medium">
              {daysLeft > 0
                ? `${daysLeft} days and a wakeup left!`
                : daysLeft === 0
                ? "Tomorrow is the day!"
                : "Graduation day has passed"}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Shows countdown on the home page for candidates
          </p>
        </div>

        {/* Classes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Classes
          </label>

          <div className="space-y-2 mb-3">
            {(!config.classes || config.classes.length === 0) && (
              <p className="text-sm text-gray-500 italic">
                No classes configured. Add your first class below.
              </p>
            )}

            {(config.classes || []).map((cls) => (
              <div
                key={cls}
                className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
              >
                <span className="text-sm font-medium text-blue-900">
                  {cls}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveClass(cls)}
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
              value={newClass}
              onChange={(e) => {
                setNewClass(e.target.value);
                setClassError('');
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddClass();
                }
              }}
              className={`input flex-1 ${classError ? 'border-red-300' : ''}`}
              placeholder="NN-NN (e.g., 26-03)"
            />
            <button
              type="button"
              onClick={handleAddClass}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Add Class
            </button>
          </div>
          {classError && <p className="mt-1 text-xs text-red-600">{classError}</p>}
          <p className="mt-1 text-xs text-gray-500">
            Class identifiers available for personnel assignment (format: NN-NN)
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
              placeholder="e.g., Barrow, Long, Brow"
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
            Flight names available for personnel assignment
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
