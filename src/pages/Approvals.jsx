import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnifiedApprovalCount } from '../hooks/useUnifiedApprovalCount'
import PassApprovalQueue from '../components/cq/PassApprovalQueue'
import LibertyApprovalQueue from '../components/cq/LibertyApprovalQueue'
import DetailApprovalQueue from '../components/details/DetailApprovalQueue'
import CQSwapApprovalQueue from '../components/cq/CQSwapApprovalQueue'
import WeatherApprovalQueue from '../components/admin/WeatherApprovalQueue'

export default function Approvals() {
  const [activeTab, setActiveTab] = useState('passes')
  const { hasApprovalAuthority } = useAuth()
  const {
    total,
    passCount,
    libertyCount,
    detailCount,
    swapCount,
    weatherCount,
    canApprovePasses,
    canApproveLiberty,
    canApproveDetails,
    canApproveSwaps,
    canApproveWeather,
    loading,
  } = useUnifiedApprovalCount()

  // If user doesn't have approval authority, show a message
  if (!hasApprovalAuthority) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-yellow-800">Access Restricted</h3>
          <p className="mt-2 text-sm text-yellow-700">
            You don&apos;t have permission to access approval queues.
          </p>
        </div>
      </div>
    )
  }

  // Build visible tabs based on permissions
  const visibleTabs = []
  if (canApprovePasses) {
    visibleTabs.push({ key: 'passes', label: 'Passes', count: passCount })
  }
  if (canApproveLiberty) {
    visibleTabs.push({ key: 'liberty', label: 'Liberty', count: libertyCount })
  }
  if (canApproveDetails) {
    visibleTabs.push({ key: 'details', label: 'Details', count: detailCount })
  }
  if (canApproveSwaps) {
    visibleTabs.push({ key: 'swaps', label: 'CQ Swaps', count: swapCount })
  }
  if (canApproveWeather) {
    visibleTabs.push({ key: 'weather', label: 'Weather', count: weatherCount })
  }

  // Set default active tab to first visible tab if current is not visible
  const isActiveTabVisible = visibleTabs.some((t) => t.key === activeTab)
  if (!isActiveTabVisible && visibleTabs.length > 0) {
    setActiveTab(visibleTabs[0].key)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
            <p className="text-gray-600">Review and process pending approvals</p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-bold text-white bg-red-500 rounded-full">
                {total} pending
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6 -mx-4 px-4 overflow-x-auto">
        <nav className="flex space-x-2 sm:space-x-4 md:space-x-8 min-w-max">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === tab.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'passes' && canApprovePasses && <PassApprovalQueue />}
      {activeTab === 'liberty' && canApproveLiberty && <LibertyApprovalQueue />}
      {activeTab === 'details' && canApproveDetails && <DetailApprovalQueue />}
      {activeTab === 'swaps' && canApproveSwaps && <CQSwapApprovalQueue />}
      {activeTab === 'weather' && canApproveWeather && <WeatherApprovalQueue />}

      {/* Empty state when no tabs visible */}
      {visibleTabs.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No approval access</h3>
          <p className="mt-2 text-sm text-gray-500">
            Your role doesn&apos;t have access to any approval queues.
          </p>
        </div>
      )}
    </div>
  )
}
