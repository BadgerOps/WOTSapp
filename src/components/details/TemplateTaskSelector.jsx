import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useMyPersonnelIds } from '../../hooks/useMyPersonnelIds'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import { format, addHours } from 'date-fns'

export default function TemplateTaskSelector({ template, onClose, onSuccess }) {
  const { user } = useAuth()
  const { personnelDocId } = useMyPersonnelIds()
  const { personnel } = usePersonnel()
  const { createAssignment, loading: creating } = useDetailAssignmentActions()

  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [areaFilter, setAreaFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Get current user's personnel record
  const myPersonnelRecord = useMemo(() => {
    if (!user || !personnel.length) return null
    return personnel.find(p => p.userId === user.uid || p.email === user.email)
  }, [user, personnel])

  // Flatten all tasks from template areas with unique keys
  const allTasks = useMemo(() => {
    const tasks = []
    template.areas?.forEach((area, areaIdx) => {
      const locations = area.locations?.length > 0 ? area.locations : ['All']
      area.items?.forEach((item, itemIdx) => {
        locations.forEach((location, locIdx) => {
          tasks.push({
            taskKey: `${areaIdx}-${itemIdx}-${locIdx}`,
            taskId: item.id || `item-${areaIdx}-${itemIdx}`,
            areaName: area.name,
            areaNumber: area.areaNumber || areaIdx + 1,
            taskText: item.text,
            location,
            criticalFailure: item.criticalFailure || false,
            demeritLimit: area.demeritLimit || 4,
          })
        })
      })
    })
    return tasks
  }, [template])

  // Get unique areas for filtering
  const uniqueAreas = useMemo(() => {
    const areas = new Set()
    allTasks.forEach(t => areas.add(t.areaName))
    return Array.from(areas).sort()
  }, [allTasks])

  // Filter tasks by area
  const displayedTasks = useMemo(() => {
    if (!areaFilter) return allTasks
    return allTasks.filter(t => t.areaName === areaFilter)
  }, [allTasks, areaFilter])

  // Group displayed tasks by area
  const tasksByArea = useMemo(() => {
    return displayedTasks.reduce((acc, task) => {
      if (!acc[task.areaName]) {
        acc[task.areaName] = []
      }
      acc[task.areaName].push(task)
      return acc
    }, {})
  }, [displayedTasks])

  function toggleTask(taskKey) {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskKey)) {
      newSelected.delete(taskKey)
    } else {
      newSelected.add(taskKey)
    }
    setSelectedTasks(newSelected)
  }

  function selectAll() {
    const allKeys = displayedTasks.map(t => t.taskKey)
    setSelectedTasks(new Set(allKeys))
  }

  function deselectAll() {
    setSelectedTasks(new Set())
  }

  function selectArea(areaName) {
    const areaKeys = allTasks.filter(t => t.areaName === areaName).map(t => t.taskKey)
    const newSelected = new Set(selectedTasks)
    areaKeys.forEach(key => newSelected.add(key))
    setSelectedTasks(newSelected)
  }

  async function handleSignUp() {
    if (selectedTasks.size === 0) {
      setError('Please select at least one task')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Build tasks array with user assigned
      const assignedTasks = allTasks
        .filter(t => selectedTasks.has(t.taskKey))
        .map(t => ({
          taskId: t.taskId,
          areaName: t.areaName,
          areaNumber: t.areaNumber,
          taskText: t.taskText,
          location: t.location,
          criticalFailure: t.criticalFailure,
          demeritLimit: t.demeritLimit,
          assignedTo: {
            personnelId: personnelDocId || user.uid,
            name: myPersonnelRecord
              ? `${myPersonnelRecord.rank || ''} ${myPersonnelRecord.firstName} ${myPersonnelRecord.lastName}`.trim()
              : user.displayName || user.email,
            rank: myPersonnelRecord?.rank || '',
            email: user.email
          },
          completed: false,
          completedAt: null,
          notes: ''
        }))

      // Create assignment with today's date, evening time slot
      const today = new Date()
      const assignmentDate = format(today, 'yyyy-MM-dd')

      await createAssignment({
        templateId: template.id,
        templateName: template.name,
        assignmentDate,
        timeSlot: 'evening',
        morningTime: '08:00',
        eveningTime: '18:00',
        tasks: assignedTasks,
        assignedTo: [{
          personnelId: personnelDocId || user.uid,
          name: myPersonnelRecord
            ? `${myPersonnelRecord.rank || ''} ${myPersonnelRecord.firstName} ${myPersonnelRecord.lastName}`.trim()
            : user.displayName || user.email,
        }],
        notes: `Self-assigned by ${user.displayName || user.email}`,
        failureThreshold: template.failureThreshold || 2,
        requiresApproval: template.requiresApproval !== false,
      })

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Error creating self-assignment:', err)
      setError('Failed to sign up: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const allSelected = displayedTasks.length > 0 && selectedTasks.size >= displayedTasks.length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{template.name}</h2>
              {template.description && (
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              )}
              <p className="text-sm text-primary-600 mt-2">
                Select tasks to sign up for today's detail
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filters and Bulk Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All Areas ({allTasks.length} tasks)</option>
              {uniqueAreas.map(area => {
                const count = allTasks.filter(t => t.areaName === area).length
                return (
                  <option key={area} value={area}>{area} ({count})</option>
                )
              })}
            </select>

            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-sm px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Clear
              </button>
            </div>

            {selectedTasks.size > 0 && (
              <span className="text-sm font-medium text-primary-600">
                {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-medium">×</button>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Successfully signed up! Redirecting to My Details...
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {Object.entries(tasksByArea).map(([areaName, areaTasks]) => {
              const areaSelectedCount = areaTasks.filter(t => selectedTasks.has(t.taskKey)).length
              const allAreaSelected = areaSelectedCount === areaTasks.length

              return (
                <div key={areaName} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{areaName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {areaSelectedCount}/{areaTasks.length} selected
                      </p>
                    </div>
                    <button
                      onClick={() => selectArea(areaName)}
                      disabled={allAreaSelected}
                      className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 disabled:opacity-50"
                    >
                      Select Area
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {areaTasks.map((task) => {
                      const isSelected = selectedTasks.has(task.taskKey)

                      return (
                        <label
                          key={task.taskKey}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTask(task.taskKey)}
                            className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              {task.taskText}
                              {task.location !== 'All' && (
                                <span className="ml-2 text-xs text-gray-500">({task.location})</span>
                              )}
                            </p>
                            {task.criticalFailure && (
                              <span className="text-xs text-red-600 font-medium">(Critical)</span>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleSignUp}
            disabled={saving || creating || selectedTasks.size === 0 || success}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving || creating ? 'Signing up...' : `Sign Up for ${selectedTasks.size} Task${selectedTasks.size !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onClose}
            disabled={saving || creating}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
