const { defineString } = require('firebase-functions/params')

// API key from environment
const apiKey = defineString('WEATHER_API')

const BASE_URL = 'https://api.weatherapi.com/v1'

/**
 * Fetch current weather and forecast for given coordinates
 * WeatherAPI.com provides both in a single call
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} units - 'imperial' or 'metric' (unused - we fetch both)
 * @returns {Promise<Object>} Current weather and forecast data
 */
async function getWeatherData(lat, lon, units = 'imperial') {
  const url = `${BASE_URL}/forecast.json?key=${apiKey.value()}&q=${lat},${lon}&days=1&aqi=no`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WeatherAPI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const current = data.current
  const forecast = data.forecast.forecastday[0]
  const isImperial = units === 'imperial'

  // Extract current weather
  const currentWeather = {
    temperature: isImperial ? current.temp_f : current.temp_c,
    feelsLike: isImperial ? current.feelslike_f : current.feelslike_c,
    humidity: current.humidity,
    windSpeed: isImperial ? current.wind_mph : current.wind_kph,
    weatherCode: current.condition.code,
    weatherMain: current.condition.text,
    weatherDescription: current.condition.text,
    precipitation: isImperial ? current.precip_in : current.precip_mm,
    uvIndex: current.uv,
  }

  // Extract astronomy data (sunrise/sunset for twilight detection)
  const astro = forecast.astro || {}
  const astronomyData = {
    sunrise: astro.sunrise, // Format: "06:45 AM"
    sunset: astro.sunset,   // Format: "07:30 PM"
    moonPhase: astro.moon_phase,
    moonIllumination: astro.moon_illumination,
  }

  // Extract forecast data
  const forecastData = {
    tempHigh: isImperial ? forecast.day.maxtemp_f : forecast.day.maxtemp_c,
    tempLow: isImperial ? forecast.day.mintemp_f : forecast.day.mintemp_c,
    precipitationChance: Math.max(
      forecast.day.daily_chance_of_rain || 0,
      forecast.day.daily_chance_of_snow || 0
    ),
    uvIndexMax: forecast.day.uv,
    hourly: forecast.hour.map((hour) => ({
      time: hour.time,
      temp: isImperial ? hour.temp_f : hour.temp_c,
      humidity: hour.humidity,
      windSpeed: isImperial ? hour.wind_mph : hour.wind_kph,
      weatherMain: hour.condition.text,
      chanceOfRain: hour.chance_of_rain,
      chanceOfSnow: hour.chance_of_snow,
    })),
  }

  return {
    current: currentWeather,
    forecast: forecastData,
    astronomy: astronomyData,
    location: {
      lat,
      lon,
      name: data.location.name,
      region: data.location.region,
    },
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min cache
  }
}

/**
 * Fetch current weather data for given coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} units - 'imperial' or 'metric'
 * @returns {Promise<Object>} Current weather data
 */
async function getCurrentWeather(lat, lon, units = 'imperial') {
  const url = `${BASE_URL}/current.json?key=${apiKey.value()}&q=${lat},${lon}&aqi=no`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WeatherAPI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const current = data.current
  const isImperial = units === 'imperial'

  return {
    temperature: isImperial ? current.temp_f : current.temp_c,
    feelsLike: isImperial ? current.feelslike_f : current.feelslike_c,
    humidity: current.humidity,
    windSpeed: isImperial ? current.wind_mph : current.wind_kph,
    weatherCode: current.condition.code,
    weatherMain: current.condition.text,
    weatherDescription: current.condition.text,
    precipitation: isImperial ? current.precip_in : current.precip_mm,
    uvIndex: current.uv,
  }
}

/**
 * Fetch weather forecast for given coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} units - 'imperial' or 'metric'
 * @returns {Promise<Object>} Forecast data
 */
