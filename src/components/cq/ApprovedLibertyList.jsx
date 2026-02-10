import { useState } from 'react'
import {
  useAvailableLibertyRequests,
  useLibertyJoinActions,
  getNextWeekendDates,
  getTimeSlotLabel,
  buildDestinationString,
  LIBERTY_LOCATIONS,
} from '../../hooks/useLibertyRequests'
import { useAuth } from '../../contexts/AuthContext'
import Loading from '../common/Loading'

function formatDate(dateString) {
  if (!dateString) return '--'
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeString) {
  if (!timeString) return '--:--'
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

export default function ApprovedLibertyList() {
  const { user } = useAuth()
  const { requests, loading, error, weekendDate } = useAvailableLibertyRequests()
  const { requestToJoin, cancelJoinRequest, approveJoinRequest, rejectJoinRequest, signUpAsPassenger, cancelPassengerSignUp, joinTimeSlot, leaveTimeSlot, loading: actionLoading } = useLibertyJoinActions()
  const [expandedId, setExpandedId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const { saturday, sunday } = getNextWeekendDates()

  async function handleJoinRequest(requestId) {
    setActionError(null)
    setSuccessMessage(null)
    try {
      await requestToJoin(requestId)
      setSuccessMessage('Join request submitted! Waiting for approval.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleCancelJoinRequest(requestId) {
    setActionError(null)
    try {
      await cancelJoinRequest(requestId)
      setSuccessMessage('Join request cancelled.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleApproveJoin(requestId, userId) {
    setActionError(null)
    try {
      await approveJoinRequest(requestId, userId)
      setSuccessMessage('Join request approved!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleRejectJoin(requestId, userId) {
    setActionError(null)
    try {
      await rejectJoinRequest(requestId, userId)
      setSuccessMessage('Join request rejected.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleSignUpAsPassenger(requestId) {
    setActionError(null)
    setSuccessMessage(null)
    try {
      await signUpAsPassenger(requestId)
      setSuccessMessage('Signed up as passenger!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleCancelPassenger(requestId) {
    setActionError(null)
    try {
      await cancelPassengerSignUp(requestId)
      setSuccessMessage('Passenger sign-up cancelled.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleJoinSlot(requestId, slotIndex) {
    setActionError(null)
    setSuccessMessage(null)
    try {
      await joinTimeSlot(requestId, slotIndex)
      setSuccessMessage('Joined time slot!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleLeaveSlot(requestId, slotIndex) {
    setActionError(null)
    try {
      await leaveTimeSlot(requestId, slotIndex)
      setSuccessMessage('Left time slot.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (loading) return <Loading />

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Weekend Liberty Groups
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        <div className="text-center py-8 text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="mt-2">No liberty groups yet for this weekend.</p>
          <p className="text-xs mt-1">Submit your own request to start a group!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-900">Weekend Liberty Groups</h3>
        <p className="text-sm text-gray-500">
          {saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Request to join a group
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-50 border-b border-green-200 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {requests.map((request) => {
          const isExpanded = expandedId === request.id
          const isOwner = request.requesterId === user?.uid
          const isCompanion = (request.companions || []).some(c => c.id === user?.uid)
          const myJoinRequest = (request.joinRequests || []).find(jr => jr.userId === user?.uid)
          const pendingJoinRequests = (request.joinRequests || []).filter(jr => jr.status === 'pending')
          const companionCount = (request.companions || []).length
          const isPending = request.status === 'pending'
          const isApproved = request.status === 'approved'
          const isDriverRequest = request.isDriver
          const passengers = request.passengers || []
          const passengerCapacity = request.passengerCapacity || 0
          const isPassenger = passengers.some(p => p.id === user?.uid)
          const seatsAvailable = passengerCapacity - passengers.length
          const hasTimeSlots = (request.timeSlots || []).length > 0
          const isInAnySlot = hasTimeSlots && request.timeSlots.some(
            (slot) => (slot.participants || []).some((p) => p.id === user?.uid)
          )

          return (
            <div key={request.id} className="p-4">
              {/* Main Row */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : request.id)}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${isPending ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  <svg
                    className={`w-5 h-5 ${isPending ? 'text-yellow-600' : 'text-green-600'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {request.destination}
                    </span>
                    {isPending && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Pending Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Approved
                      </span>
                    )}
                    {isDriverRequest && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                        Driver ({seatsAvailable} seat{seatsAvailable !== 1 ? 's' : ''} open)
                      </span>
                    )}
                    {(isPassenger || isInAnySlot) && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                        {isInAnySlot ? 'Joined' : 'Riding'}
                      </span>
                    )}
                    {isOwner && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        Your Group
                      </span>
                    )}
                    {isCompanion && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Joined
                      </span>
                    )}
                    {myJoinRequest?.status === 'pending' && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Request Pending
                      </span>
                    )}
                    {myJoinRequest?.status === 'rejected' && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Request Declined
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600">
                    Led by {request.requesterName}
                    {companionCount > 0 && ` (+${companionCount} companion${companionCount > 1 ? 's' : ''})`}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {hasTimeSlots
                      ? `${request.timeSlots.length} time slot${request.timeSlots.length > 1 ? 's' : ''}`
                      : `${formatDate(request.departureDate)} at ${formatTime(request.departureTime)} - ${formatDate(request.returnDate)} at ${formatTime(request.returnTime)}`
                    }
                  </p>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Show pending join request count for owner */}
                  {isOwner && pendingJoinRequests.length > 0 && (
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-yellow-500 text-white">
                      {pendingJoinRequests.length}
                    </span>
                  )}

                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  {/* Group Members */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Group Members</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{request.requesterName}</span>
                        <span className="text-xs text-gray-500">(Leader)</span>
                      </div>
                      {(request.companions || []).map((companion, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{companion.rank && `${companion.rank} `}{companion.name}</span>
                          {companion.joinedViaRequest && (
                            <span className="text-xs text-green-600">(Joined)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time Slots Itinerary (new) */}
                  {hasTimeSlots && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Itinerary</h4>
                      {request.timeSlots.map((slot, slotIdx) => {
                        const slotParticipants = slot.participants || []
                        const isInSlot = slotParticipants.some((p) => p.id === user?.uid)
                        const slotSeatsAvailable = isDriverRequest
                          ? passengerCapacity - slotParticipants.length
                          : null
                        const slotLocLabel = buildDestinationString(slot.locations, request.customLocation || '')

                        return (
                          <div key={slotIdx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-800">
                                  {getTimeSlotLabel(slot)}
                                </span>
                                <p className="text-xs text-gray-600">
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{slotLocLabel}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isDriverRequest && (
                                  <span className="text-xs text-indigo-600 font-medium">
                                    {slotParticipants.length}/{passengerCapacity} riders
                                  </span>
                                )}
                                {!isDriverRequest && slotParticipants.length > 0 && (
                                  <span className="text-xs text-gray-500">
                                    {slotParticipants.length} joined
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Participants list */}
                            {slotParticipants.length > 0 && (
                              <div className="mt-2 space-y-0.5">
                                {slotParticipants.map((p, pIdx) => (
                                  <div key={pIdx} className="text-xs text-gray-600">
                                    {p.rank && `${p.rank} `}{p.name}
                                    {p.id === user?.uid && <span className="text-primary-600 ml-1">(you)</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Join / Leave buttons */}
                            {!isOwner && (
                              <div className="mt-2">
                                {!isInSlot && (isDriverRequest ? slotSeatsAvailable > 0 : true) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleJoinSlot(request.id, slotIdx)
                                    }}
                                    disabled={actionLoading}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                                  >
                                    Join This Slot
                                  </button>
                                )}
                                {isInSlot && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleLeaveSlot(request.id, slotIdx)
                                    }}
                                    disabled={actionLoading}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                  >
                                    Leave Slot
                                  </button>
                                )}
                                {isDriverRequest && slotSeatsAvailable <= 0 && !isInSlot && (
                                  <p className="text-xs text-gray-500">No seats available</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Legacy Driver / Passengers (for old requests without timeSlots) */}
                  {!hasTimeSlots && isDriverRequest && (
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <h4 className="text-sm font-medium text-indigo-800 mb-2">
                        Ride Available ({passengers.length}/{passengerCapacity} passengers)
                      </h4>
                      {passengers.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {passengers.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-indigo-700">
                              <span>{p.rank && `${p.rank} `}{p.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isOwner && !isPassenger && seatsAvailable > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSignUpAsPassenger(request.id)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Sign Up for Ride
                        </button>
                      )}
                      {isPassenger && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelPassenger(request.id)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel Ride
                        </button>
                      )}
                      {seatsAvailable <= 0 && !isPassenger && !isOwner && (
                        <p className="text-xs text-indigo-600">No seats available</p>
                      )}
                    </div>
                  )}

                  {/* Purpose if available */}
                  {request.purpose && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Purpose</h4>
                      <p className="text-sm text-gray-600">{request.purpose}</p>
                    </div>
                  )}

                  {/* Pending Join Requests (visible to owner) */}
                  {isOwner && pendingJoinRequests.length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">
                        Pending Join Requests
                      </h4>
                      <div className="space-y-2">
                        {pendingJoinRequests.map((jr) => (
                          <div key={jr.userId} className="flex items-center justify-between">
                            <span className="text-sm text-yellow-700">
                              {jr.userRank && `${jr.userRank} `}{jr.userName}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleApproveJoin(request.id, jr.userId)
                                }}
                                disabled={actionLoading}
                                className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRejectJoin(request.id, jr.userId)
                                }}
                                disabled={actionLoading}
                                className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons (legacy - only for requests without time slots) */}
                  {!hasTimeSlots && (
                    <div className="flex gap-2">
                      {/* Show Join button if not owner, not companion, and no pending request */}
                      {!isOwner && !isCompanion && !myJoinRequest && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleJoinRequest(request.id)
                          }}
                          disabled={actionLoading}
                          className="btn-primary text-sm disabled:opacity-50"
                        >
                          Request to Join
                        </button>
                      )}

                      {/* Cancel pending request */}
                      {myJoinRequest?.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelJoinRequest(request.id)
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
