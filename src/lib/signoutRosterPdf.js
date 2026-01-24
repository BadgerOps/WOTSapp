import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Format date as DDMMMYY (military style)
 * @param {Date|string} date
 * @returns {string}
 */
function formatMilitaryDate(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const month = months[d.getMonth()]
  const year = d.getFullYear().toString().slice(-2)
  return `${day}${month}${year}`
}

/**
 * Format time as HHMM (military 24hr)
 * @param {Date|string} date
 * @returns {string}
 */
function formatMilitaryTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${hours}${minutes}`
}

/**
 * Get initials from first and last name (First Initial + Last Initial)
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string} e.g., "JS" for John Smith
 */
function getInitials(firstName, lastName) {
  const first = firstName?.trim().charAt(0).toUpperCase() || ''
  const last = lastName?.trim().charAt(0).toUpperCase() || ''
  return `${first}${last}`
}

/**
 * Calculate week of training from a start date
 * @param {Date} eventDate - The date of the event
 * @param {Date|string} trainingStartDate - When training started
 * @returns {string} Week number (e.g., "1", "2", etc.)
 */
function calculateWeekOfTraining(eventDate, trainingStartDate) {
  if (!trainingStartDate) return ''
  const start = trainingStartDate instanceof Date ? trainingStartDate : new Date(trainingStartDate)
  const event = eventDate instanceof Date ? eventDate : new Date(eventDate)

  // Calculate difference in days, then convert to weeks (round up)
  const diffTime = event.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1

  // Return empty if before training started
  if (weekNumber < 1) return ''
  return weekNumber.toString()
}

/**
 * Generate a PDF signout roster matching military format
 * @param {Array} entries - Audit log entries (sign-out events)
 * @param {Object} options - Configuration options
 * @param {string} options.startDate - Start date for the report
 * @param {string} options.endDate - End date for the report
 * @param {Object} options.personnelData - Map of personnelId to personnel record (for room/flight info)
 * @param {string|Date} options.trainingStartDate - When training started (for calculating week of training)
 */
export function generateSignoutRosterPdf(entries, options = {}) {
  const { startDate, endDate, personnelData = {}, trainingStartDate } = options

  // Filter to only sign-out events (one row per trip)
  // Only include entries where action is 'sign_out' - this represents the start of a trip
  const signOutEntries = entries.filter(entry => entry.action === 'sign_out')

  // Create PDF in landscape for more columns
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  })

  // Title
  const dateRange = startDate === endDate
    ? formatMilitaryDate(new Date(startDate))
    : `${formatMilitaryDate(new Date(startDate))} - ${formatMilitaryDate(new Date(endDate))}`

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SIGN OUT ROSTER', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date: ${dateRange}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' })

  // Define columns matching the military form
  const columns = [
    { header: 'DDMMMYY', dataKey: 'date' },
    { header: 'Last, First\n(Must be printed legibly)', dataKey: 'name' },
    { header: 'Room #', dataKey: 'room' },
    { header: 'Flight', dataKey: 'flight' },
    { header: 'Week of\nTraining', dataKey: 'weekOfTraining' },
    { header: 'Campus (PCC, DFAC, TRACK, etc.)\nBase (BX, Bowling Alley, etc.) Off-Base\n(Name, city, address) TYPE SPECIFIC\nPLAN.', dataKey: 'destination' },
    { header: 'Write the number CQ\ncan reach you at\nwhile you are out.', dataKey: 'contactNumber' },
    { header: 'Time Out', dataKey: 'timeOut' },
    { header: 'Estimated\nTime of\nReturn', dataKey: 'expectedReturn' },
    { header: 'Initials', dataKey: 'initials' },
    { header: 'Actual Time\nIn', dataKey: 'actualTimeIn' },
    { header: 'CQ Initials', dataKey: 'cqInitials' }
  ]

  // Helper to look up personnel info by personnelId
  function getPersonnelInfo(personnelId) {
    if (!personnelId) return {}
    // personnelData is keyed by both personnel doc id and userId
    return personnelData[personnelId] || {}
  }

  // Transform entries to table rows (one row per sign-out trip)
  const rows = signOutEntries.map(entry => {
    const personnelInfo = getPersonnelInfo(entry.personnelId)
    const timestamp = entry.timestamp instanceof Date ? entry.timestamp : entry.timestamp?.toDate?.() || new Date()

    // Find matching sign-in entry for this person after this sign-out
    const signInEntry = entries.find(e =>
      e.personnelId === entry.personnelId &&
      (e.action === 'sign_in' || e.action === 'arrived_barracks') &&
      e.timestamp && entry.timestamp &&
      (() => {
        const eTime = e.timestamp instanceof Date ? e.timestamp : e.timestamp?.toDate?.()
        return eTime && eTime > timestamp
      })()
    )

    const actualTimeIn = signInEntry?.timestamp instanceof Date
      ? signInEntry.timestamp
      : signInEntry?.timestamp?.toDate?.()

    // Format name as "Last, First" - use personnel record if available
    let formattedName = ''
    let firstName = ''
    let lastName = ''

    if (personnelInfo.lastName && personnelInfo.firstName) {
      firstName = personnelInfo.firstName
      lastName = personnelInfo.lastName
      formattedName = `${lastName}, ${firstName}`
    } else if (entry.personnelName) {
      const nameParts = entry.personnelName.split(' ')
      if (nameParts.length >= 2) {
        firstName = nameParts.slice(0, -1).join(' ')
        lastName = nameParts[nameParts.length - 1]
        formattedName = `${lastName}, ${firstName}`
      } else {
        formattedName = entry.personnelName
        firstName = entry.personnelName
      }
    }

    // Calculate initials (first initial + last initial)
    const initials = getInitials(firstName, lastName)

    // Calculate week of training from trainingStartDate config
    const weekOfTraining = calculateWeekOfTraining(timestamp, trainingStartDate)

    return {
      date: formatMilitaryDate(timestamp),
      name: formattedName,
      room: personnelInfo.roomNumber || personnelInfo.room || '',
      flight: personnelInfo.flight || '',
      weekOfTraining,
      destination: entry.destination || '',
      contactNumber: entry.contactNumber || '',
      timeOut: formatMilitaryTime(entry.timeOut ? new Date(entry.timeOut) : timestamp),
      expectedReturn: entry.expectedReturn ? formatMilitaryTime(new Date(entry.expectedReturn)) : '',
      initials,
      actualTimeIn: actualTimeIn ? formatMilitaryTime(actualTimeIn) : '',
      cqInitials: '' // TODO: figure out later
    }
  })

  // Add empty rows to fill the page (like the original form)
  const minRows = 25
  while (rows.length < minRows) {
    rows.push({
      date: '',
      name: '',
      room: '',
      flight: '',
      weekOfTraining: '',
      destination: '',
      contactNumber: '',
      timeOut: '',
      expectedReturn: '',
      initials: '',
      actualTimeIn: '',
      cqInitials: ''
    })
  }

  // Generate table
  autoTable(doc, {
    columns,
    body: rows,
    startY: 28,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      fontSize: 6,
      halign: 'center',
      valign: 'middle',
      cellPadding: 1
    },
    columnStyles: {
      date: { cellWidth: 18, halign: 'center' },
      name: { cellWidth: 35 },
      room: { cellWidth: 15, halign: 'center' },
      flight: { cellWidth: 15, halign: 'center' },
      weekOfTraining: { cellWidth: 15, halign: 'center' },
      destination: { cellWidth: 55 },
      contactNumber: { cellWidth: 25, halign: 'center' },
      timeOut: { cellWidth: 18, halign: 'center' },
      expectedReturn: { cellWidth: 18, halign: 'center' },
      initials: { cellWidth: 15, halign: 'center' },
      actualTimeIn: { cellWidth: 18, halign: 'center' },
      cqInitials: { cellWidth: 15, halign: 'center' }
    },
    didParseCell: function(data) {
      // Make header row taller for multi-line headers
      if (data.section === 'head') {
        data.cell.styles.minCellHeight = 18
      }
    }
  })

  return doc
}

/**
 * Download the signout roster as PDF
 */
export function downloadSignoutRosterPdf(entries, options = {}) {
  const { startDate, endDate } = options
  const doc = generateSignoutRosterPdf(entries, options)

  const filename = startDate === endDate
    ? `signout-roster-${startDate}.pdf`
    : `signout-roster-${startDate}-to-${endDate}.pdf`

  doc.save(filename)
}

/**
 * Generate a blank signout roster PDF (for printing)
 * @param {string} date - Date for the roster header
 * @param {number} rows - Number of blank rows (default 30)
 */
export function generateBlankSignoutRosterPdf(date, rows = 30) {
  const emptyEntries = Array(rows).fill({})
  return generateSignoutRosterPdf(emptyEntries, { startDate: date, endDate: date })
}

/**
 * Download a blank signout roster PDF
 */
export function downloadBlankSignoutRosterPdf(date, rows = 30) {
  const doc = generateBlankSignoutRosterPdf(date, rows)
  doc.save(`signout-roster-blank-${date}.pdf`)
}