async function getForecast(lat, lon, units = 'imperial') {
  const url = `${BASE_URL}/forecast.json?key=${apiKey.value()}&q=${lat},${lon}&days=1&aqi=no`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WeatherAPI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const forecast = data.forecast.forecastday[0]
  const isImperial = units === 'imperial'

  return {
    tempHigh: isImperial ? forecast.day.maxtemp_f : forecast.day.maxtemp_c,
    tempLow: isImperial ? forecast.day.mintemp_f : forecast.day.mintemp_c,
    precipitationChance: Math.max(
      forecast.day.daily_chance_of_rain || 0,
      forecast.day.daily_chance_of_snow || 0
    ),
    uvIndexMax: forecast.day.uv,
    hourly: forecast.hour.map((hour) => ({
      time: hour.time,
      temp: isImperial ? hour.temp_f : hour.temp_c,
      humidity: hour.humidity,
      windSpeed: isImperial ? hour.wind_mph : hour.wind_kph,
      weatherMain: hour.condition.text,
      chanceOfRain: hour.chance_of_rain,
      chanceOfSnow: hour.chance_of_snow,
    })),
  }
}

/**
 * Geocode a zip code to coordinates using WeatherAPI search
 * @param {string} zipCode - Zip code (US format)
 * @param {string} countryCode - Country code (default: US)
 * @returns {Promise<Object>} Location with lat, lon, and resolved address
 */
async function geocodeZip(zipCode, countryCode = 'US') {
  // WeatherAPI accepts zip codes directly in the search
  const query = countryCode === 'US' ? zipCode : `${zipCode},${countryCode}`
  const url = `${BASE_URL}/search.json?key=${apiKey.value()}&q=${encodeURIComponent(query)}`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Geocoding error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  if (!data || data.length === 0) {
    throw new Error(`No results found for zip code: ${zipCode}`)
  }

  const result = data[0]
  const parts = [result.name]
  if (result.region) parts.push(result.region)
  if (result.country) parts.push(result.country)

  return {
    lat: result.lat,
    lon: result.lon,
    resolvedAddress: parts.join(', '),
  }
}

/**
 * Geocode an address to coordinates using WeatherAPI search
 * @param {string} address - Address or location name
 * @returns {Promise<Object>} Location with lat, lon, and resolved address
 */
async function geocodeAddress(address) {
  const url = `${BASE_URL}/search.json?key=${apiKey.value()}&q=${encodeURIComponent(address)}`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Geocoding error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  if (!data || data.length === 0) {
    throw new Error(`No results found for address: ${address}`)
  }

  const result = data[0]
  const parts = [result.name]
  if (result.region) parts.push(result.region)
  if (result.country) parts.push(result.country)

  return {
    lat: result.lat,
    lon: result.lon,
    resolvedAddress: parts.join(', '),
  }
}

/**
 * Get UV index (included in current weather for WeatherAPI)
 * Kept for API compatibility
 */
async function getUVIndex(lat, lon) {
  const current = await getCurrentWeather(lat, lon)
  return current.uvIndex
}

/**
 * Parse time string (e.g., "06:45 AM") to Date object for today
 * @param {string} timeStr - Time string in format "HH:MM AM/PM"
 * @param {Date} referenceDate - Reference date to use
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseTimeToDate(timeStr, referenceDate = new Date()) {
  if (!timeStr) return null

  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const isPM = match[3].toUpperCase() === 'PM'

  if (isPM && hours !== 12) hours += 12
  if (!isPM && hours === 12) hours = 0

  const result = new Date(referenceDate)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Check if a given time is during twilight hours
 * Twilight = 30 minutes before sunset to 30 minutes after sunrise
 * @param {Object} astronomy - Astronomy data with sunrise/sunset
 * @param {Date} checkTime - Time to check (default: now)
 * @param {number} twilightMinutes - Minutes to extend twilight (default: 30)
 * @returns {Object} Twilight status with details
 */
