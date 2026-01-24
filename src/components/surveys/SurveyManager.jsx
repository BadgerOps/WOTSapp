import { useState } from 'react'
import { useAllSurveys, useSurveyActions } from '../../hooks/useSurveys'
import Loading from '../common/Loading'
import { format } from 'date-fns'

export default function SurveyManager({ onEdit, onViewResults }) {
  const { surveys, loading, error } = useAllSurveys()
  const { deleteSurvey, publishSurvey, closeSurvey, loading: saving } = useSurveyActions()
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [filter, setFilter] = useState('all')

  async function handleDelete(surveyId) {
    try {
      await deleteSurvey(surveyId)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete survey:', err)
    }
  }

  async function handlePublish(surveyId) {
    try {
      await publishSurvey(surveyId)
    } catch (err) {
      console.error('Failed to publish survey:', err)
    }
  }

  async function handleClose(surveyId) {
    try {
      await closeSurvey(surveyId)
    } catch (err) {
      console.error('Failed to close survey:', err)
    }
  }

  if (loading) {
    return <Loading />
  }

  const filteredSurveys = surveys.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`badge ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTypeBadge = (type) => {
    const styles = {
      survey: 'bg-blue-100 text-blue-800',
      quiz: 'bg-purple-100 text-purple-800',
      poll: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`badge ${styles[type] || styles.survey}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Manage Surveys</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input py-1.5 text-sm"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card text-center py-4 text-red-600">Error loading surveys: {error}</div>
      )}

      {filteredSurveys.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No surveys yet. Create your first survey above.'
              : `No ${filter} surveys found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSurveys.map((survey) => (
            <div key={survey.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-medium text-gray-900">{survey.title}</h4>
                    {getTypeBadge(survey.type)}
                    {getStatusBadge(survey.status)}
                  </div>
                  {survey.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">{survey.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{survey.questions?.length || 0} questions</span>
                    <span>{survey.responseCount || 0} responses</span>
                    {survey.createdAt && (
                      <span>
                        Created{' '}
                        {format(
                          survey.createdAt.toDate ? survey.createdAt.toDate() : survey.createdAt,
                          'MMM d, yyyy'
                        )}
                      </span>
                    )}
                    <span>by {survey.createdByName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Results */}
                  <button
                    onClick={() => onViewResults(survey)}
                    className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    Results
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => onEdit(survey)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Edit
                  </button>

                  {/* Publish/Close */}
                  {survey.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(survey.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}
                  {survey.status === 'published' && (
                    <button
                      onClick={() => handleClose(survey.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}

                  {/* Delete */}
                  {deleteConfirm === survey.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(survey.id)}
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
                      onClick={() => setDeleteConfirm(survey.id)}
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
  )
}
