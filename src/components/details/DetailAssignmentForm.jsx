import { useState, useEffect } from 'react'
import { useDetailTemplates } from '../../hooks/useDetailTemplates'
import { useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import { useDetailConfig } from '../../hooks/useDetailConfig'
import PersonnelSelector from './PersonnelSelector'

export default function DetailAssignmentForm() {
  const { templates, loading: templatesLoading } = useDetailTemplates()
  const { config } = useDetailConfig()
  const { createAssignment, loading: saving } = useDetailAssignmentActions()

  const [templateId, setTemplateId] = useState('')
  const [assignmentDate, setAssignmentDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('morning')
  const [morningTime, setMorningTime] = useState('08:00')
  const [eveningTime, setEveningTime] = useState('18:00')
  const [assignmentType, setAssignmentType] = useState('individual')
  const [selectedPersonnel, setSelectedPersonnel] = useState([])
  const [selectedSquad, setSelectedSquad] = useState('')
  const [selectedFlight, setSelectedFlight] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Load default times from config
  useEffect(() => {
    if (config) {
      setMorningTime(config.morningStartTime || '08:00')
      setEveningTime(config.eveningStartTime || '18:00')
    }
  }, [config])

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setAssignmentDate(today)
  }, [])

  function resetForm() {
    setTemplateId('')
    const today = new Date().toISOString().split('T')[0]
    setAssignmentDate(today)
    setTimeSlot('morning')
    setMorningTime(config?.morningStartTime || '08:00')
    setEveningTime(config?.eveningStartTime || '18:00')
    setAssignmentType('individual')
    setSelectedPersonnel([])
    setSelectedSquad('')
    setSelectedFlight('')
    setNotes('')
    setFormError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    // Validation
    if (!templateId) {
      setFormError('Please select a template')
      return
    }

    if (!assignmentDate) {
      setFormError('Please select a date')
      return
    }

    if (selectedPersonnel.length === 0) {
      setFormError('Please select at least one person or group')
      return
    }

    try {
      const selectedTemplate = templates.find(t => t.id === templateId)

      const assignmentData = {
        templateId,
        templateName: selectedTemplate.name,
        assignmentDate,
        timeSlot,
        morningTime,
        eveningTime,
        assignmentType,
        assignedTo: selectedPersonnel,
        squad: assignmentType === 'squad' ? selectedSquad : null,
        flight: assignmentType === 'flight' ? selectedFlight : null,
        notes,
      }

      await createAssignment(assignmentData)
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message)
    }
  }

  if (templatesLoading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">Loading templates...</p>
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

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Detail Assignment</h2>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Detail assignment created successfully!
        </div>
      )}

      <div className="space-y-4">
        {/* Template Selection */}
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
            <option value="">-- Select a template --</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Assignment Date
            </label>
            <input
              id="date"
              type="date"
              value={assignmentDate}
              onChange={(e) => setAssignmentDate(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Slot
            </label>
            <div className="flex gap-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timeSlot"
                  value="morning"
                  checked={timeSlot === 'morning'}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Morning</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timeSlot"
                  value="evening"
                  checked={timeSlot === 'evening'}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Evening</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timeSlot"
                  value="both"
                  checked={timeSlot === 'both'}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Both</span>
              </label>
            </div>
          </div>
        </div>

        {/* Time Customization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="morningTime" className="block text-sm font-medium text-gray-700 mb-1">
              Morning Start Time
            </label>
            <input
              id="morningTime"
              type="time"
              value={morningTime}
              onChange={(e) => setMorningTime(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="eveningTime" className="block text-sm font-medium text-gray-700 mb-1">
              Evening Start Time
            </label>
            <input
              id="eveningTime"
              type="time"
              value={eveningTime}
              onChange={(e) => setEveningTime(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Assignment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assignment Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="assignmentType"
                value="individual"
                checked={assignmentType === 'individual'}
                onChange={(e) => {
                  setAssignmentType(e.target.value)
                  setSelectedPersonnel([])
                  setSelectedSquad('')
                  setSelectedFlight('')
                }}
                className="mr-2"
              />
              <span className="text-sm">Individual</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="assignmentType"
                value="squad"
                checked={assignmentType === 'squad'}
                onChange={(e) => {
                  setAssignmentType(e.target.value)
                  setSelectedPersonnel([])
                  setSelectedFlight('')
                }}
                className="mr-2"
              />
              <span className="text-sm">Squad</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="assignmentType"
                value="flight"
                checked={assignmentType === 'flight'}
                onChange={(e) => {
                  setAssignmentType(e.target.value)
                  setSelectedPersonnel([])
                  setSelectedSquad('')
                }}
                className="mr-2"
              />
              <span className="text-sm">Flight</span>
            </label>
          </div>
        </div>

        {/* Personnel Selector */}
        <PersonnelSelector
          assignmentType={assignmentType}
          selectedPersonnel={selectedPersonnel}
          onChange={setSelectedPersonnel}
          selectedSquad={selectedSquad}
          selectedFlight={selectedFlight}
          onSquadChange={setSelectedSquad}
          onFlightChange={setSelectedFlight}
        />

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[80px]"
            placeholder="Any special instructions or notes for this assignment"
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving || selectedPersonnel.length === 0}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating Assignment...' : 'Create Assignment'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="btn-secondary"
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  )
}
