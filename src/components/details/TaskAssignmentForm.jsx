import { useState, useEffect } from 'react'
import { useDetailTemplates } from '../../hooks/useDetailTemplates'
import { useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import { usePersonnel } from '../../hooks/usePersonnel'

export default function TaskAssignmentForm() {
  const { templates, loading: templatesLoading } = useDetailTemplates()
  const { personnel, loading: personnelLoading } = usePersonnel()
  const { createAssignment, loading: saving } = useDetailAssignmentActions()

  const [templateId, setTemplateId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [timeSlot, setTimeSlot] = useState('both')
  const [taskAssignments, setTaskAssignments] = useState([])
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  const eligiblePersonnel = personnel?.filter(p => p.detailEligible !== false) || []

  // Set default template to first available template
  useEffect(() => {
    if (templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id)
    }
  }, [templates, templateId])

  // Load template and initialize task assignments
  useEffect(() => {
    if (templateId) {
      const template = templates.find(t => t.id === templateId)
      setSelectedTemplate(template)

      if (template) {
        // Initialize task assignments array
        const initialTasks = []
        template.areas.forEach(area => {
          area.items.forEach(item => {
            // For each location in the area (or "All" if no locations)
            const locations = area.locations && area.locations.length > 0
              ? area.locations
              : ['All']

            locations.forEach(location => {
              initialTasks.push({
                taskId: item.id,
                taskText: item.text,
                areaName: area.name,
                areaId: area.id,
                location: location,
                criticalFailure: item.criticalFailure,
                assignedTo: null,
                selected: false
              })
            })
          })
        })
        setTaskAssignments(initialTasks)
      }
    } else {
      setSelectedTemplate(null)
      setTaskAssignments([])
    }
  }, [templateId, templates])

  function toggleTaskSelection(taskIndex) {
    const newTasks = [...taskAssignments]
    newTasks[taskIndex].selected = !newTasks[taskIndex].selected
    setTaskAssignments(newTasks)
  }

  function assignPersonToTask(taskIndex, personnelId) {
    const person = eligiblePersonnel.find(p => (p.userId || p.id) === personnelId)
    if (!person) return

    const newTasks = [...taskAssignments]
    newTasks[taskIndex].assignedTo = {
      personnelId: person.userId || person.id,
      name: `${person.rank || ''} ${person.firstName} ${person.lastName}`.trim(),
      rank: person.rank || '',
      email: person.email
    }
    setTaskAssignments(newTasks)
  }

  function bulkAssignToSelected(personnelId) {
    if (!personnelId) return

    const person = eligiblePersonnel.find(p => (p.userId || p.id) === personnelId)
    if (!person) return

    const newTasks = [...taskAssignments]
    newTasks.forEach((task, idx) => {
      if (task.selected) {
        newTasks[idx].assignedTo = {
          personnelId: person.userId || person.id,
          name: `${person.rank || ''} ${person.firstName} ${person.lastName}`.trim(),
          rank: person.rank || '',
          email: person.email
        }
      }
    })
    setTaskAssignments(newTasks)
  }

  function clearSelectedAssignments() {
    const newTasks = [...taskAssignments]
    newTasks.forEach((task, idx) => {
      if (task.selected) {
        newTasks[idx].assignedTo = null
      }
    })
    setTaskAssignments(newTasks)
  }

  function clearTaskAssignment(taskIndex) {
    const newTasks = [...taskAssignments]
    newTasks[taskIndex].assignedTo = null
    setTaskAssignments(newTasks)
  }

  function selectAllTasks() {
    const newTasks = taskAssignments.map(t => ({ ...t, selected: true }))
    setTaskAssignments(newTasks)
  }

  function clearAllSelections() {
    const newTasks = taskAssignments.map(t => ({ ...t, selected: false, assignedTo: null }))
    setTaskAssignments(newTasks)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    // Get only selected tasks with assignments
    const assignedTasks = taskAssignments.filter(t => t.selected && t.assignedTo)

    if (assignedTasks.length === 0) {
      setFormError('Please select at least one task and assign it to someone')
      return
    }

    try {
      // Use today's date for the assignment
      const today = new Date().toISOString().split('T')[0]

      const assignmentData = {
        templateId,
        templateName: selectedTemplate.name,
        assignmentDate: today,
        timeSlot,
        recurring: true, // Mark as recurring daily task
        tasks: assignedTasks.map(t => ({
          taskId: t.taskId,
          taskText: t.taskText,
          areaName: t.areaName,
          areaId: t.areaId,
          location: t.location,
          criticalFailure: t.criticalFailure,
          assignedTo: t.assignedTo,
          completed: false,
          completedAt: null,
          notes: ''
        })),
        // Collect unique assignees for notifications
        assignedTo: Array.from(
          new Map(assignedTasks.map(t => [t.assignedTo.personnelId, t.assignedTo])).values()
        )
      }

      await createAssignment(assignmentData)

      // Reset form
      setTemplateId('')
      setSelectedTemplate(null)
      setTaskAssignments([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message)
    }
  }

  if (templatesLoading || personnelLoading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500 italic">
          No templates available. Create a template first in the Templates tab.
        </p>
      </div>
    )
  }

  if (eligiblePersonnel.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500 italic">
          No eligible personnel found. Import personnel roster first.
        </p>
      </div>
    )
  }

  const selectedCount = taskAssignments.filter(t => t.selected).length
  const assignedCount = taskAssignments.filter(t => t.selected && t.assignedTo).length

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign Cleaning Tasks</h2>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Tasks assigned successfully!
        </div>
      )}

      <div className="space-y-4">
        {/* Template and Time Slot Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
              Checklist Template
            </label>
            <select
              id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="input"
              required
            >
              <option value="">-- Select --</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Slot (Daily Recurring)
            </label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="input"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="both">Both</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              These tasks will recur daily at the selected time
            </p>
          </div>
        </div>

        {/* Task Assignment */}
        {selectedTemplate && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                Assign Tasks
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllTasks}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Bulk Assignment Bar */}
            {selectedCount > 0 && (
              <div className="mb-3 p-3 bg-primary-50 border-2 border-primary-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Assign {selectedCount} selected task{selectedCount !== 1 ? 's' : ''} to:
                  </span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        bulkAssignToSelected(e.target.value)
                        e.target.value = '' // Reset dropdown
                      }
                    }}
                    className="input text-sm py-1 flex-1"
                    defaultValue=""
                  >
                    <option value="">-- Select Personnel --</option>
                    {eligiblePersonnel.map((person) => (
                      <option key={person.id} value={person.userId || person.id}>
                        {person.rank && `${person.rank} `}
                        {person.firstName} {person.lastName}
                        {person.squad && ` (${person.squad})`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={clearSelectedAssignments}
                    className="btn-secondary text-xs py-1 px-3 whitespace-nowrap"
                  >
                    Clear Assignments
                  </button>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-600 mb-3">
              {selectedCount} tasks selected • {assignedCount} assigned to personnel
            </div>

            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
              {selectedTemplate.areas.map((area) => (
                <div key={area.id} className="border-b border-gray-200 last:border-b-0">
                  <div className="bg-gray-50 px-3 py-2">
                    <h4 className="text-sm font-medium text-gray-900">{area.name}</h4>
                  </div>
                  {area.items.map((item) => {
                    const locations = area.locations && area.locations.length > 0
                      ? area.locations
                      : ['All']

                    return locations.map((location) => {
                      const taskIndex = taskAssignments.findIndex(
                        t => t.taskId === item.id && t.location === location
                      )
                      if (taskIndex === -1) return null

                      const task = taskAssignments[taskIndex]

                      return (
                        <div
                          key={`${item.id}-${location}`}
                          className={`px-3 py-2 border-t border-gray-100 ${
                            task.selected ? 'bg-primary-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={task.selected}
                              onChange={() => toggleTaskSelection(taskIndex)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-900">
                                    {item.text}
                                    {item.criticalFailure && (
                                      <span className="ml-1 text-red-600 font-medium">*</span>
                                    )}
                                  </div>
                                  {task.assignedTo && (
                                    <div className="mt-1 flex items-center gap-2">
                                      <span className="text-xs text-primary-700 font-medium">
                                        → {task.assignedTo.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => clearTaskAssignment(taskIndex)}
                                        className="text-xs text-red-600 hover:text-red-700"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {location}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        {selectedTemplate && (
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={saving || assignedCount === 0}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating Assignment...' : `Assign ${assignedCount} Task${assignedCount !== 1 ? 's' : ''}`}
            </button>
            <button
              type="button"
              onClick={clearAllSelections}
              className="btn-secondary"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
