import { useState } from 'react'
import { useWeatherLocation, useWeatherLocationActions } from '../../hooks/useWeatherLocation'
import Loading from '../common/Loading'

export default function WeatherLocationManager() {
  const { location, loading, error } = useWeatherLocation()
  const { geocodeLocation, updateUnits, loading: saving, error: actionError } = useWeatherLocationActions()

  const [inputType, setInputType] = useState('zipcode')
  const [zipcode, setZipcode] = useState('')
  const [address, setAddress] = useState('')
  const [units, setUnits] = useState('imperial')
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleInputTypeChange(type) {
    setInputType(type)
    setFormError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    if (inputType === 'zipcode' && !zipcode.trim()) {
      setFormError('Zip code is required')
      return
    }

    if (inputType === 'address' && !address.trim()) {
      setFormError('Address is required')
      return
    }

    try {
      await geocodeLocation({
        inputType,
        zipcode: inputType === 'zipcode' ? zipcode.trim() : null,
        address: inputType === 'address' ? address.trim() : null,
        units,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message || 'Failed to geocode location')
    }
  }

  async function handleUnitsChange(newUnits) {
    setUnits(newUnits)
    if (location?.coordinates) {
      try {
        await updateUnits(newUnits)
      } catch (err) {
        console.error('Failed to update units:', err)
      }
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* Current Location Display */}
      {location?.coordinates && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Current Location</h3>
          <p className="text-blue-900 font-medium">{location.coordinates.resolvedAddress}</p>
          <p className="text-sm text-blue-700 mt-1">
            Coordinates: {location.coordinates.lat.toFixed(4)}, {location.coordinates.lon.toFixed(4)}
          </p>
          <p className="text-sm text-blue-700">
            Units: {location.units === 'metric' ? 'Metric (°C, km/h)' : 'Imperial (°F, mph)'}
          </p>
        </div>
      )}

      {/* Location Configuration Form */}
      <form onSubmit={handleSubmit} className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {location?.coordinates ? 'Update Location' : 'Configure Weather Location'}
        </h2>

        {(formError || actionError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {formError || actionError}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Location configured successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            Error loading location: {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Input Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location Input Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="inputType"
                  value="zipcode"
                  checked={inputType === 'zipcode'}
                  onChange={() => handleInputTypeChange('zipcode')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Zip Code</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="inputType"
                  value="address"
                  checked={inputType === 'address'}
                  onChange={() => handleInputTypeChange('address')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Address</span>
              </label>
            </div>
          </div>

          {/* Zip Code Input */}
          {inputType === 'zipcode' && (
            <div>
              <label htmlFor="zipcode" className="block text-sm font-medium text-gray-700 mb-1">
                Zip Code (US)
              </label>
              <input
                id="zipcode"
                type="text"
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value)}
                className="input"
                placeholder="e.g., 90210"
                pattern="[0-9]{5}"
                maxLength={5}
              />
              <p className="mt-1 text-xs text-gray-500">Enter a 5-digit US zip code</p>
            </div>
          )}

          {/* Address Input */}
          {inputType === 'address' && (
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address or City
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                placeholder="e.g., Fort Bragg, NC"
              />
              <p className="mt-1 text-xs text-gray-500">Enter a city name or full address</p>
            </div>
          )}

          {/* Units Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature Units
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="units"
                  value="imperial"
                  checked={units === 'imperial'}
                  onChange={() => handleUnitsChange('imperial')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Imperial (°F, mph)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="units"
                  value="metric"
                  checked={units === 'metric'}
                  onChange={() => handleUnitsChange('metric')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Metric (°C, km/h)</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-50"
          >
            {saving ? 'Saving...' : location?.coordinates ? 'Update Location' : 'Set Location'}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="card bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">About Weather Location</h3>
        <p className="text-sm text-gray-600">
          Configure the location used to fetch weather data for uniform recommendations.
          Weather conditions at this location will be used to match against your weather rules.
        </p>
      </div>
    </div>
  )
}
