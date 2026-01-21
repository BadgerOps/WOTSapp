import { useState, useRef } from 'react'
import { useDocumentActions } from '../../hooks/useDocuments'

const categories = [
  'General',
  'Policies',
  'Training Materials',
  'Schedules',
  'Forms',
  'References',
]

export default function DocumentUpload() {
  const { uploadDocument, loading, error, progress } = useDocumentActions()
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return

    setSuccess(false)

    try {
      await uploadDocument(file, { name, category })
      setFile(null)
      setName('')
      setCategory('General')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      // Error is handled by the hook
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Document uploaded successfully!
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            File
          </label>
          <input
            ref={fileInputRef}
            id="file"
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
            required
          />
          {file && (
            <p className="mt-1 text-sm text-gray-500">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Enter display name"
            required
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {loading && progress > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </form>
  )
}
