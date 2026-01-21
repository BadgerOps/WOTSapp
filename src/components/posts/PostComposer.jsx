import { useState, useEffect } from 'react'
import { usePostActions } from '../../hooks/usePosts'
import { useUniforms } from '../../hooks/useUniforms'

const postTypes = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'uotd', label: 'UOTD (Uniform of the Day)' },
  { value: 'schedule', label: 'Schedule Update' },
  { value: 'general', label: 'General' },
]

export default function PostComposer({ editPost = null, onCancel = null, onSaved = null }) {
  const { createPost, updatePost, loading, error } = usePostActions()
  const { uniforms, loading: uniformsLoading } = useUniforms()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState('general')
  const [status, setStatus] = useState('published')
  const [selectedUniformId, setSelectedUniformId] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [success, setSuccess] = useState(false)

  const isEditing = !!editPost

  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title || '')
      setContent(editPost.content || '')
      setType(editPost.type || 'general')
      setStatus(editPost.status || 'published')
      setAdminNote(editPost.adminNote || '')
      setSelectedUniformId('')
    } else {
      setTitle('')
      setContent('')
      setType('general')
      setStatus('published')
      setAdminNote('')
      setSelectedUniformId('')
    }
  }, [editPost])

  // When uniform is selected, auto-fill title and content
  function handleUniformSelect(uniformId) {
    setSelectedUniformId(uniformId)

    if (!uniformId) {
      // Cleared selection - reset to empty if not editing
      if (!isEditing) {
        setTitle('')
        setContent('')
      }
      return
    }

    const uniform = uniforms.find((u) => u.id === uniformId)
    if (uniform) {
      setTitle(`UOTD: ${uniform.number} - ${uniform.name}`)
      setContent(uniform.description || `Today's uniform is ${uniform.number} - ${uniform.name}`)
    }
  }

  // Reset uniform selection when type changes away from uotd
  useEffect(() => {
    if (type !== 'uotd') {
      setSelectedUniformId('')
    }
  }, [type])

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccess(false)

    try {
      if (isEditing) {
        await updatePost(editPost.id, { title, content, type, status, adminNote })
      } else {
        await createPost({ title, content, type, status, adminNote })
      }

      if (!isEditing) {
        setTitle('')
        setContent('')
        setType('general')
        setStatus('published')
        setAdminNote('')
        setSelectedUniformId('')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

      if (onSaved) {
        onSaved()
      }
    } catch (err) {
      // Error is handled by the hook
    }
  }

  function handleCancel() {
    setTitle('')
    setContent('')
    setType('general')
    setStatus('published')
    setAdminNote('')
    setSelectedUniformId('')
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit Post' : 'Create New Post'}
        </h2>
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {isEditing ? 'Post updated successfully!' : 'Post created successfully!'}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Post Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input"
            >
              {postTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* UOTD Uniform Selector */}
        {type === 'uotd' && (
          <div>
            <label htmlFor="uniform" className="block text-sm font-medium text-gray-700 mb-1">
              Select Uniform
            </label>
            <select
              id="uniform"
              value={selectedUniformId}
              onChange={(e) => handleUniformSelect(e.target.value)}
              className="input"
              disabled={uniformsLoading}
            >
              <option value="">-- Select a uniform --</option>
              {uniforms.map((uniform) => (
                <option key={uniform.id} value={uniform.id}>
                  {uniform.number} - {uniform.name}
                </option>
              ))}
            </select>
            {selectedUniformId && (
              <p className="mt-1 text-sm text-gray-500">
                {uniforms.find((u) => u.id === selectedUniformId)?.description}
              </p>
            )}
            {uniforms.length === 0 && !uniformsLoading && (
              <p className="mt-1 text-sm text-yellow-600">
                No uniforms defined. Add uniforms in the Uniforms tab first.
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Enter post title"
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input min-h-[150px]"
            placeholder="Enter post content"
            required
          />
        </div>

        <div>
          <label htmlFor="adminNote" className="block text-sm font-medium text-gray-700 mb-1">
            Admin Note <span className="text-gray-500 font-normal">(Optional)</span>
          </label>
          <textarea
            id="adminNote"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="input min-h-[80px]"
            placeholder="Optional note for push notification (e.g., 'Bring rain gear' or 'Formation at 0800')"
          />
          <p className="mt-1 text-xs text-gray-500">
            This note will appear at the bottom of push notifications to provide additional context
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !title.trim() || !content.trim()}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : isEditing ? 'Update Post' : 'Publish Post'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
