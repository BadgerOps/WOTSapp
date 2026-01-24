import { Link } from 'react-router-dom'
import { useUnansweredSurveys } from '../../hooks/useSurveys'

export default function PendingSurveyCard() {
  const { unansweredSurveys, loading } = useUnansweredSurveys()

  // Don't show anything while loading or if no unanswered surveys
  if (loading || unansweredSurveys.length === 0) {
    return null
  }

  const surveyCount = unansweredSurveys.length

  return (
    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📋</div>
          <div>
            <h3 className="font-medium text-blue-900">
              {surveyCount === 1 ? 'New Survey Available' : `${surveyCount} Surveys Available`}
            </h3>
            <p className="text-sm text-blue-700">
              {surveyCount === 1
                ? unansweredSurveys[0].title
                : 'Complete surveys to share your feedback'}
            </p>
          </div>
        </div>
        <Link
          to="/surveys"
          className="btn-primary text-sm whitespace-nowrap"
        >
          {surveyCount === 1 ? 'Take Survey' : 'View Surveys'}
        </Link>
      </div>
    </div>
  )
}
