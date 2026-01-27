import { usePendingPassRequestCount } from './usePassApproval'
import { usePendingDetailApprovals } from './useDetailAssignments'
import { usePendingSwapRequestCount } from './useCQSwapRequests'
import { usePendingCount as usePendingWeatherCount } from './useWeatherRecommendations'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook that provides unified approval counts across all approval types.
 * Filters counts based on user's approval authority:
 * - candidate_leadership or admin: passes, details, swaps
 * - uniform_admin or admin: weather
 *
 * @returns {Object} Object containing total and individual counts
 */
export function useUnifiedApprovalCount() {
  const { isCandidateLeadership, canApproveWeatherUOTD, isAdmin } = useAuth()

  // Fetch counts from individual hooks
  const { count: passCount, loading: passLoading } = usePendingPassRequestCount()
  const { count: detailCount, loading: detailLoading } = usePendingDetailApprovals()
  const { count: swapCount, loading: swapLoading } = usePendingSwapRequestCount()
  const { count: weatherCount, loading: weatherLoading } = usePendingWeatherCount()

  // Calculate permission-filtered counts
  const canApprovePasses = isCandidateLeadership || isAdmin
  const canApproveDetails = isCandidateLeadership || isAdmin
  const canApproveSwaps = isCandidateLeadership || isAdmin
  const canApproveWeather = canApproveWeatherUOTD || isAdmin

  // Build total count based on permissions
  let total = 0
  if (canApprovePasses) total += passCount || 0
  if (canApproveDetails) total += detailCount || 0
  if (canApproveSwaps) total += swapCount || 0
  if (canApproveWeather) total += weatherCount || 0

  const loading = passLoading || detailLoading || swapLoading || weatherLoading

  return {
    total,
    loading,
    // Permission-filtered individual counts
    passCount: canApprovePasses ? (passCount || 0) : 0,
    detailCount: canApproveDetails ? (detailCount || 0) : 0,
    swapCount: canApproveSwaps ? (swapCount || 0) : 0,
    weatherCount: canApproveWeather ? (weatherCount || 0) : 0,
    // Permission flags for UI rendering
    canApprovePasses,
    canApproveDetails,
    canApproveSwaps,
    canApproveWeather,
  }
}
