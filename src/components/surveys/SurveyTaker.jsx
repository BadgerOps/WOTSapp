import { useState, useEffect } from 'react'
import { useSurveyResponseActions, useUserSurveyResponse } from '../../hooks/useSurveyResponses'
import Loading from '../common/Loading'

export default function SurveyTaker({ survey, onComplete, onCancel }) {
  const { submitResponse, updateResponse, loading: submitting } = useSurveyResponseActions()
  const { response: existingResponse, hasResponded, loading: checkingResponse } = useUserSurveyResponse(survey?.id)

  const [answers, setAnswers] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitAnonymously, setSubmitAnonymously] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Pre-populate answers when editing an existing response
  useEffect(() => {
    if (isEditing && existingResponse?.answers) {
      setAnswers(existingResponse.answers)
    }
  }, [isEditing, existingResponse])

  if (!survey) return null

  if (checkingResponse) {
    return <Loading />
  }

  // If user already responded and not in edit mode
  if (hasResponded && !survey.allowMultipleResponses && !isEditing) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">✓</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Already Submitted</h3>
          <p className="text-gray-600 mb-4">You have already responded to this survey.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="btn-primary"
            >
              Edit Response
            </button>
            {onCancel && (
              <button onClick={onCancel} className="btn-secondary">
                Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  function updateAnswer(questionId, value) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  function validateAnswers() {
    for (const question of survey.questions) {
      if (question.required) {
        const answer = answers[question.id]
        if (answer === undefined || answer === null || answer === '') {
          setFormError(`Please answer: "${question.question}"`)
          return false
        }
        if (Array.isArray(answer) && answer.length === 0) {
          setFormError(`Please select at least one option for: "${question.question}"`)
          return false
        }
      }
    }
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (!validateAnswers()) return

    try {
      if (isEditing && existingResponse) {
        await updateResponse(existingResponse.id, answers)
      } else {
        await submitResponse(survey.id, answers, submitAnonymously && survey.allowAnonymous)
      }
      if (onComplete) onComplete()
    } catch (err) {
      setFormError(err.message)
    }
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{survey.title}</h2>
        {survey.description && <p className="text-gray-600">{survey.description}</p>}
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {survey.questions?.map((question, index) => (
          <div key={question.id} className="border-b border-gray-100 pb-6 last:border-0">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {index + 1}. {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* Single Choice */}
            {question.type === 'single_choice' && (
              <div className="space-y-2">
                {question.options?.map((option, optIndex) => (
                  <label
                    key={optIndex}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Multiple Choice */}
            {question.type === 'multiple_choice' && (
              <div className="space-y-2">
                {question.options?.map((option, optIndex) => (
                  <label
                    key={optIndex}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      value={option}
                      checked={(answers[question.id] || []).includes(option)}
                      onChange={(e) => {
                        const current = answers[question.id] || []
                        if (e.target.checked) {
                          updateAnswer(question.id, [...current, option])
                        } else {
                          updateAnswer(
                            question.id,
                            current.filter((o) => o !== option)
                          )
                        }
                      }}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Short Text */}
            {question.type === 'text' && (
              <input
                type="text"
                value={answers[question.id] || ''}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                className="input"
                placeholder="Enter your answer..."
              />
            )}

            {/* Long Text */}
            {question.type === 'long_text' && (
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                className="input min-h-[120px]"
                placeholder="Enter your answer..."
              />
            )}

            {/* Rating */}
            {question.type === 'rating' && (
              <div className="flex items-center gap-2">
                {Array.from({ length: question.maxRating || 5 }, (_, i) => i + 1).map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => updateAnswer(question.id, rating)}
                    className={`w-10 h-10 rounded-lg border-2 font-medium transition-colors ${
                      answers[question.id] === rating
                        ? 'border-primary-500 bg-primary-100 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}

            {/* Open Contribution */}
            {question.type === 'open_contribution' && (
              <div>
                <input
                  type="text"
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className="input"
                  placeholder="Add your contribution..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Share your answer with everyone!
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Anonymous option */}
        {survey.allowAnonymous && (
          <label className="flex items-center gap-2 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={submitAnonymously}
              onChange={(e) => setSubmitAnonymously(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">Submit anonymously</span>
          </label>
        )}

        {/* Submit buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {submitting
              ? (isEditing ? 'Updating...' : 'Submitting...')
              : (isEditing ? 'Update Response' : 'Submit Response')}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setAnswers({})
              }}
              className="btn-secondary"
            >
              Cancel Edit
            </button>
          ) : onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
