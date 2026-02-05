import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useMyActiveDetail, useActiveDetailForTimeSlot, useDetailCardActions, DETAIL_STAGES } from '../../hooks/useMyActiveDetail'
import { useMyPersonnelIds } from '../../hooks/useMyPersonnelIds'
import Loading from '../common/Loading'

export default function MyDetailCard() {
  const { user } = useAuth()
  const { isCurrentUser } = useMyPersonnelIds()
  // Get user's specific detail assignment
  const { activeDetail: myActiveDetail, loading: myLoading, error: myError, currentTimeSlot } = useMyActiveDetail()
  // Get any active detail for the time slot (for showing to all users)
  const { activeDetail: slotDetail, loading: slotLoading } = useActiveDetailForTimeSlot()
  const {
    startDetail,
    completeTask,
    completeAllTasks,
    completeSelectedTasks,
    submitForApproval,
    loading: actionLoading,
    error: actionError,
  } = useDetailCardActions()
  const [expandedTasks, setExpandedTasks] = useState(false)
  const [selectedTaskKeys, setSelectedTaskKeys] = useState(new Set())

  // Use user's detail if they have tasks, otherwise use slot detail for read-only view
  const activeDetail = myActiveDetail || slotDetail
  const loading = myLoading || slotLoading
  const error = myError

  // Check if user has tasks assigned
  const myTasks = activeDetail?.tasks?.filter(
    (t) => isCurrentUser(t.assignedTo?.personnelId)
  ) || []
  const hasMyTasks = myTasks.length > 0

  const completedTasks = myTasks.filter((t) => t.completed)
  const remainingTasks = myTasks.filter((t) => !t.completed)

  // Initialize selected tasks when detail changes or status changes
  useEffect(() => {
    if (!activeDetail) {
      setSelectedTaskKeys(new Set())
      return
    }

    // Select all tasks by default
    const allTaskKeys = myTasks.map((t) => `${t.taskId}-${t.location}`)
    setSelectedTaskKeys(new Set(allTaskKeys))
  }, [activeDetail?.id, activeDetail?.status])

  // Update selected tasks when myTasks changes (to only include remaining tasks for in_progress)
  useEffect(() => {
    if (!activeDetail) return

    const isAssigned = activeDetail.status === 'assigned'
    const isInProgress = activeDetail.status === 'in_progress'
    const isRejected = activeDetail.status === 'rejected'

    if (isAssigned) {
      // For assigned status, select all tasks
      const allTaskKeys = myTasks.map((t) => `${t.taskId}-${t.location}`)
      setSelectedTaskKeys(new Set(allTaskKeys))
    } else if (isInProgress || isRejected) {
      // For in_progress/rejected, select only remaining (incomplete) tasks
      const remainingTaskKeys = remainingTasks.map((t) => `${t.taskId}-${t.location}`)
      setSelectedTaskKeys(new Set(remainingTaskKeys))
    }
  }, [myTasks.length, remainingTasks.length])

  if (loading) return null // Don't show loading state on home - just hide if loading

  // Only show if there's an active detail
  if (!activeDetail) {
    return null
  }

  // Only show cards during their respective time windows
  // Once the time window elapses, the card should no longer be visible
  if (!currentTimeSlot) {
    return null
  }

  // If user has no tasks assigned, show a read-only info card
  if (!hasMyTasks) {
    return (
      <div className="rounded-lg border p-4 mb-6 bg-gray-50 border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                {currentTimeSlot === 'morning' ? 'Morning' : 'Evening'} Detail
              </span>
              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                Active
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">{activeDetail.templateName}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Detail is in progress. You have no tasks assigned.
            </p>
            {/* Show overall progress */}
            {activeDetail.tasks && activeDetail.tasks.length > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">
                    {activeDetail.tasks.filter(t => t.completed).length}/{activeDetail.tasks.length} tasks completed
                  </span>
                  <span className="text-gray-600">
                    {Math.round((activeDetail.tasks.filter(t => t.completed).length / activeDetail.tasks.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(activeDetail.tasks.filter(t => t.completed).length / activeDetail.tasks.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const allTasksCompleted = myTasks.length > 0 && remainingTasks.length === 0
  const progress = myTasks.length > 0 ? (completedTasks.length / myTasks.length) * 100 : 0

  const isAssigned = activeDetail.status === 'assigned'
  const isInProgress = activeDetail.status === 'in_progress'
  const isRejected = activeDetail.status === 'rejected'

  // Get selected count based on current status
  const selectedCount = isAssigned
    ? myTasks.filter((t) => selectedTaskKeys.has(`${t.taskId}-${t.location}`)).length
    : remainingTasks.filter((t) => selectedTaskKeys.has(`${t.taskId}-${t.location}`)).length

  function toggleTaskSelection(taskKey) {
    setSelectedTaskKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(taskKey)) {
        newSet.delete(taskKey)
      } else {
        newSet.add(taskKey)
      }
      return newSet
    })
  }

  function toggleSelectAll() {
    const tasksToSelect = isAssigned ? myTasks : remainingTasks
    const allSelected = tasksToSelect.every((t) =>
      selectedTaskKeys.has(`${t.taskId}-${t.location}`)
    )

    if (allSelected) {
      // Deselect all
      setSelectedTaskKeys(new Set())
    } else {
      // Select all
      const allTaskKeys = tasksToSelect.map((t) => `${t.taskId}-${t.location}`)
      setSelectedTaskKeys(new Set(allTaskKeys))
    }
  }

  async function handleStart() {
    try {
      await startDetail(activeDetail.id)
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleCompleteTask(task) {
    try {
      await completeTask(activeDetail.id, task.taskId, task.location, activeDetail.tasks)
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleCompleteSelected() {
    try {
      if (selectedTaskKeys.size === remainingTasks.length) {
        // If all remaining are selected, use the existing completeAllTasks
        await completeAllTasks(activeDetail.id, activeDetail.tasks)
      } else {
        // Otherwise use the new multi-select function
        await completeSelectedTasks(activeDetail.id, selectedTaskKeys, activeDetail.tasks)
      }
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleSubmit() {
    try {
      await submitForApproval(activeDetail.id)
    } catch (err) {
      // Error handled by hook
    }
  }

  function getStatusColor() {
    if (isRejected) return 'bg-red-50 border-red-200'
    if (allTasksCompleted) return 'bg-green-50 border-green-200'
    if (isInProgress) return 'bg-yellow-50 border-yellow-200'
    return 'bg-blue-50 border-blue-200'
  }

  function getStatusBadge() {
    if (isRejected) return { bg: 'bg-red-100', text: 'text-red-800', label: 'Redo Required' }
    if (allTasksCompleted) return { bg: 'bg-green-100', text: 'text-green-800', label: 'Ready to Submit' }
    if (isInProgress) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Progress' }
    return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assigned' }
  }

  const statusBadge = getStatusBadge()

  // Group tasks by area for display
  const tasksByArea = (isAssigned ? myTasks : remainingTasks).reduce((acc, task) => {
    if (!acc[task.areaName]) {
      acc[task.areaName] = []
    }
    acc[task.areaName].push(task)
    return acc
  }, {})

  // Check if all tasks are selected
  const tasksToCheck = isAssigned ? myTasks : remainingTasks
  const allSelected = tasksToCheck.length > 0 && tasksToCheck.every((t) =>
    selectedTaskKeys.has(`${t.taskId}-${t.location}`)
  )

  return (
    <div className={`rounded-lg border p-4 mb-6 ${getStatusColor()}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                {currentTimeSlot === 'morning' ? 'Morning' : 'Evening'} Detail
              </span>
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
            </div>

            <h3 className="font-semibold text-gray-900">{activeDetail.templateName}</h3>

            {/* Progress bar */}
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">{completedTasks.length}/{myTasks.length} tasks completed</span>
                <span className="text-gray-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${allTasksCompleted ? 'bg-green-500' : 'bg-primary-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stage Progress Tracker (similar to pass) */}
            <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
              <span className={isAssigned ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
                Assigned
              </span>
              <span className="text-gray-300">→</span>
              <span className={isInProgress && !allTasksCompleted ? 'text-yellow-600 font-semibold' : 'text-gray-400'}>
                In Progress
              </span>
              <span className="text-gray-300">→</span>
              <span className={allTasksCompleted ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                Completed
              </span>
              <span className="text-gray-300">→</span>
              <span className="text-gray-400">Approved</span>
            </div>
          </div>
        </div>

        {/* Rejection warning */}
        {isRejected && activeDetail.rejectionReason && (
          <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-sm text-red-800">
            <span className="font-medium">Redo Required: </span>
            {activeDetail.rejectionReason}
          </div>
        )}

        {/* Task Selection for Assigned Status */}
        {isAssigned && myTasks.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            {/* Select All Header */}
            <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Select All ({myTasks.length} tasks)
              </span>
            </div>

            {/* Task List */}
            <div className="max-h-48 overflow-y-auto">
              {Object.entries(tasksByArea).map(([areaName, tasks]) => (
                <div key={areaName}>
                  <div className="bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 border-b border-gray-100">
                    {areaName}
                  </div>
                  {tasks.map((task) => {
                    const taskKey = `${task.taskId}-${task.location}`
                    return (
                      <label
                        key={taskKey}
                        className="px-3 py-2 flex items-center gap-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskKeys.has(taskKey)}
                          onChange={() => toggleTaskSelection(taskKey)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 flex-1">
                          {task.taskText}
                          {task.location !== 'All' && (
                            <span className="text-xs text-gray-500 ml-1">({task.location})</span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task list (expandable) for In Progress / Rejected */}
        {remainingTasks.length > 0 && (isInProgress || isRejected) && (
          <div>
            <button
              onClick={() => setExpandedTasks(!expandedTasks)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              {expandedTasks ? '▼' : '▶'} {remainingTasks.length} task{remainingTasks.length !== 1 ? 's' : ''} remaining
            </button>

            {expandedTasks && (
              <div className="mt-2 border border-gray-200 rounded-lg bg-white overflow-hidden">
                {/* Select All Header */}
                <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({remainingTasks.length})
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {Object.entries(tasksByArea).map(([areaName, tasks]) => (
                    <div key={areaName}>
                      <div className="bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 border-b border-gray-100">
                        {areaName}
                      </div>
                      {tasks.map((task) => {
                        const taskKey = `${task.taskId}-${task.location}`
                        return (
                          <label
                            key={taskKey}
                            className="px-3 py-2 flex items-center gap-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTaskKeys.has(taskKey)}
                              onChange={() => toggleTaskSelection(taskKey)}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 flex-1">
                              {task.taskText}
                              {task.location !== 'All' && (
                                <span className="text-xs text-gray-500 ml-1">({task.location})</span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {isAssigned && (
            <button
              onClick={handleStart}
              disabled={actionLoading || selectedCount === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Starting...' : `Start Detail (${selectedCount} selected)`}
            </button>
          )}

          {(isInProgress || isRejected) && !allTasksCompleted && (
            <button
              onClick={handleCompleteSelected}
              disabled={actionLoading || selectedCount === 0}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Completing...' : `Complete/Submit (${selectedCount})`}
            </button>
          )}

          {allTasksCompleted && isInProgress && (
            <button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>

        {(error || actionError) && (
          <div className="text-sm text-red-600">
            {error || actionError}
          </div>
        )}
      </div>
    </div>
  )
}
