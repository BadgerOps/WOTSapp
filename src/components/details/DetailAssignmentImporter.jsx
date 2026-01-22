import { useState, useRef } from 'react'
import { useDetailTemplates } from '../../hooks/useDetailTemplates'
import { useDetailAssignmentActions } from '../../hooks/useDetailAssignments'
import { usePersonnel } from '../../hooks/usePersonnel'

// Map CSV area names to template area IDs
const AREA_MAPPING = {
  'stairwells/hallways': 'stairwells-hallways',
  'stairwells-hallways': 'stairwells-hallways',
  'supply rooms': 'supply-rooms',
  'supply-rooms': 'supply-rooms',
  'laundry rooms': 'laundry-rooms',
  'laundry-rooms': 'laundry-rooms',
  'classrooms': 'classrooms',
  'conference room': 'conference-room',
  'conference-room': 'conference-room',
  'building exterior': 'building-exterior',
  'building-exterior': 'building-exterior',
  'latrine/sink areas': 'latrine-sink',
  'latrine-sink': 'latrine-sink',
  'latrines/sink areas': 'latrine-sink',
  'bulletin board': 'bulletin-board',
  'bulletin-board': 'bulletin-board',
}

function normalizeAreaName(areaName) {
  const normalized = areaName.toLowerCase().trim()
  return AREA_MAPPING[normalized] || normalized
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row')
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const areaIndex = header.indexOf('area')
  const lastNameIndex = header.indexOf('lastname')

  if (areaIndex === -1 || lastNameIndex === -1) {
    throw new Error('CSV must have "Area" and "LastName" columns')
  }

  const assignments = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle quoted values with commas
    const values = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    if (values.length > Math.max(areaIndex, lastNameIndex)) {
      assignments.push({
        area: normalizeAreaName(values[areaIndex]),
        lastName: values[lastNameIndex].trim(),
        row: i + 1,
      })
    }
  }

  return assignments
}

