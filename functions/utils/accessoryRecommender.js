/**
 * Smart Accessory Recommendation Engine
 *
 * Recommends uniform accessories and overrides based on weather conditions.
 * Rules are configurable and stored in Firestore settings/accessoryRules.
 */

const { getTwilightStatus } = require('./openweather')

/**
 * Default accessory rules - used when no custom rules are configured
 * Rules are evaluated in priority order (lower number = higher priority)
 */
const DEFAULT_ACCESSORY_RULES = [
  {
    id: 'rain-storm-override',
    name: 'Rain/Storm Weather',
    description: 'Wet weather gear for rain/storm conditions',
    enabled: true,
    priority: 1,
    type: 'uniformOverride',
    conditions: {
      weather: {
        types: ['rain', 'storm', 'thunder', 'drizzle', 'shower'],
        precipitationChance: { min: 50 },
      },
    },
    uniformOverride: {
      name: 'Wet Weather Gear',
      description: 'OCP, ECWS, Water source',
      items: ['OCP', 'ECWS', 'Water source'],
    },
  },
  {
    id: 'extreme-cold',
    name: 'Extreme Cold Weather (Below 40°F)',
    description: 'Fleece jacket and watch cap for very cold conditions',
    enabled: true,
    priority: 2,
    type: 'addAccessories',
    conditions: {
      temperature: { max: 40 },
    },
    accessories: [
      { name: 'Fleece Jacket', required: true },
      { name: 'Watch Cap', required: true },
    ],
  },
  {
    id: 'moderate-cold',
    name: 'Moderate Cold Weather (40-45°F)',
    description: 'Fleece jacket and patrol cap for cool conditions',
    enabled: true,
    priority: 3,
    type: 'addAccessories',
    conditions: {
      temperature: { min: 40, max: 45 },
    },
    accessories: [
      { name: 'Fleece Jacket', required: true },
      { name: 'Patrol Cap', required: true },
    ],
  },
  {
    id: 'twilight-safety',
    name: 'Twilight/Low-Light Safety',
    description: 'Reflective belt and light source during twilight hours',
    enabled: true,
    priority: 10, // Lower priority - adds to other rules
    type: 'addAccessories',
    conditions: {
      twilight: true,
    },
    accessories: [
      { name: 'Reflective Belt', required: true, reason: 'auto-added based on twilight calculation' },
      { name: 'Light Source', required: true, reason: 'auto-added based on twilight calculation' },
    ],
  },
  {
    id: 'nighttime-safety',
    name: 'Nighttime Safety',
    description: 'Reflective belt and light source during nighttime hours',
    enabled: true,
    priority: 10,
    type: 'addAccessories',
    conditions: {
      nighttime: true,
    },
    accessories: [
      { name: 'Reflective Belt', required: true, reason: 'auto-added based on nighttime calculation' },
      { name: 'Light Source', required: true, reason: 'auto-added based on nighttime calculation' },
    ],
  },
  {
    id: 'high-wind',
    name: 'High Wind Conditions',
    description: 'Secure headgear in high winds',
    enabled: true,
    priority: 5,
    type: 'addAccessories',
    conditions: {
      wind: { min: 20 },
    },
    accessories: [
      { name: 'Patrol Cap (secured)', required: false, note: 'Secure headgear against wind' },
    ],
    notes: 'Consider securing headgear or wearing watch cap',
  },
]

/**
 * Check if weather matches a condition
 * @param {Object} weather - Weather data (current or forecast)
 * @param {Object} condition - Condition to check
 * @returns {boolean} True if condition is met
 */
function matchesCondition(weather, condition) {
  // Temperature condition
  if (condition.temperature) {
    const temp = weather.temperature
    if (condition.temperature.min !== undefined && temp < condition.temperature.min) {
      return false
    }
    if (condition.temperature.max !== undefined && temp > condition.temperature.max) {
      return false
    }
  }

  // Weather type condition
  if (condition.weather) {
    const weatherMain = (weather.weatherMain || '').toLowerCase()
    const precipChance = weather.precipitationChance || 0

    // Check precipitation chance threshold
    if (condition.weather.precipitationChance) {
      if (
        condition.weather.precipitationChance.min !== undefined &&
        precipChance < condition.weather.precipitationChance.min
      ) {
        return false
      }
    }

    // Check weather types
    if (condition.weather.types && condition.weather.types.length > 0) {
      const matchesType = condition.weather.types.some((type) =>
        weatherMain.includes(type.toLowerCase())
      )
      // If types specified but don't match and precip chance is low, skip
      if (!matchesType && precipChance < 50) {
        return false
      }
    }
  }

  // Wind condition
  if (condition.wind) {
    const windSpeed = weather.windSpeed || 0
    if (condition.wind.min !== undefined && windSpeed < condition.wind.min) {
      return false
    }
    if (condition.wind.max !== undefined && windSpeed > condition.wind.max) {
      return false
    }
  }

  // Humidity condition
  if (condition.humidity) {
    const humidity = weather.humidity || 0
    if (condition.humidity.min !== undefined && humidity < condition.humidity.min) {
      return false
    }
    if (condition.humidity.max !== undefined && humidity > condition.humidity.max) {
      return false
    }
  }

  return true
}

