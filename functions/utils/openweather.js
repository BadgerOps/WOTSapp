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

module.exports = {
  getCurrentWeather,
  getForecast,
  getUVIndex,
  geocodeZip,
  geocodeAddress,
  getWeatherData,
}