export default function DetailAssignmentImporter() {
  const { templates, loading: templatesLoading } = useDetailTemplates()
  const { personnel, loading: personnelLoading } = usePersonnel()
  const { createAssignment, loading: saving } = useDetailAssignmentActions()

  const [templateId, setTemplateId] = useState('')
  const [timeSlot, setTimeSlot] = useState('both')
  const [csvData, setCsvData] = useState(null)
  const [parsedAssignments, setParsedAssignments] = useState([])
  const [matchResults, setMatchResults] = useState([])
  const [importError, setImportError] = useState(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef(null)

  const eligiblePersonnel = personnel?.filter(p => p.detailEligible !== false) || []

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return

    setImportError(null)
    setSuccess(false)
    setParsedAssignments([])
    setMatchResults([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const assignments = parseCSV(text)
        setCsvData(text)
        setParsedAssignments(assignments)
        matchPersonnel(assignments)
      } catch (err) {
        setImportError(err.message)
        setCsvData(null)
        setParsedAssignments([])
      }
    }
    reader.onerror = () => {
      setImportError('Failed to read file')
    }
    reader.readAsText(file)
  }

  function matchPersonnel(assignments) {
    const results = assignments.map(assignment => {
      // Find personnel by last name (case-insensitive)
      const matchedPerson = eligiblePersonnel.find(
        p => p.lastName?.toLowerCase() === assignment.lastName.toLowerCase()
      )

      return {
        ...assignment,
        matched: !!matchedPerson,
        person: matchedPerson ? {
          personnelId: matchedPerson.userId || matchedPerson.id,
          name: `${matchedPerson.rank || ''} ${matchedPerson.firstName} ${matchedPerson.lastName}`.trim(),
          rank: matchedPerson.rank || '',
          email: matchedPerson.email,
        } : null,
      }
    })

    setMatchResults(results)
  }

  async function handleImport() {
    if (!templateId) {
      setImportError('Please select a template')
      return
    }

    const template = templates.find(t => t.id === templateId)
    if (!template) {
      setImportError('Template not found')
      return
    }

    // Group assignments by area
    const areaAssignments = {}
    matchResults.filter(r => r.matched).forEach(result => {
      if (!areaAssignments[result.area]) {
        areaAssignments[result.area] = []
      }
      areaAssignments[result.area].push(result.person)
    })

    // Build task assignments from template
    const tasks = []
    template.areas.forEach(area => {
      const areaId = area.id
      const assignedPersonnel = areaAssignments[areaId] || []

      if (assignedPersonnel.length === 0) return

      area.items.forEach(item => {
        const locations = area.locations && area.locations.length > 0
          ? area.locations
          : ['All']

        locations.forEach((location, locIdx) => {
          // Round-robin assign personnel to locations
          const assignedPerson = assignedPersonnel[locIdx % assignedPersonnel.length]

          tasks.push({
            taskId: item.id,
            taskText: item.text,
            areaName: area.name,
            areaId: area.id,
            location: location,
            criticalFailure: item.criticalFailure,
            assignedTo: assignedPerson,
            completed: false,
            completedAt: null,
            notes: '',
          })
        })
      })
    })

    if (tasks.length === 0) {
      setImportError('No tasks could be assigned. Check that area names match the template.')
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]

      const assignmentData = {
        templateId,
        templateName: template.name,
        assignmentDate: today,
        timeSlot,
        recurring: true,
        tasks,
        assignedTo: Array.from(
          new Map(tasks.map(t => [t.assignedTo.personnelId, t.assignedTo])).values()
        ),
        importedFromCSV: true,
      }

      await createAssignment(assignmentData)

      // Reset form
      setSuccess(true)
      setCsvData(null)
      setParsedAssignments([])
      setMatchResults([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      setImportError(err.message)
    }
  }

  function clearImport() {
    setCsvData(null)
    setParsedAssignments([])
    setMatchResults([])
    setImportError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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

  const matchedCount = matchResults.filter(r => r.matched).length
  const unmatchedCount = matchResults.filter(r => !r.matched).length
  const uniqueAreas = [...new Set(matchResults.map(r => r.area))]

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Detail Assignments from CSV</h2>

      {importError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {importError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Detail assignments imported successfully! {matchedCount} personnel assigned to tasks.
        </div>
      )}

      <div className="space-y-4">
        {/* Template and Time Slot Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="importTemplate" className="block text-sm font-medium text-gray-700 mb-1">
              Checklist Template
            </label>
            <select
              id="importTemplate"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="input"
            >
              <option value="">-- Select Template --</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="importTimeSlot" className="block text-sm font-medium text-gray-700 mb-1">
              Time Slot
            </label>
            <select
              id="importTimeSlot"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="input"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSV File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            CSV must have "Area" and "LastName" columns. Areas: Stairwells/Hallways, Supply Rooms,
            Classrooms, Conference Room, Building Exterior, Laundry Rooms, Latrine/Sink Areas, Bulletin Board
          </p>
        </div>

        {/* Preview Results */}
        {matchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-900">Import Preview</h3>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">{matchedCount} matched</span>
                  {unmatchedCount > 0 && (
                    <span className="text-red-600">{unmatchedCount} unmatched</span>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {uniqueAreas.map(area => {
                const areaResults = matchResults.filter(r => r.area === area)
                return (
                  <div key={area} className="border-b border-gray-100 last:border-b-0">
                    <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                      {area}
                    </div>
                    {areaResults.map((result, idx) => (
                      <div
                        key={`${result.area}-${result.lastName}-${idx}`}
                        className={`px-4 py-2 flex justify-between items-center ${
                          result.matched ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <span className="text-sm">{result.lastName}</span>
                        {result.matched ? (
                          <span className="text-xs text-green-700">
                            → {result.person.name}
                          </span>
                        ) : (
                          <span className="text-xs text-red-600">Not found</span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {matchResults.length > 0 && (
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleImport}
              disabled={saving || matchedCount === 0 || !templateId}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Importing...' : `Import ${matchedCount} Assignments`}
            </button>
            <button
              type="button"
              onClick={clearImport}
              className="btn-secondary"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
