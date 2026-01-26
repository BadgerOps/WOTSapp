import { useState, useEffect, useMemo } from 'react'
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

  // Filtering state
  const [locationFilter, setLocationFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')

  // Autocomplete state
  const [personnelSearch, setPersonnelSearch] = useState('')
  const [showPersonnelDropdown, setShowPersonnelDropdown] = useState(false)
  const [activeTaskIndex, setActiveTaskIndex] = useState(null)

  const eligiblePersonnel = personnel?.filter(p => p.detailEligible !== false) || []

  // Get unique locations from template
  const uniqueLocations = useMemo(() => {
    if (!selectedTemplate) return []
    const locations = new Set()
    selectedTemplate.areas.forEach(area => {
      if (area.locations && area.locations.length > 0) {
        area.locations.forEach(loc => locations.add(loc))
      }
    })
    return Array.from(locations).sort()
  }, [selectedTemplate])

  // Get unique areas from template
  const uniqueAreas = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedTemplate.areas.map(a => ({ id: a.id, name: a.name }))
  }, [selectedTemplate])

  // Filter personnel for autocomplete search
  const filteredPersonnel = useMemo(() => {
    if (!personnelSearch.trim()) return []
    const search = personnelSearch.toLowerCase()
    return eligiblePersonnel
      .filter((p) => {
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase()
        const reverseName = `${p.lastName} ${p.firstName}`.toLowerCase()
        const rankName = `${p.rank || ''} ${p.lastName}`.toLowerCase()
        return fullName.includes(search) || reverseName.includes(search) || rankName.includes(search)
      })
      .slice(0, 8) // Limit results
  }, [personnelSearch, eligiblePersonnel])

  // Filter tasks based on location and area filters
  const filteredTasks = useMemo(() => {
    return taskAssignments.filter(task => {
      const matchesLocation = !locationFilter || task.location === locationFilter
      const matchesArea = !areaFilter || task.areaId === areaFilter
      return matchesLocation && matchesArea
    })
  }, [taskAssignments, locationFilter, areaFilter])

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
                assignedTo: [], // Changed to array for multi-assign
                selected: false
              })
            })
          })
        })
        setTaskAssignments(initialTasks)
        // Reset filters when template changes
        setLocationFilter('')
        setAreaFilter('')
      }
    } else {
      setSelectedTemplate(null)
      setTaskAssignments([])
    }
  }, [templateId, templates])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest('.personnel-dropdown-container')) {
        setShowPersonnelDropdown(false)
        setActiveTaskIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleTaskSelection(taskIndex) {
    const newTasks = [...taskAssignments]
    newTasks[taskIndex].selected = !newTasks[taskIndex].selected
    setTaskAssignments(newTasks)
  }

  function addPersonToTask(taskIndex, person) {
    const newTasks = [...taskAssignments]
    const task = newTasks[taskIndex]

    // Check if person is already assigned
    if (task.assignedTo.some(p => (p.personnelId === person.userId || p.personnelId === person.id))) {
      return // Already assigned
    }

    task.assignedTo.push({
      personnelId: person.userId || person.id,
      name: `${person.rank || ''} ${person.firstName} ${person.lastName}`.trim(),
      rank: person.rank || '',
      email: person.email
    })
    setTaskAssignments(newTasks)
    setPersonnelSearch('')
    setShowPersonnelDropdown(false)
  }

  function removePersonFromTask(taskIndex, personnelId) {
    const newTasks = [...taskAssignments]
    newTasks[taskIndex].assignedTo = newTasks[taskIndex].assignedTo.filter(
      p => p.personnelId !== personnelId
    )
    setTaskAssignments(newTasks)
  }

  function bulkAssignToSelected(personnelId) {
    if (!personnelId) return

    const person = eligiblePersonnel.find(p => (p.userId || p.id) === personnelId)
    if (!person) return

    const newTasks = [...taskAssignments]
    newTasks.forEach((task, idx) => {
      if (task.selected) {
        // Check if person is already assigned
        if (!task.assignedTo.some(p => p.personnelId === (person.userId || person.id))) {
          newTasks[idx].assignedTo.push({
            personnelId: person.userId || person.id,
            name: `${person.rank || ''} ${person.firstName} ${person.lastName}`.trim(),
            rank: person.rank || '',
            email: person.email
          })
        }
      }
    })
    setTaskAssignments(newTasks)
  }

  function clearSelectedAssignments() {
    const newTasks = [...taskAssignments]
    newTasks.forEach((task, idx) => {
      if (task.selected) {
        newTasks[idx].assignedTo = []
      }
    })
    setTaskAssignments(newTasks)
  }

  function clearTaskAssignments(taskIndex) {
    const newTasks = [...taskAssignments]
    newTasks[taskIndex].assignedTo = []
    setTaskAssignments(newTasks)
  }

  function selectAllFilteredTasks() {
    const newTasks = [...taskAssignments]
    const filteredIndices = new Set(
      filteredTasks.map(ft => taskAssignments.findIndex(
        t => t.taskId === ft.taskId && t.location === ft.location
      ))
    )
    newTasks.forEach((task, idx) => {
      if (filteredIndices.has(idx)) {
        task.selected = true
      }
    })
    setTaskAssignments(newTasks)
  }

  function clearAllSelections() {
    const newTasks = taskAssignments.map(t => ({ ...t, selected: false, assignedTo: [] }))
    setTaskAssignments(newTasks)
  }

  function deselectAllFilteredTasks() {
    const newTasks = [...taskAssignments]
    const filteredIndices = new Set(
      filteredTasks.map(ft => taskAssignments.findIndex(
        t => t.taskId === ft.taskId && t.location === ft.location
      ))
    )
    newTasks.forEach((task, idx) => {
      if (filteredIndices.has(idx)) {
        task.selected = false
      }
    })
    setTaskAssignments(newTasks)
  }

  // Check if all filtered tasks are selected
  const allFilteredSelected = filteredTasks.length > 0 && filteredTasks.every(t => t.selected)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    // Get selected tasks (some may have assignments, some may not)
    const selectedTasks = taskAssignments.filter(t => t.selected)

    if (selectedTasks.length === 0) {
      setFormError('Please select at least one task to include in the assignment')
      return
    }

    try {
      // Use today's date for the assignment
      const today = new Date().toISOString().split('T')[0]

      // Build task list - include all selected tasks
      // Tasks with multiple assignees get expanded into separate entries
      // Tasks without assignees are included with assignedTo: null (can be claimed later)
      const flattenedTasks = []
      selectedTasks.forEach(task => {
        if (task.assignedTo.length > 0) {
          // Create a task entry for each assigned person
          task.assignedTo.forEach(person => {
            flattenedTasks.push({
              taskId: task.taskId,
              taskText: task.taskText,
              areaName: task.areaName,
              areaId: task.areaId,
              location: task.location,
              criticalFailure: task.criticalFailure,
              assignedTo: person,
              completed: false,
              completedAt: null,
              notes: ''
            })
          })
        } else {
          // Include unassigned task - users can claim it later
          flattenedTasks.push({
            taskId: task.taskId,
            taskText: task.taskText,
            areaName: task.areaName,
            areaId: task.areaId,
            location: task.location,
            criticalFailure: task.criticalFailure,
            assignedTo: null, // Can be claimed by users
            completed: false,
            completedAt: null,
            notes: ''
          })
        }
      })

      // Collect unique assignees for notifications (only those actually assigned)
      const assignedPersonnel = flattenedTasks
        .filter(t => t.assignedTo)
        .map(t => t.assignedTo)
      const uniqueAssignees = Array.from(
        new Map(assignedPersonnel.map(p => [p.personnelId, p])).values()
      )

      const assignmentData = {
        templateId,
        templateName: selectedTemplate.name,
        assignmentDate: today,
        timeSlot,
        recurring: true, // Mark as recurring daily task
        tasks: flattenedTasks,
        assignedTo: uniqueAssignees
      }

      await createAssignment(assignmentData)

      // Reset form
      setTemplateId('')
      setSelectedTemplate(null)
      setTaskAssignments([])
      setLocationFilter('')
      setAreaFilter('')
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
  const assignedCount = taskAssignments.filter(t => t.selected && t.assignedTo.length > 0).length
  const totalAssignments = taskAssignments.filter(t => t.selected).reduce((sum, t) => sum + t.assignedTo.length, 0)

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
            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 mb-3">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Filter by Area
                </label>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="input text-sm py-1.5"
                >
                  <option value="">All Areas</option>
                  {uniqueAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              {uniqueLocations.length > 0 && (
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Location
                  </label>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="input text-sm py-1.5"
                  >
                    <option value="">All Locations</option>
                    {uniqueLocations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                Assign Tasks {(locationFilter || areaFilter) && (
                  <span className="text-gray-500 font-normal">
                    (showing {filteredTasks.length} of {taskAssignments.length})
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllFilteredTasks}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Select {locationFilter || areaFilter ? 'Filtered' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={deselectAllFilteredTasks}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Deselect {locationFilter || areaFilter ? 'Filtered' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Bulk Assignment Bar */}
            {selectedCount > 0 && (
              <div className="mb-3 p-3 bg-primary-50 border-2 border-primary-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Add to {selectedCount} selected task{selectedCount !== 1 ? 's' : ''}:
                  </span>
                  <div className="flex-1 relative personnel-dropdown-container">
                    <input
                      type="text"
                      value={personnelSearch}
                      onChange={(e) => {
                        setPersonnelSearch(e.target.value)
                        setShowPersonnelDropdown(true)
                        setActiveTaskIndex(null) // Bulk mode
                      }}
                      onFocus={() => {
                        setShowPersonnelDropdown(true)
                        setActiveTaskIndex(null)
                      }}
                      placeholder="Type name to search..."
                      className="input text-sm py-1.5 w-full"
                    />
                    {showPersonnelDropdown && activeTaskIndex === null && filteredPersonnel.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredPersonnel.map((person) => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => {
                              bulkAssignToSelected(person.userId || person.id)
                              setPersonnelSearch('')
                              setShowPersonnelDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                          >
                            {person.rank && `${person.rank} `}
                            {person.lastName}, {person.firstName}
                            {person.squad && <span className="text-gray-500 ml-1">({person.squad})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedAssignments}
                    className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
                  >
                    Clear Assignments
                  </button>
                </div>
              </div>
            )}

            {/* Select All Header Checkbox */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-t-lg">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={() => {
                  if (allFilteredSelected) {
                    deselectAllFilteredTasks()
                  } else {
                    selectAllFilteredTasks()
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-600">
                {selectedCount} tasks selected | {totalAssignments} total assignments
              </span>
            </div>

            <div className="border border-t-0 border-gray-200 rounded-b-lg max-h-96 overflow-y-auto">
              {/* Group by area */}
              {uniqueAreas
                .filter(area => !areaFilter || area.id === areaFilter)
                .map((area) => {
                  const areaTasks = filteredTasks.filter(t => t.areaId === area.id)
                  if (areaTasks.length === 0) return null

                  return (
                    <div key={area.id} className="border-b border-gray-200 last:border-b-0">
                      <div className="bg-gray-50 px-3 py-2 sticky top-0">
                        <h4 className="text-sm font-medium text-gray-900">{area.name}</h4>
                      </div>
                      {areaTasks.map((task) => {
                        const taskIndex = taskAssignments.findIndex(
                          t => t.taskId === task.taskId && t.location === task.location
                        )
                        if (taskIndex === -1) return null

                        return (
                          <div
                            key={`${task.taskId}-${task.location}`}
                            className={`px-3 py-2 border-t border-gray-100 ${
                              task.selected ? 'bg-primary-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={task.selected}
                                onChange={() => toggleTaskSelection(taskIndex)}
                                className="mt-1 w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="text-sm text-gray-900">
                                      {task.taskText}
                                      {task.criticalFailure && (
                                        <span className="ml-1 text-red-600 font-medium">*</span>
                                      )}
                                    </div>

                                    {/* Assigned personnel chips */}
                                    {task.assignedTo.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {task.assignedTo.map((person) => (
                                          <span
                                            key={person.personnelId}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-800 rounded-full text-xs"
                                          >
                                            {person.name}
                                            <button
                                              type="button"
                                              onClick={() => removePersonFromTask(taskIndex, person.personnelId)}
                                              className="text-primary-600 hover:text-primary-800"
                                            >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Add person autocomplete */}
                                    {task.selected && (
                                      <div className="mt-2 relative personnel-dropdown-container">
                                        <input
                                          type="text"
                                          placeholder="+ Add person..."
                                          className="input text-xs py-1 px-2 w-full max-w-[200px]"
                                          onFocus={() => {
                                            setActiveTaskIndex(taskIndex)
                                            setShowPersonnelDropdown(true)
                                            setPersonnelSearch('')
                                          }}
                                          onChange={(e) => {
                                            setPersonnelSearch(e.target.value)
                                            setActiveTaskIndex(taskIndex)
                                            setShowPersonnelDropdown(true)
                                          }}
                                          value={activeTaskIndex === taskIndex ? personnelSearch : ''}
                                        />
                                        {showPersonnelDropdown && activeTaskIndex === taskIndex && filteredPersonnel.length > 0 && (
                                          <div className="absolute z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                            {filteredPersonnel.map((person) => (
                                              <button
                                                key={person.id}
                                                type="button"
                                                onClick={() => addPersonToTask(taskIndex, person)}
                                                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                                              >
                                                {person.rank && `${person.rank} `}
                                                {person.lastName}, {person.firstName}
                                                {person.squad && <span className="text-gray-500 ml-1">({person.squad})</span>}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500 whitespace-nowrap bg-gray-100 px-2 py-0.5 rounded">
                                    {task.location}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
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
              {saving ? 'Creating Assignment...' : `Create ${totalAssignments} Assignment${totalAssignments !== 1 ? 's' : ''}`}
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
