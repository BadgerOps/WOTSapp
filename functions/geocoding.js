const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { geocodeZip, geocodeAddress } = require('./utils/openweather')

/**
 * Geocode a location (zip code or address) and save to Firestore
 * Callable by uniform_admin or admin users
 */
exports.geocodeLocation = onCall(async (request) => {
  const db = getFirestore()

  // Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  // Check authorization (uniform_admin or admin)
  const userDoc = await db.collection('users').doc(request.auth.uid).get()
  const userRole = userDoc.exists ? userDoc.data().role : 'user'

  if (userRole !== 'admin' && userRole !== 'uniform_admin') {
    throw new HttpsError(
      'permission-denied',
      'Must be admin or uniform_admin to manage weather location'
    )
  }

  const { inputType, zipcode, address, units = 'imperial' } = request.data

  if (!inputType || (inputType !== 'zipcode' && inputType !== 'address')) {
    throw new HttpsError(
      'invalid-argument',
      'inputType must be "zipcode" or "address"'
    )
  }

  if (inputType === 'zipcode' && !zipcode) {
    throw new HttpsError('invalid-argument', 'zipcode is required')
  }

  if (inputType === 'address' && !address) {
    throw new HttpsError('invalid-argument', 'address is required')
  }

  try {
    let coordinates
    if (inputType === 'zipcode') {
      coordinates = await geocodeZip(zipcode)
    } else {
      coordinates = await geocodeAddress(address)
    }

    // Save location to Firestore
    const locationData = {
      inputType,
      zipcode: inputType === 'zipcode' ? zipcode : null,
      address: inputType === 'address' ? address : null,
      coordinates: {
        lat: coordinates.lat,
        lon: coordinates.lon,
        resolvedAddress: coordinates.resolvedAddress,
        resolvedAt: FieldValue.serverTimestamp(),
      },
      units,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    }

    await db.doc('settings/weatherLocation').set(locationData)

    return {
      success: true,
      coordinates: {
        lat: coordinates.lat,
        lon: coordinates.lon,
        resolvedAddress: coordinates.resolvedAddress,
      },
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    throw new HttpsError('internal', error.message || 'Failed to geocode location')
  }
})

/**
 * Update weather location units (imperial/metric)
 */
exports.updateWeatherUnits = onCall(async (request) => {
  const db = getFirestore()

  // Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }

  // Check authorization
  const userDoc = await db.collection('users').doc(request.auth.uid).get()
  const userRole = userDoc.exists ? userDoc.data().role : 'user'

  if (userRole !== 'admin' && userRole !== 'uniform_admin') {
    throw new HttpsError(
      'permission-denied',
      'Must be admin or uniform_admin to manage weather settings'
    )
  }

  const { units } = request.data

  if (!units || (units !== 'imperial' && units !== 'metric')) {
    throw new HttpsError(
      'invalid-argument',
      'units must be "imperial" or "metric"'
    )
  }

  await db.doc('settings/weatherLocation').update({
    units,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  })

  return { success: true }
})
