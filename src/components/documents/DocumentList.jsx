import { useDocuments } from '../../hooks/useDocuments'
import Loading from '../common/Loading'
import { format } from 'date-fns'

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileIcon(mimeType) {
  if (mimeType?.includes('pdf')) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18c-.55 0-1-.45-1-1s.45-1 1-1h1.5v-1H8.5c-.55 0-1-.45-1-1s.45-1 1-1H11v-1H8.5c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-4z" />
      </svg>
    )
  }
  return (
    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z" />
    </svg>
  )
}

export default function DocumentList() {
  const { documents, loading, error } = useDocuments()

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="card text-center py-8">
        <p className="text-red-600">Error loading documents: {error}</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="card text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-500">No documents yet</p>
      </div>
    )
  }

  const groupedDocs = documents.reduce((acc, doc) => {
    const category = doc.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(doc)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(groupedDocs).map(([category, docs]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{category}</h3>
          <div className="space-y-2">
            {docs.map((doc) => {
              const createdAt = doc.createdAt?.toDate
                ? doc.createdAt.toDate()
                : new Date(doc.createdAt)

              return (
                <a
                  key={doc.id}
                  href={doc.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  {getFileIcon(doc.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.fileSize)} • {format(createdAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
