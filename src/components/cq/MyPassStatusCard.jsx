import { useMyStatus, useSelfSignOut, STATUS_TYPES, PASS_STAGES } from '../../hooks/usePersonnelStatus'
import Loading from '../common/Loading'

export default function MyPassStatusCard() {
  const { myStatus, loading, error } = useMyStatus()
  const { signIn, updateStage, breakFree, loading: actionLoading, error: actionError } = useSelfSignOut()

  if (loading) return <Loading />

  // Only show if user is out (pass or sick call)
  if (!myStatus || myStatus.status === 'present') {
    return null
  }

  const isOnPass = myStatus.status === 'pass'
  const isOnSickCall = myStatus.status === 'sick_call'
  const isCompanion = !!myStatus.withPersonId

  async function handleNextAction() {
    try {
      if (myStatus.passStage === 'enroute_to') {
        await updateStage('arrived')
      } else if (myStatus.passStage === 'arrived') {
        await updateStage('enroute_back')
      } else if (myStatus.passStage === 'enroute_back' || !myStatus.passStage) {
        await signIn()
      }
    } catch (err) {
      // Error handled by hook
    }
  }

  function getNextActionLabel() {
    if (myStatus.passStage === 'enroute_to') {
      return `Arrived at ${myStatus.destination}`
    } else if (myStatus.passStage === 'arrived') {
      return 'Heading Back'
    } else {
      return 'Sign Back In'
    }
  }

  function getNextActionColor() {
    if (myStatus.passStage === 'enroute_to') {
      return 'bg-blue-600 hover:bg-blue-700'
    } else if (myStatus.passStage === 'arrived') {
      return 'bg-yellow-600 hover:bg-yellow-700'
    } else {
      return 'bg-green-600 hover:bg-green-700'
    }
  }

  // Sick Call Card
  if (isOnSickCall) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                Sick Call
              </span>
            </div>

            <div className="space-y-1 text-sm">
              {myStatus.timeOut && (
                <div className="text-gray-700">
                  <span className="font-medium">Time Out:</span>{' '}
                  {new Date(myStatus.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {myStatus.notes && (
                <div className="text-gray-700">
                  <span className="font-medium">Notes:</span> {myStatus.notes}
                </div>
              )}
            </div>
          </div>

          {/* Sign Back In Button */}
          <div className="flex-shrink-0">
            <button
              onClick={signIn}
              disabled={actionLoading}
              className="w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 font-medium bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? 'Signing In...' : 'Sign Back In'}
            </button>
          </div>
        </div>

        {(error || actionError) && (
          <div className="mt-2 text-sm text-red-600">
            {error || actionError}
          </div>
        )}
      </div>
    )
  }

  // Pass Card
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
              On Pass
            </span>
            {myStatus.passStage && PASS_STAGES[myStatus.passStage] && (
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                myStatus.passStage === 'arrived' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {PASS_STAGES[myStatus.passStage].label}
                {myStatus.passStage === 'enroute_to' && myStatus.destination && ` ${myStatus.destination}`}
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            {myStatus.destination && (
              <div className="text-gray-700">
                <span className="font-medium">Destination:</span> {myStatus.destination}
              </div>
            )}
            {myStatus.expectedReturn && (
              <div className="text-gray-700">
                <span className="font-medium">Expected back:</span>{' '}
                {new Date(myStatus.expectedReturn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {myStatus.companions?.length > 0 && (
              <div className="text-gray-600 text-xs">
                With: {myStatus.companions.map(c => c.name).join(', ')}
              </div>
            )}
            {isCompanion && myStatus.withPersonName && (
              <div className="text-gray-600 text-xs">
                With: {myStatus.withPersonName}
              </div>
            )}
          </div>

          {/* Stage Progress Tracker */}
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
            <span className={myStatus.passStage === 'enroute_to' ? 'text-yellow-600 font-semibold' : 'text-gray-400'}>
              Enroute
            </span>
            <span className="text-gray-300">→</span>
            <span className={myStatus.passStage === 'arrived' ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
              At Location
            </span>
            <span className="text-gray-300">→</span>
            <span className={myStatus.passStage === 'enroute_back' ? 'text-yellow-600 font-semibold' : 'text-gray-400'}>
              Returning
            </span>
            <span className="text-gray-300">→</span>
            <span className="text-gray-400">Back</span>
          </div>
        </div>

        {/* Next Action Button */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2">
          {isCompanion && (
            <button
              onClick={breakFree}
              disabled={actionLoading}
              className="w-full sm:w-auto px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
            >
              Go Solo
            </button>
          )}
          <button
            onClick={handleNextAction}
            disabled={actionLoading}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 font-medium ${getNextActionColor()}`}
          >
            {actionLoading ? 'Updating...' : getNextActionLabel()}
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="mt-2 text-sm text-red-600">
          {error || actionError}
        </div>
      )}
    </div>
  )
}
