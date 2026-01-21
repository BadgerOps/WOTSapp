/**
 * Weather Rule Evaluator
 * Matches current weather conditions against configured rules
 */

/**
 * Check if a value is within a range (inclusive)
 * @param {number} value - The value to check
 * @param {Object} range - Object with min and/or max properties
 * @returns {boolean} True if value is within range
 */
function isInRange(value, range) {
  if (!range) return true
  if (value === null || value === undefined) return true // Skip check if no data

  const { min, max } = range
  if (min !== undefined && min !== null && value < min) return false
  if (max !== undefined && max !== null && value > max) return false
  return true
}

/**
 * Check if weather matches precipitation conditions
 * @param {Object} weather - Weather data
 * @param {Object} precip - Precipitation conditions
 * @returns {boolean} True if conditions match
 */
function matchesPrecipitation(weather, precip) {
  if (!precip) return true

  const { types, probability } = precip

  // Check precipitation types (rain, snow, etc.)
  if (types && types.length > 0) {
    const weatherMain = (weather.weatherMain || '').toLowerCase()
    const matchesType = types.some(
      (type) =>
        weatherMain.includes(type.toLowerCase()) ||
        (type.toLowerCase() === 'rain' && weatherMain === 'drizzle') ||
        (type.toLowerCase() === 'snow' && weatherMain === 'sleet')
    )
    // If types are specified but don't match, rule doesn't apply
    if (!matchesType && weather.precipitationChance < 30) {
      return false
    }
  }

  // Check precipitation probability
  if (probability) {
    const chance = weather.precipitationChance || 0
    if (!isInRange(chance, probability)) return false
  }

  return true
}

/**
 * Evaluate a single rule against weather conditions
 * @param {Object} rule - Weather rule
 * @param {Object} weather - Current weather data
 * @returns {boolean} True if weather matches all rule conditions
 */
function evaluateRule(rule, weather) {
  if (!rule.enabled) return false

  const { conditions } = rule
  if (!conditions) return true // No conditions = always match

  // Check temperature range
  if (conditions.temperature) {
    if (!isInRange(weather.temperature, conditions.temperature)) {
      return false
    }
  }

  // Check humidity range
  if (conditions.humidity) {
    if (!isInRange(weather.humidity, conditions.humidity)) {
      return false
    }
  }

  // Check wind speed range
  if (conditions.wind) {
    const windRange = {
      min: conditions.wind.speedMin,
      max: conditions.wind.speedMax,
    }
    if (!isInRange(weather.windSpeed, windRange)) {
      return false
    }
  }

  // Check UV index range
  if (conditions.uvIndex && weather.uvIndex !== null) {
    if (!isInRange(weather.uvIndex, conditions.uvIndex)) {
      return false
    }
  }

  // Check precipitation
  if (conditions.precipitation) {
    if (!matchesPrecipitation(weather, conditions.precipitation)) {
      return false
    }
  }

  return true
}

/**
 * Find the best matching rule for current weather conditions
 * Rules are evaluated in priority order (lower number = higher priority)
 * @param {Array} rules - Array of weather rules
 * @param {Object} weather - Current weather data with forecast
 * @returns {Object|null} The matched rule or null if none match
 */
function findMatchingRule(rules, weather) {
  if (!rules || rules.length === 0) return null

  // Prepare weather data for evaluation
  const weatherData = {
    temperature: weather.current?.temperature ?? weather.temperature,
    humidity: weather.current?.humidity ?? weather.humidity,
    windSpeed: weather.current?.windSpeed ?? weather.windSpeed,
    uvIndex: weather.current?.uvIndex ?? weather.uvIndex,
    weatherMain: weather.current?.weatherMain ?? weather.weatherMain,
    precipitationChance: weather.forecast?.precipitationChance ?? 0,
  }

  // Sort rules by priority (lower = higher priority)
  const sortedRules = [...rules].sort((a, b) => (a.priority || 0) - (b.priority || 0))

  // Find first matching rule
  for (const rule of sortedRules) {
    if (evaluateRule(rule, weatherData)) {
      return rule
    }
  }

  return null
}

/**
 * Get a human-readable description of rule conditions
 * @param {Object} conditions - Rule conditions
 * @param {string} units - 'imperial' or 'metric'
 * @returns {string} Description of conditions
 */
function describeConditions(conditions, units = 'imperial') {
  if (!conditions) return 'Any conditions'

  const parts = []
  const tempUnit = units === 'metric' ? 'C' : 'F'
  const speedUnit = units === 'metric' ? 'km/h' : 'mph'

  if (conditions.temperature) {
    const { min, max } = conditions.temperature
    if (min !== undefined && max !== undefined) {
      parts.push(`Temp ${min}-${max}${tempUnit}`)
    } else if (min !== undefined) {
      parts.push(`Temp >= ${min}${tempUnit}`)
    } else if (max !== undefined) {
      parts.push(`Temp <= ${max}${tempUnit}`)
    }
  }

  if (conditions.humidity) {
    const { min, max } = conditions.humidity
    if (min !== undefined && max !== undefined) {
      parts.push(`Humidity ${min}-${max}%`)
    } else if (min !== undefined) {
      parts.push(`Humidity >= ${min}%`)
    } else if (max !== undefined) {
      parts.push(`Humidity <= ${max}%`)
    }
  }

  if (conditions.wind) {
    const { speedMin, speedMax } = conditions.wind
    if (speedMin !== undefined && speedMax !== undefined) {
      parts.push(`Wind ${speedMin}-${speedMax} ${speedUnit}`)
    } else if (speedMin !== undefined) {
      parts.push(`Wind >= ${speedMin} ${speedUnit}`)
    } else if (speedMax !== undefined) {
      parts.push(`Wind <= ${speedMax} ${speedUnit}`)
    }
  }

  if (conditions.precipitation?.types?.length > 0) {
    parts.push(`Precip: ${conditions.precipitation.types.join(', ')}`)
  }

  if (conditions.uvIndex) {
    const { min, max } = conditions.uvIndex
    if (min !== undefined && max !== undefined) {
      parts.push(`UV ${min}-${max}`)
    } else if (min !== undefined) {
      parts.push(`UV >= ${min}`)
    } else if (max !== undefined) {
      parts.push(`UV <= ${max}`)
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'Any conditions'
}

module.exports = {
  evaluateRule,
  findMatchingRule,
  describeConditions,
  isInRange,
}
