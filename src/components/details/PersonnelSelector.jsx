import { useState, useEffect } from 'react'
import { usePersonnel } from '../../hooks/usePersonnel'

export default function PersonnelSelector({
  assignmentType,
  selectedPersonnel,
  onChange,
  selectedSquad,
  selectedFlight,
  onSquadChange,
  onFlightChange
}) {
  const { personnel, loading } = usePersonnel()
  const [availablePersonnel, setAvailablePersonnel] = useState([])
  const [squads, setSquads] = useState([])
  const [flights, setFlights] = useState([])

  // Extract unique squads and flights from personnel
  useEffect(() => {
    if (personnel) {
      const uniqueSquads = [...new Set(personnel.map(p => p.squad).filter(Boolean))]
      const uniqueFlights = [...new Set(personnel.map(p => p.flight).filter(Boolean))]
      setSquads(uniqueSquads.sort())
      setFlights(uniqueFlights.sort())
    }
  }, [personnel])

  // Filter available personnel based on assignment type
  useEffect(() => {
    if (!personnel) return

    let filtered = personnel.filter(p => p.detailEligible !== false)

    if (assignmentType === 'squad' && selectedSquad) {
      filtered = filtered.filter(p => p.squad === selectedSquad)
    } else if (assignmentType === 'flight' && selectedFlight) {
      filtered = filtered.filter(p => p.flight === selectedFlight)
    }

    setAvailablePersonnel(filtered)

    // Auto-select personnel when squad/flight is selected
    if (assignmentType === 'squad' && selectedSquad) {
      const squadPersonnel = filtered.map(p => ({
        personnelId: p.userId || p.id,
        name: `${p.rank || ''} ${p.firstName} ${p.lastName}`.trim(),
        rank: p.rank || '',
        email: p.email,
      }))
      onChange(squadPersonnel)
    } else if (assignmentType === 'flight' && selectedFlight) {
      const flightPersonnel = filtered.map(p => ({
        personnelId: p.userId || p.id,
        name: `${p.rank || ''} ${p.firstName} ${p.lastName}`.trim(),
        rank: p.rank || '',
        email: p.email,
      }))
      onChange(flightPersonnel)
    }
  }, [personnel, assignmentType, selectedSquad, selectedFlight])

  function togglePerson(person) {
    const personnelData = {
      personnelId: person.userId || person.id,
      name: `${person.rank || ''} ${person.firstName} ${person.lastName}`.trim(),
      rank: person.rank || '',
      email: person.email,
    }

    const isSelected = selectedPersonnel.some(p => p.personnelId === personnelData.personnelId)

    if (isSelected) {
      onChange(selectedPersonnel.filter(p => p.personnelId !== personnelData.personnelId))
    } else {
      onChange([...selectedPersonnel, personnelData])
    }
  }

  function selectAll() {
    const allPersonnel = availablePersonnel.map(p => ({
      personnelId: p.userId || p.id,
      name: `${p.rank || ''} ${p.firstName} ${p.lastName}`.trim(),
      rank: p.rank || '',
      email: p.email,
    }))
    onChange(allPersonnel)
  }

  function clearAll() {
    onChange([])
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading personnel...</div>
  }

  if (assignmentType === 'individual') {
    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Select Personnel
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-600 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>

        {availablePersonnel.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-2">
            No eligible personnel found. Personnel must have detailEligible = true.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
            {availablePersonnel.map((person) => {
              const isSelected = selectedPersonnel.some(
                p => p.personnelId === (person.userId || person.id)
              )
              return (
                <label
                  key={person.id}
                  className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    isSelected ? 'bg-primary-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePerson(person)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {person.rank && <span className="text-gray-600">{person.rank} </span>}
                      {person.firstName} {person.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {person.squad && <span>Squad: {person.squad}</span>}
                      {person.squad && person.flight && <span className="mx-1">•</span>}
                      {person.flight && <span>Flight: {person.flight}</span>}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div className="mt-2 text-xs text-gray-600">
          {selectedPersonnel.length} personnel selected
        </div>
      </div>
    )
  }

  if (assignmentType === 'squad') {
    return (
      <div>
        <div>
          <label htmlFor="squad" className="block text-sm font-medium text-gray-700 mb-1">
            Select Squad
          </label>
          <select
            id="squad"
            value={selectedSquad || ''}
            onChange={(e) => onSquadChange(e.target.value)}
            className="input"
            required
          >
            <option value="">-- Select a squad --</option>
            {squads.map((squad) => (
              <option key={squad} value={squad}>
                {squad}
              </option>
            ))}
          </select>
        </div>

        {selectedSquad && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Personnel in {selectedSquad}:
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {availablePersonnel.map((person) => (
                <div key={person.id}>
                  {person.rank && <span className="font-medium">{person.rank} </span>}
                  {person.firstName} {person.lastName}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {availablePersonnel.length} personnel
            </div>
          </div>
        )}
      </div>
    )
  }

  if (assignmentType === 'flight') {
    return (
      <div>
        <div>
          <label htmlFor="flight" className="block text-sm font-medium text-gray-700 mb-1">
            Select Flight
          </label>
          <select
            id="flight"
            value={selectedFlight || ''}
            onChange={(e) => onFlightChange(e.target.value)}
            className="input"
            required
          >
            <option value="">-- Select a flight --</option>
            {flights.map((flight) => (
              <option key={flight} value={flight}>
                {flight}
              </option>
            ))}
          </select>
        </div>

        {selectedFlight && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Personnel in {selectedFlight}:
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {availablePersonnel.map((person) => (
                <div key={person.id}>
                  {person.rank && <span className="font-medium">{person.rank} </span>}
                  {person.firstName} {person.lastName}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {availablePersonnel.length} personnel
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
