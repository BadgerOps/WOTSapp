import { useState } from 'react'
import { usePersonnelActions } from '../../hooks/usePersonnel'
import { useAppConfig } from '../../hooks/useAppConfig'
import { useAuth } from '../../contexts/AuthContext'
import { isValidEmail, isValidPhoneNumber, isValidClassFormat } from '../../lib/personnelCsvParser'
import { ROLES, ROLE_INFO, ROLE_HIERARCHY } from '../../lib/roles'

export default function PersonnelAddForm({ onSuccess }) {
  const { createPersonnel, loading } = usePersonnelActions()
  const { config } = useAppConfig()
  const { canManageRoles } = useAuth()
  const [formData, setFormData] = useState({
    rosterId: '',
    email: '',
    firstName: '',
    lastName: '',
    rank: '',
    phoneNumber: '',
    class: '',
    flight: '',
    squad: '',
    role: ROLES.USER,
    detailEligible: true,
    cqEligible: true,
  })
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
    setSuccess(false)
  }

  function validate() {
    const newErrors = {}

    if (!formData.rosterId) {
      newErrors.rosterId = 'Roster ID is required'
    } else if (isNaN(parseInt(formData.rosterId, 10)) || parseInt(formData.rosterId, 10) <= 0) {
      newErrors.rosterId = 'Roster ID must be a positive number'
    }

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (formData.phoneNumber && !isValidPhoneNumber(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number format'
    }

    if (formData.class && !isValidClassFormat(formData.class)) {
      newErrors.class = 'Invalid format. Use NN-NN (e.g., 26-03)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaveError(null)
    setSuccess(false)

    if (!validate()) return

    try {
      await createPersonnel({
        rosterId: parseInt(formData.rosterId, 10),
        email: formData.email.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        rank: formData.rank.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        class: formData.class.trim(),
        flight: formData.flight,
        squad: formData.squad.trim(),
        role: formData.role,
        detailEligible: formData.detailEligible,
        cqEligible: formData.cqEligible,
      })

      // Reset form on success
      setFormData({
        rosterId: '',
        email: '',
        firstName: '',
        lastName: '',
        rank: '',
        phoneNumber: '',
        class: '',
        flight: '',
        squad: '',
        role: ROLES.USER,
        detailEligible: true,
        cqEligible: true,
      })
      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      setSaveError(err.message)
    }
  }

  const flights = config?.flights || ['Barrow', 'Long', 'Brow']
  const classes = config?.classes || []

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Personnel</h2>
      <p className="text-sm text-gray-600 mb-6">
        Manually add individual personnel records. For bulk imports, use the Import tab.
      </p>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {saveError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Personnel added successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Roster ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Roster ID <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="rosterId"
              value={formData.rosterId}
              onChange={handleChange}
              placeholder="e.g., 1, 2, 3..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.rosterId ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.rosterId && <p className="text-red-600 text-xs mt-1">{errors.rosterId}</p>}
          </div>

          {/* Rank */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rank</label>
            <input
              type="text"
              name="rank"
              value={formData.rank}
              onChange={handleChange}
              placeholder="e.g., A1C, SrA, SSgt"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.email ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.firstName ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.firstName && <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.lastName ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.lastName && <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>}
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="555-555-0100"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.phoneNumber ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.phoneNumber && <p className="text-red-600 text-xs mt-1">{errors.phoneNumber}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            {classes.length > 0 ? (
              <select
                name="class"
                value={formData.class}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.class ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                name="class"
                value={formData.class}
                onChange={handleChange}
                placeholder="NN-NN (e.g., 26-03)"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.class ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            )}
            {errors.class && <p className="text-red-600 text-xs mt-1">{errors.class}</p>}
          </div>

          {/* Flight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Flight</label>
            <select
              name="flight"
              value={formData.flight}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select flight...</option>
              {flights.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Squad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Squad</label>
            <input
              type="text"
              name="squad"
              value={formData.squad}
              onChange={handleChange}
              placeholder="e.g., Alpha, Bravo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Eligibility Toggles */}
        <div className="flex flex-wrap gap-6 py-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="detailEligible"
              checked={formData.detailEligible}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Detail Eligible</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="cqEligible"
              checked={formData.cqEligible}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">CQ Eligible</span>
          </label>
        </div>

        {/* Role - Only visible to admins with role management permission */}
        {canManageRoles && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {ROLE_HIERARCHY.map(role => {
                const info = ROLE_INFO[role]
                return (
                  <option key={role} value={role}>
                    {info.label} - {info.description}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Role will be applied when this person links their account.
            </p>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Personnel'}
          </button>
        </div>
      </form>
    </div>
  )
}
