import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Internal hook to fetch count for a collection with a specific status.
 * Only queries when enabled, preventing permission errors for unauthorized users.
 */
function useCountWithPermission(collectionName, statusValue, enabled) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, collectionName),
      where('status', '==', statusValue)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size)
        setLoading(false)
      },
      (err) => {
        console.error(`Error fetching ${collectionName} count:`, err)
        setCount(0)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [collectionName, statusValue, enabled])

  return { count, loading }
}

/**
 * Hook that provides unified approval counts across all approval types.
 * Only queries collections that the user has permission to access:
 * - candidate_leadership or admin: passes, details, swaps
 * - uniform_admin or admin: weather
 *
 * @returns {Object} Object containing total and individual counts
 */
export function useUnifiedApprovalCount() {
  const { isCandidateLeadership, canApproveWeatherUOTD, isAdmin } = useAuth()

  // Calculate permission flags first
  const canApprovePasses = isCandidateLeadership || isAdmin
  const canApproveDetails = isCandidateLeadership || isAdmin
  const canApproveSwaps = isCandidateLeadership || isAdmin
  const canApproveWeather = canApproveWeatherUOTD || isAdmin

  // Only query collections user has permission to access
  // Note: detailAssignments uses 'completed' status for items awaiting approval
  const { count: passCount, loading: passLoading } = useCountWithPermission('passApprovalRequests', 'pending', canApprovePasses)
  const { count: detailCount, loading: detailLoading } = useCountWithPermission('detailAssignments', 'completed', canApproveDetails)
  const { count: swapCount, loading: swapLoading } = useCountWithPermission('cqSwapRequests', 'pending', canApproveSwaps)
  const { count: weatherCount, loading: weatherLoading } = useCountWithPermission('weatherRecommendations', 'pending', canApproveWeather)

  // Build total count based on permissions
  const total = passCount + detailCount + swapCount + weatherCount

  // Only count loading for enabled queries
  const loading =
    (canApprovePasses && passLoading) ||
    (canApproveDetails && detailLoading) ||
    (canApproveSwaps && swapLoading) ||
    (canApproveWeather && weatherLoading)

  return {
    total,
    loading,
    passCount,
    detailCount,
    swapCount,
    weatherCount,
    // Permission flags for UI rendering
    canApprovePasses,
    canApproveDetails,
    canApproveSwaps,
    canApproveWeather,
  }
}
