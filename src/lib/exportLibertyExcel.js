import * as XLSX from 'xlsx'
import { getTimeSlotLabel, buildDestinationString } from '../hooks/useLibertyRequests'

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeString) {
  if (!timeString) return ''
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Build the Summary sheet data - one row per liberty request
 */
function buildSummarySheet(requests) {
  const headers = [
    'Name',
    'Status',
    'Weekend',
    'Destination',
    'Driver',
    'Seats',
    'Passengers',
    'Contact',
    'Purpose',
    'Time Slots',
    'Submitted',
    'Approved/Rejected By',
    'Notes',
  ]

  const rows = requests.map((r) => [
    r.requesterName || '',
    r.status || '',
    formatDate(r.weekendDate),
    r.destination || '',
    r.isDriver ? 'Yes' : 'No',
    r.isDriver ? (r.passengerCapacity || 0) : '',
    (r.passengers || []).map((p) => p.name).join(', '),
    r.contactNumber || '',
    r.purpose || '',
    (r.timeSlots || []).length,
    formatTimestamp(r.createdAt),
    r.approvedByName || r.rejectedByName || '',
    r.notes || '',
  ])

  return [headers, ...rows]
}

/**
 * Build the Time Slots sheet - one row per time slot per request
 */
function buildTimeSlotsSheet(requests) {
  const headers = [
    'Requester',
    'Status',
    'Slot',
    'Date',
    'Start',
    'End',
    'Locations',
    'Participants',
    'Participant Count',
  ]

  const rows = []
  for (const r of requests) {
    const slots = r.timeSlots || []
    if (slots.length === 0) {
      // Legacy single-window request - still show it
      rows.push([
        r.requesterName || '',
        r.status || '',
        '(legacy)',
        formatDate(r.departureDate),
        formatTime(r.departureTime),
        formatTime(r.returnTime),
        r.destination || '',
        (r.companions || []).map((c) => c.name).join(', '),
        (r.companions || []).length,
      ])
    } else {
      for (const slot of slots) {
        const participants = slot.participants || []
        rows.push([
          r.requesterName || '',
          r.status || '',
          getTimeSlotLabel(slot),
          formatDate(slot.date),
          formatTime(slot.startTime),
          formatTime(slot.endTime),
          buildDestinationString(slot.locations, r.customLocation || ''),
          participants.map((p) => p.name).join(', '),
          participants.length,
        ])
      }
    }
  }

  return [headers, ...rows]
}

/**
 * Build the Drivers & Rides sheet - one row per driver
 */
function buildDriversSheet(requests) {
  const headers = [
    'Driver',
    'Status',
    'Weekend',
    'Destination',
    'Vehicle Capacity',
    'Passengers',
    'Passenger Count',
    'Open Seats',
    'Contact',
  ]

  const rows = requests
    .filter((r) => r.isDriver)
    .map((r) => {
      const passengers = r.passengers || []
      const capacity = r.passengerCapacity || 0
      return [
        r.requesterName || '',
        r.status || '',
        formatDate(r.weekendDate),
        r.destination || '',
        capacity,
        passengers.map((p) => p.name).join(', '),
        passengers.length,
        Math.max(0, capacity - passengers.length),
        r.contactNumber || '',
      ]
    })

  return [headers, ...rows]
}

/**
 * Set column widths based on content
 */
function autoFitColumns(sheetData) {
  return sheetData[0].map((_, colIdx) => {
    const maxLen = sheetData.reduce((max, row) => {
      const cell = row[colIdx]
      const len = cell != null ? String(cell).length : 0
      return Math.max(max, len)
    }, 0)
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) }
  })
}

/**
 * Export liberty requests to a multi-sheet Excel workbook.
 *
 * Sheet 1 "Summary" - one row per request (the at-a-glance view)
 * Sheet 2 "Time Slots" - one row per slot per request (the schedule view)
 * Sheet 3 "Drivers & Rides" - one row per driver (the transportation view)
 *
 * @param {Array} requests - Array of liberty request objects
 * @param {Object} options
 * @param {string} [options.weekendDate] - Weekend filter value for filename
 * @param {string} [options.status] - Status filter value for filename
 */
export function exportLibertyExcel(requests, { weekendDate, status } = {}) {
  if (!requests || requests.length === 0) return

  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = buildSummarySheet(requests)
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  summaryWs['!cols'] = autoFitColumns(summaryData)
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Sheet 2: Time Slots
  const slotsData = buildTimeSlotsSheet(requests)
  const slotsWs = XLSX.utils.aoa_to_sheet(slotsData)
  slotsWs['!cols'] = autoFitColumns(slotsData)
  XLSX.utils.book_append_sheet(wb, slotsWs, 'Time Slots')

  // Sheet 3: Drivers & Rides
  const driversData = buildDriversSheet(requests)
  const driversWs = XLSX.utils.aoa_to_sheet(driversData)
  driversWs['!cols'] = autoFitColumns(driversData)
  XLSX.utils.book_append_sheet(wb, driversWs, 'Drivers & Rides')

  // Build filename
  const weekendLabel = weekendDate || new Date().toISOString().split('T')[0]
  const statusLabel = status ? `_${status}` : ''
  const filename = `liberty_requests_${weekendLabel}${statusLabel}.xlsx`

  XLSX.writeFile(wb, filename)
}
