import { useState } from 'react'
import { usePersonnelConfig, usePersonnelConfigActions } from '../../hooks/usePersonnelConfig'
import { isValidClassFormat } from '../../lib/personnelCsvParser'

export default function PersonnelConfigPanel() {
  const { config, loading, error } = usePersonnelConfig()
  const { addFlight, removeFlight, addClass, removeClass, loading: actionLoading } = usePersonnelConfigActions()
  const [newFlight, setNewFlight] = useState('')
  const [newClass, setNewClass] = useState('')
  const [classError, setClassError] = useState('')
  const [flightError, setFlightError] = useState('')

  if (loading) {
    return <div className="text-gray-600">Loading configuration...</div>
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>
  }

  const flights = config?.flights || []
  const classes = config?.classes || []

  async function handleAddFlight(e) {
    e.preventDefault()
    setFlightError('')
    if (!newFlight.trim()) return

    try {
      const result = await addFlight(newFlight.trim())
      if (result?.reason === 'duplicate') {
        setFlightError('Flight already exists')
        return
      }
      setNewFlight('')
    } catch (err) {
      console.error('Error adding flight:', err)
      setFlightError('Failed to add flight: ' + err.message)
    }
  }

  async function handleRemoveFlight(flight) {
    if (!confirm(`Remove flight "${flight}"?`)) return

    try {
      await removeFlight(flight)
    } catch (err) {
      console.error('Error removing flight:', err)
    }
  }

  async function handleAddClass(e) {
    e.preventDefault()
    setClassError('')

    if (!newClass.trim()) return

    if (!isValidClassFormat(newClass)) {
      setClassError('Invalid format. Use NN-NN (e.g., 26-03)')
      return
    }

    try {
      const result = await addClass(newClass.trim())
      if (result?.reason === 'duplicate') {
        setClassError('Class already exists')
        return
      }
      setNewClass('')
    } catch (err) {
      console.error('Error adding class:', err)
      setClassError('Failed to add class: ' + err.message)
    }
  }

  async function handleRemoveClass(className) {
    if (!confirm(`Remove class "${className}"?`)) return

    try {
      await removeClass(className)
    } catch (err) {
      console.error('Error removing class:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Flights Configuration */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Flights</h3>
        <p className="text-sm text-gray-600 mb-3">
          Configure the available flight options for personnel assignment.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {flights.length === 0 ? (
            <span className="text-gray-500 text-sm">No flights configured</span>
          ) : (
            flights.map((flight) => (
              <span
                key={flight}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
              >
                {flight}
                <button
                  onClick={() => handleRemoveFlight(flight)}
                  disabled={actionLoading}
                  className="ml-1 text-primary-600 hover:text-primary-800 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))
          )}
        </div>

        <form onSubmit={handleAddFlight} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFlight}
              onChange={(e) => {
                setNewFlight(e.target.value)
                setFlightError('')
              }}
              placeholder="New flight name..."
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm ${
                flightError ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <button
              type="submit"
              disabled={actionLoading || !newFlight.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
            >
              Add
            </button>
          </div>
          {flightError && <p className="text-red-600 text-xs">{flightError}</p>}
        </form>
      </div>

      {/* Classes Configuration */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Classes</h3>
        <p className="text-sm text-gray-600 mb-3">
          Configure the available class options. Format: NN-NN (e.g., 26-03)
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {classes.length === 0 ? (
            <span className="text-gray-500 text-sm">No classes configured</span>
          ) : (
            classes.map((className) => (
              <span
                key={className}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {className}
                <button
                  onClick={() => handleRemoveClass(className)}
                  disabled={actionLoading}
                  className="ml-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))
          )}
        </div>

        <form onSubmit={handleAddClass} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newClass}
              onChange={(e) => {
                setNewClass(e.target.value)
                setClassError('')
              }}
              placeholder="NN-NN (e.g., 26-03)"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm ${
                classError ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <button
              type="submit"
              disabled={actionLoading || !newClass.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
            >
              Add
            </button>
          </div>
          {classError && <p className="text-red-600 text-xs">{classError}</p>}
        </form>
      </div>
    </div>
  )
}
