import { useState } from 'react'
import SurveyList from '../components/surveys/SurveyList'
import SurveyTaker from '../components/surveys/SurveyTaker'

export default function Surveys() {
  const [activeSurvey, setActiveSurvey] = useState(null)
  const [completed, setCompleted] = useState(false)

  function handleTakeSurvey(survey) {
    setActiveSurvey(survey)
    setCompleted(false)
  }

  function handleComplete() {
    setCompleted(true)
  }

  function handleBack() {
    setActiveSurvey(null)
    setCompleted(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {!activeSurvey ? (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
            <p className="text-gray-600">Complete surveys and share your feedback</p>
          </div>
          <SurveyList onTakeSurvey={handleTakeSurvey} />
        </>
      ) : completed ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your response has been submitted successfully.</p>
          <button onClick={handleBack} className="btn-primary">
            Back to Surveys
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={handleBack}
            className="mb-4 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            ← Back to Surveys
          </button>
          <SurveyTaker survey={activeSurvey} onComplete={handleComplete} onCancel={handleBack} />
        </div>
      )}
    </div>
  )
}
