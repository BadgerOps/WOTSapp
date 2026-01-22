import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from 'firebase/firestore'
import { db } from '../config/firebase'

/**
 * Hook to fetch CQ pass audit log for a specific date
 * Queries personnelStatusHistory for all pass-related activities
 */
export function useCQAuditLog(date = null) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!date) {
      setEntries([])
      setLoading(false)
      return
    }

    // Create start and end of day for client-side filtering
    const startOfDay = new Date(date + 'T00:00:00')
    const endOfDay = new Date(date + 'T23:59:59.999')

    // Query all history entries ordered by timestamp
    // Filter by date range client-side to avoid composite index requirement
    const q = query(
      collection(db, 'personnelStatusHistory'),
      orderBy('timestamp', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || null,
          }))
          // Filter by date range
          .filter((entry) => {
            if (!entry.timestamp) return false
            return entry.timestamp >= startOfDay && entry.timestamp <= endOfDay
          })
          // Filter for pass-related activities
          .filter((entry) =>
            entry.status === 'pass' ||
            entry.previousStatus === 'pass' ||
            entry.action?.startsWith('stage_') ||
            entry.action === 'sign_out' ||
            entry.action === 'arrived_barracks'
          )
          // Sort ascending for display
          .sort((a, b) => a.timestamp - b.timestamp)
        setEntries(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching audit log:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [date])

  return { entries, loading, error }
}

/**
 * Hook to fetch audit log for a date range (for reports/exports)
 */
export function useCQAuditLogRange() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchRange = useCallback(async (startDate, endDate) => {
    setLoading(true)
    setError(null)

    try {
      const startOfDay = new Date(startDate + 'T00:00:00')
      const endOfDay = new Date(endDate + 'T23:59:59.999')

      // Query all history entries ordered by timestamp
      const q = query(
        collection(db, 'personnelStatusHistory'),
        orderBy('timestamp', 'desc')
      )

      const snapshot = await getDocs(q)
      const data = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || null,
        }))
        // Filter by date range
        .filter((entry) => {
          if (!entry.timestamp) return false
          return entry.timestamp >= startOfDay && entry.timestamp <= endOfDay
        })
        // Filter for pass-related activities
        .filter((entry) =>
          entry.status === 'pass' ||
          entry.previousStatus === 'pass' ||
          entry.action?.startsWith('stage_') ||
          entry.action === 'sign_out' ||
          entry.action === 'arrived_barracks'
        )
        // Sort ascending for display
        .sort((a, b) => a.timestamp - b.timestamp)

      setEntries(data)
      setLoading(false)
      return data
    } catch (err) {
      console.error('Error fetching audit log range:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }, [])

  return { entries, loading, error, fetchRange }
}

/**
 * Format audit entry action for display
 */
export function formatAuditAction(entry) {
  if (entry.action === 'sign_out') {
    const timeOut = entry.timeOut ? new Date(entry.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
    return `Signed out to ${entry.destination || 'unknown'}${timeOut ? ` at ${timeOut}` : ''}`
  }
  if (entry.action === 'stage_arrived') {
    return `Arrived at ${entry.destination || 'destination'}`
  }
  if (entry.action === 'stage_enroute_back') {
    return 'Heading back to barracks'
  }
  if (entry.action === 'arrived_barracks' || (entry.status === 'present' && entry.previousStatus === 'pass')) {
    return 'Arrived at barracks (signed in)'
  }
  if (entry.status === 'pass' && !entry.action) {
    return `Status changed to pass${entry.destination ? ` - ${entry.destination}` : ''}`
  }
  if (entry.status === 'present' && entry.previousStatus === 'pass') {
    return 'Signed back in'
  }
  return entry.action || 'Status update'
}

/**
 * Group audit entries by personnel for easier reading
 */
export function groupEntriesByPersonnel(entries) {
  const grouped = {}

  entries.forEach((entry) => {
    const key = entry.personnelId
    if (!grouped[key]) {
      grouped[key] = {
        personnelId: entry.personnelId,
        personnelName: entry.personnelName,
        personnelRank: entry.personnelRank,
        entries: [],
      }
    }
    grouped[key].entries.push(entry)
    // Update name/rank if we find better data
    if (entry.personnelName && entry.personnelName !== entry.personnelId) {
      grouped[key].personnelName = entry.personnelName
    }
    if (entry.personnelRank) {
      grouped[key].personnelRank = entry.personnelRank
    }
  })

  return Object.values(grouped).sort((a, b) =>
    (a.personnelName || '').localeCompare(b.personnelName || '')
  )
}

/**
 * Generate summary statistics for a day's audit log
 */
export function generateAuditSummary(entries) {
  const signOuts = entries.filter(e => e.action === 'sign_out' || (e.status === 'pass' && !e.previousStatus?.startsWith('stage_')))
  const signIns = entries.filter(e => e.action === 'arrived_barracks' || (e.status === 'present' && e.previousStatus === 'pass'))

  const destinations = {}
  signOuts.forEach((entry) => {
    const dest = entry.destination || 'Unknown'
    destinations[dest] = (destinations[dest] || 0) + 1
  })

  const uniquePersonnel = new Set(entries.map(e => e.personnelId))

  return {
    totalSignOuts: signOuts.length,
    totalSignIns: signIns.length,
    uniquePersonnel: uniquePersonnel.size,
    destinations,
    entries: entries.length,
  }
}
