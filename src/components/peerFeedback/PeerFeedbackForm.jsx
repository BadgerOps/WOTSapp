import { useState, useEffect } from 'react'
import { usePeerFeedbackResponseActions } from '../../hooks/usePeerFeedback'

export default function PeerFeedbackForm({ session, subject, existingResponse, onComplete, onCancel }) {
  const { submitFeedback, updateFeedback, loading } = usePeerFeedbackResponseActions()
  const [answers, setAnswers] = useState({})
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (existingResponse?.answers) {
      setAnswers(existingResponse.answers)
    }
  }, [existingResponse])

  function updateAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function validateAnswers() {
    for (const q of session.questions) {
      if (q.required) {
        const answer = answers[q.id]
        if (answer === undefined || answer === null || answer === '') {
          return `Please answer: "${q.question}"`
        }
      }
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validateAnswers()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)

    try {
      if (existingResponse) {
        await updateFeedback(existingResponse.id, answers)
      } else {
        await submitFeedback(session.id, subject.id, subject.displayName, answers)
      }
      onComplete()
    } catch (err) {
      setFormError(err.message)
    }
  }

  return (
    <div className="card">
      <div className="mb-6">
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          Feedback for {subject.displayName}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{session.title}</p>
        {existingResponse && (
          <p className="text-xs text-yellow-600 mt-1">
            You have already submitted feedback. Submitting again will update your previous response.
          </p>
        )}
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {session.questions.map((q, qi) => (
          <div key={q.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {qi + 1}. {q.question}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {q.type === 'rating' && (
              <div className="flex gap-2">
                {Array.from({ length: q.maxRating || 5 }, (_, i) => i + 1).map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => updateAnswer(q.id, rating)}
                    className={`w-10 h-10 rounded-lg border-2 font-medium text-sm transition-colors ${
                      answers[q.id] === rating
                        ? 'border-primary-500 bg-primary-100 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'text' && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                className="input"
                placeholder="Your answer..."
              />
            )}

            {q.type === 'long_text' && (
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                className="input"
                rows={3}
                placeholder="Your answer..."
              />
            )}

            {q.type === 'single_choice' && (
              <div className="space-y-2">
                {q.options?.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => updateAnswer(q.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === 'multiple_choice' && (
              <div className="space-y-2">
                {q.options?.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(answers[q.id] || []).includes(opt)}
                      onChange={(e) => {
                        const current = answers[q.id] || []
                        if (e.target.checked) {
                          updateAnswer(q.id, [...current, opt])
                        } else {
                          updateAnswer(q.id, current.filter((o) => o !== opt))
                        }
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading
              ? 'Submitting...'
              : existingResponse
                ? 'Update Feedback'
                : 'Submit Feedback'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
