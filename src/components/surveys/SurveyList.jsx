import { useSurveys } from '../../hooks/useSurveys'
import { useUserSurveyResponse } from '../../hooks/useSurveyResponses'
import Loading from '../common/Loading'
import { format } from 'date-fns'

function SurveyCard({ survey, onTake }) {
  const { hasResponded } = useUserSurveyResponse(survey.id)

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
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-medium text-gray-900">{survey.title}</h3>
            {getTypeBadge(survey.type)}
            {hasResponded && !survey.allowMultipleResponses && (
              <span className="badge bg-green-100 text-green-800">Completed</span>
            )}
          </div>
          {survey.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-2">{survey.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{survey.questions?.length || 0} questions</span>
            {survey.responseCount > 0 && <span>{survey.responseCount} responses</span>}
            {survey.createdAt && (
              <span>
                Created{' '}
                {format(
                  survey.createdAt.toDate ? survey.createdAt.toDate() : survey.createdAt,
                  'MMM d, yyyy'
                )}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => onTake(survey)}
          className={`btn-primary text-sm whitespace-nowrap ${
            hasResponded && !survey.allowMultipleResponses ? 'opacity-50' : ''
          }`}
          disabled={hasResponded && !survey.allowMultipleResponses}
        >
          {hasResponded && !survey.allowMultipleResponses
            ? 'Completed'
            : hasResponded
            ? 'Respond Again'
            : 'Take Survey'}
        </button>
      </div>
    </div>
  )
}

export default function SurveyList({ onTakeSurvey }) {
  const { surveys, loading, error } = useSurveys('published')

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="card text-center py-8">
        <p className="text-red-600">Error loading surveys: {error}</p>
      </div>
    )
  }

  if (surveys.length === 0) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Surveys Available</h3>
        <p className="text-gray-500">Check back later for new surveys and polls.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {surveys.map((survey) => (
        <SurveyCard key={survey.id} survey={survey} onTake={onTakeSurvey} />
      ))}
    </div>
  )
}
