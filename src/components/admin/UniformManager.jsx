import { useState } from 'react'
import { useUniforms, useUniformActions } from '../../hooks/useUniforms'
import Loading from '../common/Loading'

export default function UniformManager() {
  const { uniforms, loading, error } = useUniforms()
  const { createUniform, updateUniform, deleteUniform, loading: saving } = useUniformActions()

  const [editingId, setEditingId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Form state
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  function resetForm() {
    setNumber('')
    setName('')
    setDescription('')
    setEditingId(null)
    setFormError(null)
  }

  function handleEdit(uniform) {
    setEditingId(uniform.id)
    setNumber(uniform.number || '')
    setName(uniform.name || '')
    setDescription(uniform.description || '')
    setFormError(null)
    setSuccess(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    if (!number.trim() || !name.trim()) {
      setFormError('Number and name are required')
      return
    }

    try {
      if (editingId) {
        await updateUniform(editingId, { number: number.trim(), name: name.trim(), description: description.trim() })
      } else {
        await createUniform({ number: number.trim(), name: name.trim(), description: description.trim() })
      }
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function handleDelete(uniformId) {
    try {
      await deleteUniform(uniformId)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete uniform:', err)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      <form onSubmit={handleSubmit} className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId ? 'Edit Uniform' : 'Add New Uniform'}
        </h2>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {formError}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {editingId ? 'Uniform updated!' : 'Uniform added!'}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-1">
                Uniform Number
              </label>
              <input
                id="number"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="input"
                placeholder="e.g., 1A"
                required
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g., PT Uniform"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="e.g., Running shoes, PT shorts, unit t-shirt..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Uniform' : 'Add Uniform'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Uniforms List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Uniforms List</h3>

        {error && (
          <div className="card text-center py-4 text-red-600">
            Error loading uniforms: {error}
          </div>
        )}

        {uniforms.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">No uniforms defined yet. Add your first uniform above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uniforms.map((uniform) => (
              <div key={uniform.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-700 font-bold rounded-lg">
                        {uniform.number}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{uniform.name}</p>
                        {uniform.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">{uniform.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(uniform)}
                      className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      Edit
                    </button>

                    {deleteConfirm === uniform.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(uniform.id)}
                          disabled={saving}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(uniform.id)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
