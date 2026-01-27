import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import { useMyPersonnelIds } from '../../hooks/useMyPersonnelIds'
import { usePersonnel } from '../../hooks/usePersonnel'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { format, isValid, parseISO } from 'date-fns'

/**
 * Safely parse a date value that could be a Firestore Timestamp, Date, or string
 */
function safeParseDate(value) {
  if (!value) return null
  // Firestore Timestamp
  if (value?.toDate) {
    const date = value.toDate()
    return isValid(date) ? date : null
  }
  // Already a Date
  if (value instanceof Date) return isValid(value) ? value : null
  // ISO string or other string format
  if (typeof value === 'string') {
    // Handle YYYY-MM-DD format specifically
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(value + 'T00:00:00')
      return isValid(parsed) ? parsed : null
    }
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }
  // Number (timestamp in ms)
  if (typeof value === 'number') {
    const date = new Date(value)
    return isValid(date) ? date : null
  }
  return null
}

export default function DetailChecklistView({ assignment, onClose }) {
  const { user } = useAuth()
  const { isCurrentUser, personnelDocId } = useMyPersonnelIds()
  const { personnel } = usePersonnel()
  const { startAssignment, completeAssignment, loading: actionLoading } = useDetailAssignmentActions()

  const [allTasks, setAllTasks] = useState([])
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [taskNotes, setTaskNotes] = useState({})
  const [completionNotes, setCompletionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandedNote, setExpandedNote] = useState(null)
  const [viewMode, setViewMode] = useState('all') // 'my' or 'all' - default to all
  const [areaFilter, setAreaFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('') // '', 'unclaimed', 'mine', 'others'

  // Get current user's personnel record for display info
  const myPersonnelRecord = useMemo(() => {
    if (!user || !personnel.length) return null
    return personnel.find(p => p.userId === user.uid || p.email === user.email)
  }, [user, personnel])

  // Get unique areas and locations for filtering
  const uniqueAreas = useMemo(() => {
    const areas = new Set()
    allTasks.forEach(t => areas.add(t.areaName))
    return Array.from(areas).sort()
  }, [allTasks])

  const uniqueLocations = useMemo(() => {
    const locations = new Set()
    allTasks.forEach(t => {
      if (t.location && t.location !== 'All') {
        locations.add(t.location)
      }
    })
    return Array.from(locations).sort()
  }, [allTasks])

  // Initialize all tasks from assignment
  useEffect(() => {
    if (assignment) {
      setAllTasks(assignment.tasks || [])

      // Load existing task notes for user's tasks
      const notes = {}
      assignment.tasks?.forEach((task, idx) => {
        if (isCurrentUser(task.assignedTo?.personnelId) && task.notes) {
          notes[idx] = task.notes
        }
      })
      setTaskNotes(notes)
    }
  }, [assignment, isCurrentUser])

  // Filter tasks based on view mode and filters
  const displayedTasks = useMemo(() => {
    let filtered = allTasks

    // View mode filter
    if (viewMode === 'my') {
      filtered = filtered.filter(t => isCurrentUser(t.assignedTo?.personnelId))
    }

    // Area filter
    if (areaFilter) {
      filtered = filtered.filter(t => t.areaName === areaFilter)
    }

    // Location filter
    if (locationFilter) {
      filtered = filtered.filter(t => t.location === locationFilter)
    }

    // Assignment filter
    if (assignmentFilter === 'unclaimed') {
      filtered = filtered.filter(t => !t.assignedTo?.personnelId)
    } else if (assignmentFilter === 'mine') {
      filtered = filtered.filter(t => isCurrentUser(t.assignedTo?.personnelId))
    } else if (assignmentFilter === 'others') {
      filtered = filtered.filter(t => t.assignedTo?.personnelId && !isCurrentUser(t.assignedTo?.personnelId))
    }

    return filtered
  }, [allTasks, viewMode, areaFilter, locationFilter, assignmentFilter, isCurrentUser])

  // Get my tasks for progress tracking
  const myTasks = useMemo(() => {
    return allTasks.filter(t => isCurrentUser(t.assignedTo?.personnelId))
  }, [allTasks, isCurrentUser])

  const allMyTasksCompleted = myTasks.length > 0 && myTasks.every(t => t.completed)
  const completedCount = myTasks.filter(t => t.completed).length

  function toggleTaskSelection(taskIndex) {
    const newSelected = new Set(selectedTaskIds)
    if (newSelected.has(taskIndex)) {
      newSelected.delete(taskIndex)
    } else {
      newSelected.add(taskIndex)
    }
    setSelectedTaskIds(newSelected)
  }

  function selectAll() {
    const indices = displayedTasks.map((_, idx) => idx)
    setSelectedTaskIds(new Set(indices))
  }

  function deselectAll() {
    setSelectedTaskIds(new Set())
  }

  async function handleStart() {
    try {
      await startAssignment(assignment.id)
      // Close the modal after successfully starting - the home screen card will now show the detail
      onClose()
    } catch (err) {
      setError('Failed to start assignment: ' + err.message)
    }
  }

  // Claim a task for the current user (can reassign from others)
  async function handleClaimTask(taskIndex, forceReassign = false) {
    const task = allTasks[taskIndex]

    // If task is assigned to someone else and not forcing reassign, ask for confirmation
    if (task.assignedTo?.personnelId && !isCurrentUser(task.assignedTo?.personnelId) && !forceReassign) {
      const confirmed = window.confirm(
        `This task is currently assigned to ${task.assignedTo?.name || 'another person'}. Do you want to take it over?`
      )
      if (!confirmed) return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...allTasks]
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        assignedTo: {
          personnelId: personnelDocId || user.uid,
          name: myPersonnelRecord
            ? `${myPersonnelRecord.rank || ''} ${myPersonnelRecord.firstName} ${myPersonnelRecord.lastName}`.trim()
            : user.displayName || user.email,
          rank: myPersonnelRecord?.rank || '',
          email: user.email
        },
        // Clear completion status if reassigning
        completed: false,
        completedAt: null
      }

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      })

      setAllTasks(updatedTasks)
    } catch (err) {
      console.error('Error claiming task:', err)
      setError('Failed to claim task: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Bulk claim selected unclaimed tasks
  async function handleBulkClaim() {
    const unclaimedSelectedIndices = Array.from(selectedTaskIds).filter(idx => {
      const task = displayedTasks[idx]
      return !task.assignedTo?.personnelId
    })

    if (unclaimedSelectedIndices.length === 0) {
      setError('No unclaimed tasks selected')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...allTasks]

      unclaimedSelectedIndices.forEach(displayIdx => {
        const task = displayedTasks[displayIdx]
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === task.taskId && t.location === task.location && !t.assignedTo?.personnelId
        )

        if (globalTaskIndex !== -1) {
          updatedTasks[globalTaskIndex] = {
            ...updatedTasks[globalTaskIndex],
            assignedTo: {
              personnelId: personnelDocId || user.uid,
              name: myPersonnelRecord
                ? `${myPersonnelRecord.rank || ''} ${myPersonnelRecord.firstName} ${myPersonnelRecord.lastName}`.trim()
                : user.displayName || user.email,
              rank: myPersonnelRecord?.rank || '',
              email: user.email
            }
          }
        }
      })

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      })

      setAllTasks(updatedTasks)
      setSelectedTaskIds(new Set())
    } catch (err) {
      console.error('Error claiming tasks:', err)
      setError('Failed to claim tasks: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Unclaim a task from the current user
  async function handleUnclaimTask(taskIndex) {
    const task = allTasks[taskIndex]
    if (!isCurrentUser(task.assignedTo?.personnelId)) {
      setError('You can only unclaim your own tasks')
      return
    }

    if (task.completed) {
      setError('Cannot unclaim a completed task')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...allTasks]
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        assignedTo: null
      }

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      })

      setAllTasks(updatedTasks)
    } catch (err) {
      console.error('Error unclaiming task:', err)
      setError('Failed to unclaim task: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkComplete() {
    if (selectedTaskIds.size === 0) {
      setError('Please select at least one task to mark as complete')
      return
    }

    // Only complete tasks that are assigned to the current user
    const mySelectedIndices = Array.from(selectedTaskIds).filter(idx => {
      const task = displayedTasks[idx]
      const globalIdx = allTasks.findIndex(t =>
        t.taskId === task.taskId && t.location === task.location && t.assignedTo?.personnelId === task.assignedTo?.personnelId
      )
      return isCurrentUser(allTasks[globalIdx]?.assignedTo?.personnelId)
    })

    if (mySelectedIndices.length === 0) {
      setError('You can only complete tasks assigned to you')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...allTasks]

      mySelectedIndices.forEach(displayIdx => {
        const task = displayedTasks[displayIdx]
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === task.taskId &&
              t.location === task.location &&
              isCurrentUser(t.assignedTo?.personnelId)
        )

        if (globalTaskIndex !== -1 && !updatedTasks[globalTaskIndex].completed) {
          updatedTasks[globalTaskIndex] = {
            ...updatedTasks[globalTaskIndex],
            completed: true,
            completedAt: new Date(),
            notes: taskNotes[displayIdx] || ''
          }
        }
      })

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        status: assignment.status === 'assigned' ? 'in_progress' : assignment.status,
        updatedAt: serverTimestamp()
      })

      setAllTasks(updatedTasks)
      setSelectedTaskIds(new Set())
    } catch (err) {
      console.error('Error completing tasks:', err)
      setError('Failed to complete tasks: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkUncomplete() {
    if (selectedTaskIds.size === 0) {
      setError('Please select at least one task to mark as incomplete')
      return
    }

    // Only uncomplete tasks that are assigned to the current user
    const mySelectedIndices = Array.from(selectedTaskIds).filter(idx => {
      const task = displayedTasks[idx]
      const globalIdx = allTasks.findIndex(t =>
        t.taskId === task.taskId && t.location === task.location && t.assignedTo?.personnelId === task.assignedTo?.personnelId
      )
      return isCurrentUser(allTasks[globalIdx]?.assignedTo?.personnelId)
    })

    if (mySelectedIndices.length === 0) {
      setError('You can only modify tasks assigned to you')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...allTasks]

      mySelectedIndices.forEach(displayIdx => {
        const task = displayedTasks[displayIdx]
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === task.taskId &&
              t.location === task.location &&
              isCurrentUser(t.assignedTo?.personnelId)
        )

        if (globalTaskIndex !== -1 && updatedTasks[globalTaskIndex].completed) {
          updatedTasks[globalTaskIndex] = {
            ...updatedTasks[globalTaskIndex],
            completed: false,
            completedAt: null
          }
        }
      })

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      })

      setAllTasks(updatedTasks)
      setSelectedTaskIds(new Set())
    } catch (err) {
      console.error('Error uncompleting tasks:', err)
      setError('Failed to uncomplete tasks: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes() {
    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...allTasks]

      Object.entries(taskNotes).forEach(([displayIdx, notes]) => {
        const task = displayedTasks[parseInt(displayIdx)]
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === task.taskId &&
              t.location === task.location &&
              isCurrentUser(t.assignedTo?.personnelId)
        )

        if (globalTaskIndex !== -1) {
          updatedTasks[globalTaskIndex] = {
            ...updatedTasks[globalTaskIndex],
            notes: notes
          }
        }
      })

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      })

      setAllTasks(updatedTasks)
      alert('Notes saved successfully!')
    } catch (err) {
      console.error('Error saving notes:', err)
      setError('Failed to save notes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete() {
    if (!allMyTasksCompleted) {
      setError('Please complete all your tasks before submitting')
      return
    }

    try {
      await completeAssignment(assignment.id, completionNotes)
      onClose()
    } catch (err) {
      setError('Failed to complete assignment: ' + err.message)
    }
  }

  if (!assignment) return null

  const dueDate = safeParseDate(assignment.dueDateTime)
  const assignmentDate = safeParseDate(assignment.assignmentDate)

  // Group displayed tasks by area
  const tasksByArea = displayedTasks.reduce((acc, task, idx) => {
    if (!acc[task.areaName]) {
      acc[task.areaName] = []
    }
    acc[task.areaName].push({ ...task, displayIndex: idx })
    return acc
  }, {})

  const allSelected = displayedTasks.length > 0 && selectedTaskIds.size === displayedTasks.length
  const hasCompletedSelected = Array.from(selectedTaskIds).some(idx => displayedTasks[idx]?.completed)
  const hasIncompleteSelected = Array.from(selectedTaskIds).some(idx => {
    const task = displayedTasks[idx]
    return !task?.completed && isCurrentUser(task?.assignedTo?.personnelId)
  })
  const hasUnclaimedSelected = Array.from(selectedTaskIds).some(idx => {
    const task = displayedTasks[idx]
    return !task?.assignedTo?.personnelId
  })

  // Count unclaimed tasks
  const unclaimedCount = allTasks.filter(t => !t.assignedTo?.personnelId).length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{assignment.templateName}</h2>
              <div className="flex gap-3 mt-1 text-sm text-gray-600">
                <span>{assignmentDate ? format(assignmentDate, 'EEEE, MMMM d, yyyy') : 'Unknown date'}</span>
                <span>•</span>
                <span className="capitalize">{assignment.timeSlot}</span>
                {dueDate && (
                  <>
                    <span>•</span>
                    <span>Due: {format(dueDate, 'h:mm a')}</span>
                  </>
                )}
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium text-gray-700">My Progress: </span>
                <span className="text-gray-900">{completedCount}/{myTasks.length} tasks completed</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* View Toggle */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { setViewMode('my'); setSelectedTaskIds(new Set()); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'my'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              My Tasks ({myTasks.length})
            </button>
            <button
              onClick={() => { setViewMode('all'); setSelectedTaskIds(new Set()); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Tasks ({allTasks.length})
              {unclaimedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                  {unclaimedCount} unclaimed
                </span>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Area Filter */}
            <select
              value={areaFilter}
              onChange={(e) => { setAreaFilter(e.target.value); setSelectedTaskIds(new Set()); }}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All Areas</option>
              {uniqueAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>

            {/* Location Filter */}
            {uniqueLocations.length > 0 && (
              <select
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value); setSelectedTaskIds(new Set()); }}
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            )}

            {/* Assignment Filter */}
            <select
              value={assignmentFilter}
              onChange={(e) => { setAssignmentFilter(e.target.value); setSelectedTaskIds(new Set()); }}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All Assignments</option>
              <option value="unclaimed">Unclaimed Only ({unclaimedCount})</option>
              <option value="mine">My Tasks ({myTasks.length})</option>
              <option value="others">Others' Tasks</option>
            </select>

            {/* Clear Filters */}
            {(areaFilter || locationFilter || assignmentFilter) && (
              <button
                onClick={() => {
                  setAreaFilter('')
                  setLocationFilter('')
                  setAssignmentFilter('')
                  setSelectedTaskIds(new Set())
                }}
                className="text-xs px-2 py-1.5 text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            )}

            {/* Show filtered count */}
            {(areaFilter || locationFilter || assignmentFilter) && (
              <span className="text-xs text-gray-500 py-1.5">
                Showing {displayedTasks.length} of {allTasks.length} tasks
              </span>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({displayedTasks.length})
                </span>
              </label>
              {selectedTaskIds.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedTaskIds.size} selected
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {hasUnclaimedSelected && (
                <button
                  onClick={handleBulkClaim}
                  disabled={saving}
                  className="text-sm py-1 px-3 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                >
                  Claim Selected
                </button>
              )}
              {hasIncompleteSelected && (
                <button
                  onClick={handleBulkComplete}
                  disabled={saving}
                  className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                >
                  Mark Complete
                </button>
              )}
              {hasCompletedSelected && (
                <button
                  onClick={handleBulkUncomplete}
                  disabled={saving}
                  className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                >
                  Mark Incomplete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium">×</button>
            </div>
          )}

          {assignment.notes && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm">
              <span className="font-medium">Assignment Notes: </span>
              {assignment.notes}
            </div>
          )}

          {assignment.rejectionReason && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg text-sm">
              <span className="font-medium">⚠️ Rejected - Please Redo: </span>
              {assignment.rejectionReason}
            </div>
          )}

          {/* Tasks by Area */}
          <div className="space-y-4">
            {Object.entries(tasksByArea).map(([areaName, areaTasks]) => (
              <div key={areaName} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">{areaName}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {areaTasks.filter(t => t.completed).length}/{areaTasks.length} completed
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {areaTasks.map((task) => {
                    const isSelected = selectedTaskIds.has(task.displayIndex)
                    const isNoteExpanded = expandedNote === task.displayIndex
                    const isMine = isCurrentUser(task.assignedTo?.personnelId)
                    const isUnclaimed = !task.assignedTo?.personnelId

                    return (
                      <div
                        key={task.displayIndex}
                        className={`px-4 py-3 transition-colors ${
                          isSelected ? 'bg-primary-50' :
                          task.completed ? 'bg-green-50' :
                          isUnclaimed ? 'bg-yellow-50' :
                          'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTaskSelection(task.displayIndex)}
                            className="mt-1 w-5 h-5 rounded border-gray-300"
                          />

                          {/* Status Icon */}
                          <div className="mt-1">
                            {task.completed ? (
                              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : isUnclaimed ? (
                              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="4 2" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                              </svg>
                            )}
                          </div>

                          {/* Task Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className={`text-sm ${task.completed ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
                                  {task.taskText}
                                  {task.location !== 'All' && (
                                    <span className="ml-2 text-xs text-gray-500">({task.location})</span>
                                  )}
                                </p>

                                {/* Assignment info */}
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  {isUnclaimed ? (
                                    <button
                                      onClick={() => handleClaimTask(allTasks.findIndex(
                                        t => t.taskId === task.taskId && t.location === task.location && !t.assignedTo?.personnelId
                                      ))}
                                      disabled={saving}
                                      className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full hover:bg-yellow-200 disabled:opacity-50"
                                    >
                                      + Claim this task
                                    </button>
                                  ) : (
                                    <>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        isMine ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {isMine ? '👤 Assigned to you' : `Assigned to ${task.assignedTo?.name || 'Unknown'}`}
                                      </span>
                                      {/* Allow taking over tasks from others */}
                                      {!isMine && (
                                        <button
                                          onClick={() => handleClaimTask(allTasks.findIndex(
                                            t => t.taskId === task.taskId && t.location === task.location && t.assignedTo?.personnelId === task.assignedTo?.personnelId
                                          ))}
                                          disabled={saving}
                                          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:opacity-50"
                                        >
                                          Take Over
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {isMine && !task.completed && (
                                    <button
                                      onClick={() => handleUnclaimTask(allTasks.findIndex(
                                        t => t.taskId === task.taskId && t.location === task.location && isCurrentUser(t.assignedTo?.personnelId)
                                      ))}
                                      disabled={saving}
                                      className="text-xs text-red-600 hover:text-red-700"
                                    >
                                      × Unclaim
                                    </button>
                                  )}
                                </div>

                                {(() => {
                                  const completedDate = safeParseDate(task.completedAt)
                                  return completedDate ? (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Completed: {format(completedDate, 'h:mm a')}
                                    </p>
                                  ) : null
                                })()}
                              </div>

                              {/* Add Note Button (only for my tasks) */}
                              {isMine && (
                                <button
                                  onClick={() => setExpandedNote(isNoteExpanded ? null : task.displayIndex)}
                                  className="text-xs text-primary-600 hover:text-primary-700 whitespace-nowrap"
                                >
                                  {task.notes || taskNotes[task.displayIndex] ? '✏️ Edit Note' : '+ Add Note'}
                                </button>
                              )}
                            </div>

                            {/* Note Input */}
                            {isMine && (isNoteExpanded || task.notes || taskNotes[task.displayIndex]) && (
                              <div className="mt-2">
                                <textarea
                                  value={taskNotes[task.displayIndex] || ''}
                                  onChange={(e) => setTaskNotes({
                                    ...taskNotes,
                                    [task.displayIndex]: e.target.value
                                  })}
                                  placeholder="Add a note about this task (optional)..."
                                  className="input text-xs"
                                  rows={2}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Overall Completion Notes */}
          {allMyTasksCompleted && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall Completion Notes (Optional)
              </label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Add any general notes about completing this detail..."
                className="input"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-lg flex gap-3">
          {assignment.status === 'assigned' && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="btn-secondary"
            >
              {actionLoading ? 'Starting...' : 'Start Detail'}
            </button>
          )}

          {Object.keys(taskNotes).length > 0 && (
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="btn-secondary"
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          )}

          {allMyTasksCompleted && myTasks.length > 0 && (
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="btn-primary flex-1"
            >
              {actionLoading ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}

          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
