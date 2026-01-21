import DocumentList from '../components/documents/DocumentList'

export default function Documents() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-600">Access important class documents and resources</p>
      </div>

      <DocumentList />
    </div>
  )
}