/**
 * Evaluate all accessory rules against weather conditions
 * @param {Object} weather - Weather data (should include both current and forecast)
 * @param {Object} twilightStatus - Twilight status from getTwilightStatus()
 * @param {Array} rules - Array of accessory rules (uses defaults if not provided)
 * @returns {Object} Recommendation result with accessories and optional uniform override
 */
function evaluateAccessoryRules(weather, twilightStatus, rules = null) {
  const activeRules = rules || DEFAULT_ACCESSORY_RULES
  const enabledRules = activeRules.filter((r) => r.enabled)

  // Sort by priority (lower number = higher priority)
  const sortedRules = [...enabledRules].sort((a, b) => (a.priority || 99) - (b.priority || 99))

  const matchedRules = []
  const accessories = []
  let uniformOverride = null

  for (const rule of sortedRules) {
    const conditions = rule.conditions || {}
    let conditionsMet = true

    // Check twilight condition
    if (conditions.twilight !== undefined) {
      if (conditions.twilight && !twilightStatus?.isTwilight) {
        conditionsMet = false
      }
    }

    // Check nighttime condition
    if (conditions.nighttime !== undefined) {
      if (conditions.nighttime && !twilightStatus?.isNighttime) {
        conditionsMet = false
      }
    }

    // Check weather conditions
    if (conditionsMet && Object.keys(conditions).some((k) => !['twilight', 'nighttime'].includes(k))) {
      conditionsMet = matchesCondition(weather, conditions)
    }

    if (conditionsMet) {
      matchedRules.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        type: rule.type,
      })

      // Handle uniform override (highest priority wins)
      if (rule.type === 'uniformOverride' && !uniformOverride) {
        uniformOverride = {
          ...rule.uniformOverride,
          ruleId: rule.id,
          ruleName: rule.name,
        }
      }

      // Collect accessories
      if (rule.accessories && rule.accessories.length > 0) {
        for (const accessory of rule.accessories) {
          // Don't add duplicates
          if (!accessories.find((a) => a.name === accessory.name)) {
            accessories.push({
              ...accessory,
              fromRule: rule.id,
              fromRuleName: rule.name,
            })
          }
        }
      }
    }
  }

  return {
    matchedRules,
    accessories,
    uniformOverride,
    hasRecommendations: accessories.length > 0 || uniformOverride !== null,
    twilightStatus: twilightStatus
      ? {
          isTwilight: twilightStatus.isTwilight,
          isNighttime: twilightStatus.isNighttime,
          sunrise: twilightStatus.sunrise,
          sunset: twilightStatus.sunset,
        }
      : null,
  }
}

/**
 * Get accessory rules from Firestore or return defaults
 * @param {Object} db - Firestore database instance
 * @returns {Promise<Array>} Array of accessory rules
 */
async function getAccessoryRules(db) {
  try {
    const rulesDoc = await db.doc('settings/accessoryRules').get()
    if (rulesDoc.exists) {
      const data = rulesDoc.data()
      if (data.rules && Array.isArray(data.rules) && data.rules.length > 0) {
        return data.rules
      }
    }
  } catch (error) {
    console.error('Error fetching accessory rules:', error)
  }
  return DEFAULT_ACCESSORY_RULES
}

/**
 * Initialize default accessory rules in Firestore
 * @param {Object} db - Firestore database instance
 * @returns {Promise<void>}
 */
async function initializeDefaultRules(db) {
  const rulesDoc = await db.doc('settings/accessoryRules').get()
  if (!rulesDoc.exists) {
    await db.doc('settings/accessoryRules').set({
      rules: DEFAULT_ACCESSORY_RULES,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    console.log('Initialized default accessory rules')
  }
}

/**
 * Format accessory recommendation for display
 * @param {Object} recommendation - Result from evaluateAccessoryRules
 * @returns {string} Human-readable recommendation string
 */
function formatRecommendation(recommendation) {
  const parts = []

  if (recommendation.uniformOverride) {
    parts.push(`Uniform: ${recommendation.uniformOverride.name}`)
    if (recommendation.uniformOverride.description) {
      parts.push(`(${recommendation.uniformOverride.description})`)
    }
  }

  if (recommendation.accessories.length > 0) {
    const required = recommendation.accessories
      .filter((a) => a.required)
      .map((a) => a.name)
    const optional = recommendation.accessories
      .filter((a) => !a.required)
      .map((a) => a.name)

    if (required.length > 0) {
      parts.push(`Required: ${required.join(', ')}`)
    }
    if (optional.length > 0) {
      parts.push(`Recommended: ${optional.join(', ')}`)
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'No additional accessories recommended'
}

module.exports = {
  DEFAULT_ACCESSORY_RULES,
  evaluateAccessoryRules,
  getAccessoryRules,
  initializeDefaultRules,
  formatRecommendation,
  matchesCondition,
}
