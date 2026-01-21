import { useState } from 'react'
import { useWeatherRules, useWeatherRulesActions } from '../../hooks/useWeatherRules'
import { useUniforms } from '../../hooks/useUniforms'
import Loading from '../common/Loading'

const PRECIPITATION_TYPES = ['rain', 'snow', 'drizzle', 'thunderstorm']

function RuleForm({ rule, uniforms, onSave, onCancel, saving }) {
  const [name, setName] = useState(rule?.name || '')
  const [priority, setPriority] = useState(rule?.priority || 1)
  const [uniformId, setUniformId] = useState(rule?.uniformId || '')

  // Temperature conditions
  const [tempEnabled, setTempEnabled] = useState(!!rule?.conditions?.temperature)
  const [tempMin, setTempMin] = useState(rule?.conditions?.temperature?.min ?? '')
  const [tempMax, setTempMax] = useState(rule?.conditions?.temperature?.max ?? '')

  // Humidity conditions
  const [humidityEnabled, setHumidityEnabled] = useState(!!rule?.conditions?.humidity)
  const [humidityMin, setHumidityMin] = useState(rule?.conditions?.humidity?.min ?? '')
  const [humidityMax, setHumidityMax] = useState(rule?.conditions?.humidity?.max ?? '')

  // Wind conditions
  const [windEnabled, setWindEnabled] = useState(!!rule?.conditions?.wind)
  const [windSpeedMin, setWindSpeedMin] = useState(rule?.conditions?.wind?.speedMin ?? '')
  const [windSpeedMax, setWindSpeedMax] = useState(rule?.conditions?.wind?.speedMax ?? '')

  // UV conditions
  const [uvEnabled, setUvEnabled] = useState(!!rule?.conditions?.uvIndex)
  const [uvMin, setUvMin] = useState(rule?.conditions?.uvIndex?.min ?? '')
  const [uvMax, setUvMax] = useState(rule?.conditions?.uvIndex?.max ?? '')

  // Precipitation conditions
  const [precipEnabled, setPrecipEnabled] = useState(!!rule?.conditions?.precipitation)
  const [precipTypes, setPrecipTypes] = useState(rule?.conditions?.precipitation?.types || [])
  const [precipProbMin, setPrecipProbMin] = useState(rule?.conditions?.precipitation?.probability?.min ?? '')
  const [precipProbMax, setPrecipProbMax] = useState(rule?.conditions?.precipitation?.probability?.max ?? '')

  const [formError, setFormError] = useState(null)

  function togglePrecipType(type) {
    setPrecipTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Rule name is required')
      return
    }

    if (!uniformId) {
      setFormError('Please select a uniform')
      return
    }

    // Build conditions object
    const conditions = {}

    if (tempEnabled && (tempMin !== '' || tempMax !== '')) {
      conditions.temperature = {}
      if (tempMin !== '') conditions.temperature.min = Number(tempMin)
      if (tempMax !== '') conditions.temperature.max = Number(tempMax)
    }

    if (humidityEnabled && (humidityMin !== '' || humidityMax !== '')) {
      conditions.humidity = {}
      if (humidityMin !== '') conditions.humidity.min = Number(humidityMin)
      if (humidityMax !== '') conditions.humidity.max = Number(humidityMax)
    }

    if (windEnabled && (windSpeedMin !== '' || windSpeedMax !== '')) {
      conditions.wind = {}
      if (windSpeedMin !== '') conditions.wind.speedMin = Number(windSpeedMin)
      if (windSpeedMax !== '') conditions.wind.speedMax = Number(windSpeedMax)
    }

    if (uvEnabled && (uvMin !== '' || uvMax !== '')) {
      conditions.uvIndex = {}
      if (uvMin !== '') conditions.uvIndex.min = Number(uvMin)
      if (uvMax !== '') conditions.uvIndex.max = Number(uvMax)
    }

    if (precipEnabled && (precipTypes.length > 0 || precipProbMin !== '' || precipProbMax !== '')) {
      conditions.precipitation = {}
      if (precipTypes.length > 0) conditions.precipitation.types = precipTypes
      if (precipProbMin !== '' || precipProbMax !== '') {
        conditions.precipitation.probability = {}
        if (precipProbMin !== '') conditions.precipitation.probability.min = Number(precipProbMin)
        if (precipProbMax !== '') conditions.precipitation.probability.max = Number(precipProbMax)
      }
    }

    onSave({
      name: name.trim(),
      priority: Number(priority),
      uniformId,
      conditions,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="e.g., Cold Weather"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="input"
            min="1"
            max="100"
          />
          <p className="text-xs text-gray-500 mt-1">Lower = higher priority</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Uniform</label>
        <select
          value={uniformId}
          onChange={(e) => setUniformId(e.target.value)}
          className="input"
          required
        >
          <option value="">Select a uniform...</option>
          {uniforms.map((u) => (
            <option key={u.id} value={u.id}>
              #{u.number} - {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Conditions Section */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Weather Conditions</h4>
        <p className="text-xs text-gray-500 mb-4">Enable and configure the conditions that must be met for this rule to match.</p>

        {/* Temperature */}
        <div className="mb-4">
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={tempEnabled}
              onChange={(e) => setTempEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Temperature Range</span>
          </label>
          {tempEnabled && (
            <div className="flex items-center gap-2 ml-6">
              <input
                type="number"
                value={tempMin}
                onChange={(e) => setTempMin(e.target.value)}
                className="input w-20"
                placeholder="Min"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={tempMax}
                onChange={(e) => setTempMax(e.target.value)}
                className="input w-20"
                placeholder="Max"
              />
              <span className="text-sm text-gray-500">°F</span>
            </div>
          )}
        </div>

        {/* Humidity */}
        <div className="mb-4">
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={humidityEnabled}
              onChange={(e) => setHumidityEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Humidity Range</span>
          </label>
          {humidityEnabled && (
            <div className="flex items-center gap-2 ml-6">
              <input
                type="number"
                value={humidityMin}
                onChange={(e) => setHumidityMin(e.target.value)}
                className="input w-20"
                placeholder="Min"
                min="0"
                max="100"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={humidityMax}
                onChange={(e) => setHumidityMax(e.target.value)}
                className="input w-20"
                placeholder="Max"
                min="0"
                max="100"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          )}
        </div>

        {/* Wind Speed */}
        <div className="mb-4">
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={windEnabled}
              onChange={(e) => setWindEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Wind Speed Range</span>
          </label>
          {windEnabled && (
            <div className="flex items-center gap-2 ml-6">
              <input
                type="number"
                value={windSpeedMin}
                onChange={(e) => setWindSpeedMin(e.target.value)}
                className="input w-20"
                placeholder="Min"
                min="0"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={windSpeedMax}
                onChange={(e) => setWindSpeedMax(e.target.value)}
                className="input w-20"
                placeholder="Max"
                min="0"
              />
              <span className="text-sm text-gray-500">mph</span>
            </div>
          )}
        </div>

        {/* UV Index */}
        <div className="mb-4">
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={uvEnabled}
              onChange={(e) => setUvEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">UV Index Range</span>
          </label>
          {uvEnabled && (
            <div className="flex items-center gap-2 ml-6">
              <input
                type="number"
                value={uvMin}
                onChange={(e) => setUvMin(e.target.value)}
                className="input w-20"
                placeholder="Min"
                min="0"
                max="11"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={uvMax}
                onChange={(e) => setUvMax(e.target.value)}
                className="input w-20"
                placeholder="Max"
                min="0"
                max="11"
              />
            </div>
          )}
        </div>

        {/* Precipitation */}
        <div className="mb-4">
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={precipEnabled}
              onChange={(e) => setPrecipEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Precipitation</span>
          </label>
          {precipEnabled && (
            <div className="ml-6 space-y-3">
              <div>
                <p className="text-xs text-gray-600 mb-2">Types:</p>
                <div className="flex flex-wrap gap-2">
                  {PRECIPITATION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => togglePrecipType(type)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        precipTypes.includes(type)
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Probability:</span>
                <input
                  type="number"
                  value={precipProbMin}
                  onChange={(e) => setPrecipProbMin(e.target.value)}
                  className="input w-20"
                  placeholder="Min"
                  min="0"
                  max="100"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  value={precipProbMax}
                  onChange={(e) => setPrecipProbMax(e.target.value)}
                  className="input w-20"
                  placeholder="Max"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
          {saving ? 'Saving...' : rule ? 'Update Rule' : 'Add Rule'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}

function RuleCard({ rule, uniforms, onEdit, onDelete, onToggle, deleting }) {
  const uniform = uniforms.find((u) => u.id === rule.uniformId)

  function describeConditions(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) return 'Any conditions'

    const parts = []
    if (conditions.temperature) {
      const { min, max } = conditions.temperature
      if (min != null && max != null) parts.push(`${min}-${max}°F`)
      else if (min != null) parts.push(`>= ${min}°F`)
      else if (max != null) parts.push(`<= ${max}°F`)
    }
    if (conditions.humidity) {
      const { min, max } = conditions.humidity
      if (min != null && max != null) parts.push(`Humidity ${min}-${max}%`)
      else if (min != null) parts.push(`Humidity >= ${min}%`)
      else if (max != null) parts.push(`Humidity <= ${max}%`)
    }
    if (conditions.wind) {
      const { speedMin, speedMax } = conditions.wind
      if (speedMin != null && speedMax != null) parts.push(`Wind ${speedMin}-${speedMax} mph`)
      else if (speedMin != null) parts.push(`Wind >= ${speedMin} mph`)
      else if (speedMax != null) parts.push(`Wind <= ${speedMax} mph`)
    }
    if (conditions.precipitation?.types?.length > 0) {
      parts.push(conditions.precipitation.types.join(', '))
    }
    if (conditions.uvIndex) {
      const { min, max } = conditions.uvIndex
      if (min != null && max != null) parts.push(`UV ${min}-${max}`)
      else if (min != null) parts.push(`UV >= ${min}`)
      else if (max != null) parts.push(`UV <= ${max}`)
    }

    return parts.length > 0 ? parts.join(' | ') : 'Any conditions'
  }

  return (
    <div className={`card ${!rule.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-200 text-gray-700 text-xs font-bold rounded">
              {rule.priority}
            </span>
            <h4 className="font-medium text-gray-900">{rule.name}</h4>
            {!rule.enabled && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Disabled</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-1">
            Uniform: {uniform ? `#${uniform.number} - ${uniform.name}` : 'Unknown'}
          </p>
          <p className="text-xs text-gray-500">{describeConditions(rule.conditions)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(rule.id, !rule.enabled)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              rule.enabled
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => onEdit(rule)}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            disabled={deleting}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WeatherRulesManager() {
  const { rules, defaultUniformId, loading, error } = useWeatherRules()
  const { addRule, updateRule, deleteRule, setDefaultUniform, loading: saving } = useWeatherRulesActions()
  const { uniforms, loading: uniformsLoading } = useUniforms()

  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  async function handleSaveRule(ruleData) {
    setFormError(null)
    try {
      if (editingRule) {
        await updateRule(editingRule.id, ruleData)
      } else {
        await addRule(ruleData)
      }
      setShowForm(false)
      setEditingRule(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message)
    }
  }

  function handleEdit(rule) {
    setEditingRule(rule)
    setShowForm(true)
  }

  async function handleDelete(ruleId) {
    if (deleteConfirm === ruleId) {
      try {
        await deleteRule(ruleId)
        setDeleteConfirm(null)
      } catch (err) {
        console.error('Failed to delete rule:', err)
      }
    } else {
      setDeleteConfirm(ruleId)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  async function handleToggle(ruleId, enabled) {
    try {
      await updateRule(ruleId, { enabled })
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  async function handleDefaultUniformChange(uniformId) {
    try {
      await setDefaultUniform(uniformId || null)
    } catch (err) {
      console.error('Failed to set default uniform:', err)
    }
  }

  if (loading || uniformsLoading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Rule saved successfully!
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Error loading rules: {error}
        </div>
      )}

      {/* Default Uniform */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Default Uniform</h3>
        <p className="text-sm text-gray-600 mb-3">
          This uniform will be recommended when no rules match the current weather conditions.
        </p>
        <select
          value={defaultUniformId || ''}
          onChange={(e) => handleDefaultUniformChange(e.target.value)}
          className="input"
        >
          <option value="">No default (skip recommendation)</option>
          {uniforms.map((u) => (
            <option key={u.id} value={u.id}>
              #{u.number} - {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Add Rule Button / Form */}
      {showForm ? (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingRule ? 'Edit Rule' : 'Add New Rule'}
          </h3>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <RuleForm
            rule={editingRule}
            uniforms={uniforms}
            onSave={handleSaveRule}
            onCancel={() => {
              setShowForm(false)
              setEditingRule(null)
              setFormError(null)
            }}
            saving={saving}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary w-full"
        >
          Add Weather Rule
        </button>
      )}

      {/* Rules List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Weather Rules</h3>
        <p className="text-sm text-gray-600 mb-4">
          Rules are evaluated in priority order (lowest number first). The first matching rule determines the uniform recommendation.
        </p>

        {rules.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">No weather rules defined yet. Add your first rule above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...rules]
              .sort((a, b) => (a.priority || 0) - (b.priority || 0))
              .map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  uniforms={uniforms}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  deleting={deleteConfirm === rule.id}
                />
              ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="card bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">How Weather Rules Work</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Rules are checked in priority order (lowest number = highest priority)</li>
          <li>The first rule where ALL enabled conditions match will be selected</li>
          <li>If no rules match, the default uniform is recommended</li>
          <li>Disabled rules are skipped during evaluation</li>
        </ul>
      </div>
    </div>
  )
}
