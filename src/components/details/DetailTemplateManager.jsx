import { useState } from 'react'
import { useDetailTemplates, useDetailTemplateActions } from '../../hooks/useDetailTemplates'
import Loading from '../common/Loading'
import { getDefaultWOTSTemplate } from '../../lib/defaultDetailTemplate'

export default function DetailTemplateManager() {
  const { templates, loading, error } = useDetailTemplates()
  const { createTemplate, updateTemplate, deleteTemplate, loading: saving } = useDetailTemplateActions()

  const [editingId, setEditingId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showEditor, setShowEditor] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [areas, setAreas] = useState([])
  const [failureThreshold, setFailureThreshold] = useState(2)
  const [requiresApproval, setRequiresApproval] = useState(true)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  function resetForm() {
    setName('')
    setDescription('')
    setAreas([])
    setFailureThreshold(2)
    setRequiresApproval(true)
    setEditingId(null)
    setFormError(null)
    setShowEditor(false)
  }

  function handleEdit(template) {
    setEditingId(template.id)
    setName(template.name || '')
    setDescription(template.description || '')
    setAreas(template.areas || [])
    setFailureThreshold(template.failureThreshold || 2)
    setRequiresApproval(template.requiresApproval !== false)
    setFormError(null)
    setSuccess(false)
    setShowEditor(true)
  }

  async function handleLoadDefault() {
    const defaultTemplate = getDefaultWOTSTemplate()
    setName(defaultTemplate.name)
    setDescription(defaultTemplate.description)
    setAreas(defaultTemplate.areas)
    setFailureThreshold(defaultTemplate.failureThreshold)
    setRequiresApproval(defaultTemplate.requiresApproval)
    setShowEditor(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    if (!name.trim()) {
      setFormError('Template name is required')
      return
    }

    if (areas.length === 0) {
      setFormError('At least one area is required')
      return
    }

    try {
      const templateData = {
        name: name.trim(),
        description: description.trim(),
        areas,
        failureThreshold,
        requiresApproval,
      }

      if (editingId) {
        await updateTemplate(editingId, templateData)
      } else {
        await createTemplate(templateData)
      }
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function handleDelete(templateId) {
    try {
      await deleteTemplate(templateId)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  function addArea() {
    setAreas([
      ...areas,
      {
        id: `area-${Date.now()}`,
        name: '',
        areaNumber: areas.length + 1,
        locations: [],
        items: [],
        demeritLimit: 4,
        order: areas.length,
      },
    ])
  }

  function updateArea(index, field, value) {
    const newAreas = [...areas]
    newAreas[index] = { ...newAreas[index], [field]: value }
    setAreas(newAreas)
  }

  function removeArea(index) {
    setAreas(areas.filter((_, i) => i !== index))
  }

  function addItem(areaIndex) {
    const newAreas = [...areas]
    newAreas[areaIndex].items.push({
      id: `item-${Date.now()}`,
      text: '',
      criticalFailure: false,
      order: newAreas[areaIndex].items.length,
    })
    setAreas(newAreas)
  }

  function updateItem(areaIndex, itemIndex, field, value) {
    const newAreas = [...areas]
    newAreas[areaIndex].items[itemIndex] = {
      ...newAreas[areaIndex].items[itemIndex],
      [field]: value,
    }
    setAreas(newAreas)
  }

  function removeItem(areaIndex, itemIndex) {
    const newAreas = [...areas]
    newAreas[areaIndex].items = newAreas[areaIndex].items.filter((_, i) => i !== itemIndex)
    setAreas(newAreas)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      {!showEditor && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowEditor(true)}
            className="btn-primary"
          >
            Create New Template
          </button>
          <button
            onClick={handleLoadDefault}
            className="btn-secondary"
          >
            Load Default WOTS Template
          </button>
        </div>
      )}

      {/* Template Editor */}
      {showEditor && (
        <form onSubmit={handleSubmit} className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Template' : 'Create New Template'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {editingId ? 'Template updated!' : 'Template created!'}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="e.g., Dormitory Daily Inspection"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Describe this checklist template"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="failureThreshold" className="block text-sm font-medium text-gray-700 mb-1">
                    Area Failure Threshold
                  </label>
                  <input
                    id="failureThreshold"
                    type="number"
                    min="1"
                    value={failureThreshold}
                    onChange={(e) => setFailureThreshold(parseInt(e.target.value))}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    More than this many failed areas = Unsatisfactory
                  </p>
                </div>

                <div className="flex items-center pt-6">
                  <input
                    id="requiresApproval"
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="requiresApproval" className="text-sm text-gray-700">
                    Requires admin approval
                  </label>
                </div>
              </div>
            </div>

            {/* Areas */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-gray-900">Checklist Areas</h3>
                <button
                  type="button"
                  onClick={addArea}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add Area
                </button>
              </div>

              {areas.length === 0 && (
                <p className="text-sm text-gray-500 italic py-4">
                  No areas added yet. Click "Add Area" to start building your checklist.
                </p>
              )}

              <div className="space-y-4">
                {areas.map((area, areaIndex) => (
                  <div key={area.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">Area {areaIndex + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeArea(areaIndex)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            value={area.name}
                            onChange={(e) => updateArea(areaIndex, 'name', e.target.value)}
                            className="input text-sm"
                            placeholder="Area name (e.g., Stairwells/Hallways)"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={area.demeritLimit}
                            onChange={(e) => updateArea(areaIndex, 'demeritLimit', parseInt(e.target.value))}
                            className="input text-sm"
                            placeholder="Demerit limit"
                            min="1"
                          />
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={area.locations?.join(', ') || ''}
                          onChange={(e) => updateArea(areaIndex, 'locations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          className="input text-sm"
                          placeholder="Locations (comma-separated, e.g., 1st Floor, 2d Floor, 3d Floor)"
                        />
                      </div>

                      {/* Items */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-gray-700">Checklist Items</label>
                          <button
                            type="button"
                            onClick={() => addItem(areaIndex)}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            + Add Item
                          </button>
                        </div>

                        {area.items.length === 0 && (
                          <p className="text-xs text-gray-500 italic py-2">No items yet</p>
                        )}

                        <div className="space-y-2">
                          {area.items.map((item, itemIndex) => (
                            <div key={item.id} className="flex gap-2 items-start">
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) => updateItem(areaIndex, itemIndex, 'text', e.target.value)}
                                className="input text-xs flex-1"
                                placeholder="Item description"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex items-center text-xs text-gray-600 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={item.criticalFailure}
                                    onChange={(e) => updateItem(areaIndex, itemIndex, 'criticalFailure', e.target.checked)}
                                    className="mr-1"
                                  />
                                  Critical*
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeItem(areaIndex, itemIndex)}
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Templates List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Templates</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-4">
            No templates yet. Create one or load the default WOTS template.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>{template.areas?.length || 0} areas</span>
                    <span>Threshold: {template.failureThreshold} failed areas</span>
                    <span>{template.requiresApproval ? 'Requires approval' : 'Auto-approved'}</span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(template)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1"
                  >
                    Edit
                  </button>

                  {deleteConfirm === template.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={saving}
                        className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-sm text-gray-600 hover:text-gray-700 px-3 py-1"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(template.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
