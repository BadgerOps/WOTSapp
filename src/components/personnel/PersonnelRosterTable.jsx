import { useState } from 'react'
import { usePersonnel, usePersonnelActions } from '../../hooks/usePersonnel'
import { useAuth } from '../../contexts/AuthContext'
import PersonnelEditModal from './PersonnelEditModal'

export default function PersonnelRosterTable() {
  const { user } = useAuth()
  const { personnel, loading, error } = usePersonnel()
  const { updatePersonnel, deletePersonnel } = usePersonnelActions()
  const [editingPerson, setEditingPerson] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [linkedFilter, setLinkedFilter] = useState('')

  // Get unique classes and flights for filters
  const uniqueClasses = [...new Set(personnel.map(p => p.class).filter(Boolean))].sort()
  const uniqueFlights = [...new Set(personnel.map(p => p.flight).filter(Boolean))].sort()

  // Calculate linked stats
  const linkedCount = personnel.filter(p => p.userId).length
  const unlinkedCount = personnel.length - linkedCount

  async function handleToggle(person, field) {
    setUpdatingId(person.id)
    try {
      await updatePersonnel(person.id, { [field]: !person[field] })
    } catch (err) {
      console.error(`Error toggling ${field}:`, err)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(personId) {
    if (!confirm('Are you sure you want to delete this personnel record?')) {
      return
    }

    try {
      await deletePersonnel(personId)
    } catch (err) {
      console.error('Error deleting personnel:', err)
    }
  }

  async function handleLinkMyAccount(person) {
    if (!user) return

    if (!confirm(`Link your account to ${person.firstName} ${person.lastName}?`)) {
      return
    }

    setUpdatingId(person.id)
    try {
      await updatePersonnel(person.id, { userId: user.uid })
    } catch (err) {
      console.error('Error linking account:', err)
      alert('Failed to link account: ' + err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  // Filter personnel
  const filteredPersonnel = personnel.filter(person => {
    const matchesSearch = !searchTerm ||
      `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.rank?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesClass = !classFilter || person.class === classFilter
    const matchesFlight = !flightFilter || person.flight === flightFilter
    const matchesLinked = !linkedFilter ||
      (linkedFilter === 'linked' && person.userId) ||
      (linkedFilter === 'unlinked' && !person.userId)

    return matchesSearch && matchesClass && matchesFlight && matchesLinked
  })

  if (loading) {
    return (
      <div className="card">
        <div className="text-center text-gray-600">Loading personnel...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    )
  }

  if (personnel.length === 0) {
    return (
      <div className="card">
        <div className="text-center text-gray-600">
          No personnel records found. Import a CSV file to get started.
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Personnel Roster ({filteredPersonnel.length} of {personnel.length})
        </h2>
        {/* Linked Status Summary */}
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-600">{linkedCount} linked</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-gray-600">{unlinkedCount} unlinked</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, or rank..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>
        {uniqueClasses.length > 0 && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          >
            <option value="">All Classes</option>
            {uniqueClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {uniqueFlights.length > 0 && (
          <select
            value={flightFilter}
            onChange={(e) => setFlightFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          >
            <option value="">All Flights</option>
            {uniqueFlights.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
        <select
          value={linkedFilter}
          onChange={(e) => setLinkedFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
        >
          <option value="">All Status</option>
          <option value="linked">Linked</option>
          <option value="unlinked">Unlinked</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                ID
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Email
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Rank
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Phone
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Class
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Flight
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detail
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                CQ
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPersonnel.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-gray-900 hidden sm:table-cell">
                  {person.rosterId}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${person.userId ? 'bg-green-500' : 'bg-yellow-500'}`} title={person.userId ? 'Account linked' : 'Account not linked'}></span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {person.lastName}, {person.firstName}
                      </div>
                      <div className="sm:hidden text-xs text-gray-500">
                        {person.rank && <span>{person.rank}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 hidden md:table-cell">
                  {person.email}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 hidden sm:table-cell">
                  {person.rank || '-'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 hidden lg:table-cell">
                  {person.phoneNumber || '-'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 hidden md:table-cell">
                  {person.class || '-'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 hidden md:table-cell">
                  {person.flight || '-'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleToggle(person, 'detailEligible')}
                    disabled={updatingId === person.id}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      person.detailEligible
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                    } ${updatingId === person.id ? 'opacity-50' : ''}`}
                    title={person.detailEligible ? 'Detail Eligible - Click to toggle' : 'Not Detail Eligible - Click to toggle'}
                  >
                    {person.detailEligible ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleToggle(person, 'cqEligible')}
                    disabled={updatingId === person.id}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      person.cqEligible
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                    } ${updatingId === person.id ? 'opacity-50' : ''}`}
                    title={person.cqEligible ? 'CQ Eligible - Click to toggle' : 'Not CQ Eligible - Click to toggle'}
                  >
                    {person.cqEligible ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!person.userId && user && person.email === user.email && (
                      <button
                        onClick={() => handleLinkMyAccount(person)}
                        disabled={updatingId === person.id}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium disabled:opacity-50"
                      >
                        Link
                      </button>
                    )}
                    <button
                      onClick={() => setEditingPerson(person)}
                      className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(person.id)}
                      className="text-red-600 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPersonnel.length === 0 && personnel.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          No personnel found matching your filters.
        </div>
      )}

      {/* Edit Modal */}
      {editingPerson && (
        <PersonnelEditModal
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
        />
      )}
    </div>
  )
}
