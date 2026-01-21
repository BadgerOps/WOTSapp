import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { format } from 'date-fns'

export default function DetailChecklistView({ assignment, onClose }) {
  const { user } = useAuth()
  const { startAssignment, completeAssignment, loading: actionLoading } = useDetailAssignmentActions()

  const [tasks, setTasks] = useState([])
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [taskNotes, setTaskNotes] = useState({})
  const [completionNotes, setCompletionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandedNote, setExpandedNote] = useState(null)

  // Filter tasks for current user and load existing notes
  useEffect(() => {
    if (assignment && user) {
      const myTasks = assignment.tasks?.filter(
        t => t.assignedTo?.personnelId === user.uid
      ) || []
      setTasks(myTasks)

      // Load existing task notes
      const notes = {}
      myTasks.forEach((task, idx) => {
        if (task.notes) {
          notes[idx] = task.notes
        }
      })
      setTaskNotes(notes)
    }
  }, [assignment, user])

  const allTasksCompleted = tasks.length > 0 && tasks.every(t => t.completed)
  const completedCount = tasks.filter(t => t.completed).length

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
    setSelectedTaskIds(new Set(tasks.map((_, idx) => idx)))
  }

  function deselectAll() {
    setSelectedTaskIds(new Set())
  }

  async function handleStart() {
    try {
      await startAssignment(assignment.id)
    } catch (err) {
      setError('Failed to start assignment: ' + err.message)
    }
  }

  async function handleBulkComplete() {
    if (selectedTaskIds.size === 0) {
      setError('Please select at least one task to mark as complete')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...assignment.tasks]

      selectedTaskIds.forEach(taskIndex => {
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === tasks[taskIndex].taskId &&
              t.location === tasks[taskIndex].location &&
              t.assignedTo?.personnelId === user.uid
        )

        if (globalTaskIndex !== -1 && !updatedTasks[globalTaskIndex].completed) {
          updatedTasks[globalTaskIndex] = {
            ...updatedTasks[globalTaskIndex],
            completed: true,
            completedAt: new Date(),
            notes: taskNotes[taskIndex] || ''
          }
        }
      })

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks,
        status: assignment.status === 'assigned' ? 'in_progress' : assignment.status
      })

      // Update local state
      const newMyTasks = updatedTasks.filter(t => t.assignedTo?.personnelId === user.uid)
      setTasks(newMyTasks)
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

    setSaving(true)
    setError(null)

    try {
      const updatedTasks = [...assignment.tasks]

      selectedTaskIds.forEach(taskIndex => {
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === tasks[taskIndex].taskId &&
              t.location === tasks[taskIndex].location &&
              t.assignedTo?.personnelId === user.uid
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
        tasks: updatedTasks
      })

      // Update local state
      const newMyTasks = updatedTasks.filter(t => t.assignedTo?.personnelId === user.uid)
      setTasks(newMyTasks)
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
      const updatedTasks = [...assignment.tasks]

      Object.entries(taskNotes).forEach(([taskIndex, notes]) => {
        const globalTaskIndex = updatedTasks.findIndex(
          t => t.taskId === tasks[parseInt(taskIndex)].taskId &&
              t.location === tasks[parseInt(taskIndex)].location &&
              t.assignedTo?.personnelId === user.uid
        )

        if (globalTaskIndex !== -1) {
          updatedTasks[globalTaskIndex] = {
            ...updatedTasks[globalTaskIndex],
            notes: notes
          }
        }
      })

      await updateDoc(doc(db, 'detailAssignments', assignment.id), {
        tasks: updatedTasks
      })

      alert('Notes saved successfully!')
    } catch (err) {
      console.error('Error saving notes:', err)
      setError('Failed to save notes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete() {
    if (!allTasksCompleted) {
      setError('Please complete all tasks before submitting')
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

  const dueDate = assignment.dueDateTime?.toDate
    ? assignment.dueDateTime.toDate()
    : new Date(assignment.dueDateTime)

  // Group tasks by area
  const tasksByArea = tasks.reduce((acc, task, idx) => {
    if (!acc[task.areaName]) {
      acc[task.areaName] = []
    }
    acc[task.areaName].push({ ...task, originalIndex: idx })
    return acc
  }, {})

  const allSelected = tasks.length > 0 && selectedTaskIds.size === tasks.length
  const hasCompletedSelected = Array.from(selectedTaskIds).some(idx => tasks[idx]?.completed)
  const hasIncompleteSelected = Array.from(selectedTaskIds).some(idx => !tasks[idx]?.completed)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{assignment.templateName}</h2>
              <div className="flex gap-3 mt-1 text-sm text-gray-600">
                <span>{format(new Date(assignment.assignmentDate), 'EEEE, MMMM d, yyyy')}</span>
                <span>•</span>
                <span className="capitalize">{assignment.timeSlot}</span>
                <span>•</span>
                <span>Due: {format(dueDate, 'h:mm a')}</span>
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium text-gray-700">Progress: </span>
                <span className="text-gray-900">{completedCount}/{tasks.length} tasks completed</span>
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
                  Select All ({tasks.length})
                </span>
              </label>
              {selectedTaskIds.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedTaskIds.size} selected
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {hasIncompleteSelected && (
                <button
                  onClick={handleBulkComplete}
                  disabled={saving}
                  className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                >
                  Mark Complete ({Array.from(selectedTaskIds).filter(idx => !tasks[idx]?.completed).length})
                </button>
              )}
              {hasCompletedSelected && (
                <button
                  onClick={handleBulkUncomplete}
                  disabled={saving}
                  className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                >
                  Mark Incomplete ({Array.from(selectedTaskIds).filter(idx => tasks[idx]?.completed).length})
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
                    const isSelected = selectedTaskIds.has(task.originalIndex)
                    const isNoteExpanded = expandedNote === task.originalIndex

                    return (
                      <div
                        key={task.originalIndex}
                        className={`px-4 py-3 transition-colors ${
                          isSelected ? 'bg-primary-50' : task.completed ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTaskSelection(task.originalIndex)}
                            className="mt-1 w-5 h-5 rounded border-gray-300"
                          />

                          {/* Status Icon */}
                          <div className="mt-1">
                            {task.completed ? (
                              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                                {task.completedAt && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Completed: {format(new Date(task.completedAt), 'h:mm a')}
                                  </p>
                                )}
                              </div>

                              {/* Add Note Button */}
                              <button
                                onClick={() => setExpandedNote(isNoteExpanded ? null : task.originalIndex)}
                                className="text-xs text-primary-600 hover:text-primary-700 whitespace-nowrap"
                              >
                                {task.notes || taskNotes[task.originalIndex] ? '✏️ Edit Note' : '+ Add Note'}
                              </button>
                            </div>

                            {/* Note Input */}
                            {(isNoteExpanded || task.notes || taskNotes[task.originalIndex]) && (
                              <div className="mt-2">
                                <textarea
                                  value={taskNotes[task.originalIndex] || ''}
                                  onChange={(e) => setTaskNotes({
                                    ...taskNotes,
                                    [task.originalIndex]: e.target.value
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
          {allTasksCompleted && (
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

          {allTasksCompleted && (
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