function getTwilightStatus(astronomy, checkTime = new Date(), twilightMinutes = 30) {
  if (!astronomy?.sunrise || !astronomy?.sunset) {
    return { isTwilight: false, reason: 'No astronomy data available' }
  }

  const sunrise = parseTimeToDate(astronomy.sunrise, checkTime)
  const sunset = parseTimeToDate(astronomy.sunset, checkTime)

  if (!sunrise || !sunset) {
    return { isTwilight: false, reason: 'Could not parse sunrise/sunset times' }
  }

  const twilightMs = twilightMinutes * 60 * 1000
  const currentMs = checkTime.getTime()

  // Morning twilight: 30 min before sunrise to 30 min after sunrise
  const morningTwilightStart = sunrise.getTime() - twilightMs
  const morningTwilightEnd = sunrise.getTime() + twilightMs

  // Evening twilight: 30 min before sunset to 30 min after sunset
  const eveningTwilightStart = sunset.getTime() - twilightMs
  const eveningTwilightEnd = sunset.getTime() + twilightMs

  const inMorningTwilight =
    currentMs >= morningTwilightStart && currentMs <= morningTwilightEnd
  const inEveningTwilight =
    currentMs >= eveningTwilightStart && currentMs <= eveningTwilightEnd

  // Also check for nighttime (after evening twilight ends, before morning twilight starts)
  const isNighttime =
    currentMs > eveningTwilightEnd || currentMs < morningTwilightStart

  return {
    isTwilight: inMorningTwilight || inEveningTwilight,
    isNighttime,
    inMorningTwilight,
    inEveningTwilight,
    sunrise: astronomy.sunrise,
    sunset: astronomy.sunset,
    sunriseTime: sunrise.toISOString(),
    sunsetTime: sunset.toISOString(),
  }
}

/**
 * Extract forecast data for a specific time window ahead
 * Used for UOTD recommendations to get weather for when students will actually be outside
 * @param {Array} hourlyData - Array of hourly forecast data from getWeatherData().forecast.hourly
 * @param {number} minutesAheadStart - Start of window in minutes (default: 30)
 * @param {number} minutesAheadEnd - End of window in minutes (default: 90)
 * @returns {Object} Aggregated weather data for the time window
 */
function getForecastForTimeWindow(
  hourlyData,
  minutesAheadStart = 30,
  minutesAheadEnd = 90
) {
  if (!hourlyData || hourlyData.length === 0) {
    return null
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() + minutesAheadStart * 60 * 1000)
  const windowEnd = new Date(now.getTime() + minutesAheadEnd * 60 * 1000)

  // Find hours that fall within our window
  // Hourly data times are in format "YYYY-MM-DD HH:00"
  const relevantHours = hourlyData.filter((hour) => {
    const hourTime = new Date(hour.time)
    // Include hour if it overlaps with our window at all
    const hourEnd = new Date(hourTime.getTime() + 60 * 60 * 1000)
    return hourTime < windowEnd && hourEnd > windowStart
  })

  if (relevantHours.length === 0) {
    // If no matching hours, use the next available hour
    const nextHour = hourlyData.find((hour) => new Date(hour.time) > now)
    if (nextHour) {
      return {
        temperature: nextHour.temp,
        humidity: nextHour.humidity,
        windSpeed: nextHour.windSpeed,
        weatherMain: nextHour.weatherMain,
        precipitationChance: Math.max(
          nextHour.chanceOfRain || 0,
          nextHour.chanceOfSnow || 0
        ),
        forecastTime: nextHour.time,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        hoursUsed: 1,
      }
    }
    return null
  }

  // Aggregate data from relevant hours
  // For temperature: use average (what they'll experience)
  // For humidity: use average
  // For wind: use maximum (worst case)
  // For precipitation chance: use maximum (worst case)
  // For weather condition: use the most severe or most common
  const temps = relevantHours.map((h) => h.temp)
  const humidities = relevantHours.map((h) => h.humidity)
  const winds = relevantHours.map((h) => h.windSpeed)
  const precipChances = relevantHours.map((h) =>
    Math.max(h.chanceOfRain || 0, h.chanceOfSnow || 0)
  )

  // For weather condition, prioritize precipitation conditions
  const precipConditions = ['rain', 'snow', 'sleet', 'drizzle', 'storm', 'thunder']
  const conditions = relevantHours.map((h) => h.weatherMain)
  const hasPrecip = conditions.find((c) =>
    precipConditions.some((p) => c.toLowerCase().includes(p))
  )
  const weatherMain = hasPrecip || conditions[0]

  return {
    temperature: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
    humidity: Math.round(
      humidities.reduce((a, b) => a + b, 0) / humidities.length
    ),
    windSpeed: Math.round(Math.max(...winds)),
    weatherMain,
    precipitationChance: Math.max(...precipChances),
    forecastTime: relevantHours[0].time,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    hoursUsed: relevantHours.length,
  }
}

module.exports = {
  getCurrentWeather,
  getForecast,
  getUVIndex,
  geocodeZip,
  geocodeAddress,
  getWeatherData,
  getForecastForTimeWindow,
  getTwilightStatus,
  parseTimeToDate,
}
