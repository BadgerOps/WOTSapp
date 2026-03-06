import { useState } from 'react'
import { usePeerFeedbackSessionActions } from '../../hooks/usePeerFeedback'

const QUESTION_TYPES = [
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
]

function generateId() {
  return Math.random().toString(36).substring(2, 11)
}

export default function PeerFeedbackSessionComposer({ editSession, onCancel, onSaved }) {
  const { createSession, updateSession, loading } = usePeerFeedbackSessionActions()
  const [title, setTitle] = useState(editSession?.title || '')
  const [description, setDescription] = useState(editSession?.description || '')
  const [questions, setQuestions] = useState(
    editSession?.questions || [
      {
        id: generateId(),
        type: 'rating',
        question: 'How well does this candidate demonstrate leadership?',
        required: true,
        maxRating: 5,
      },
      {
        id: generateId(),
        type: 'rating',
        question: 'How well does this candidate work as part of a team?',
        required: true,
        maxRating: 5,
      },
      {
        id: generateId(),
        type: 'long_text',
        question: 'What is this candidate\'s greatest strength?',
        required: false,
      },
      {
        id: generateId(),
        type: 'long_text',
        question: 'What area could this candidate improve in?',
        required: false,
      },
    ]
  )
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        id: generateId(),
        type: 'rating',
        question: '',
        required: true,
        maxRating: 5,
      },
    ])
  }

  function updateQuestion(index, updates) {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], ...updates }
    setQuestions(newQuestions)
  }

  function removeQuestion(index) {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  function moveQuestion(index, direction) {
    const newQuestions = [...questions]
    const target = index + direction
    if (target < 0 || target >= newQuestions.length) return
    ;[newQuestions[index], newQuestions[target]] = [newQuestions[target], newQuestions[index]]
    setQuestions(newQuestions)
  }

  function addOption(questionIndex) {
    const newQuestions = [...questions]
    const q = newQuestions[questionIndex]
    q.options = [...(q.options || []), '']
    setQuestions(newQuestions)
  }

  function updateOption(questionIndex, optionIndex, value) {
    const newQuestions = [...questions]
    newQuestions[questionIndex].options[optionIndex] = value
    setQuestions(newQuestions)
  }

  function removeOption(questionIndex, optionIndex) {
    const newQuestions = [...questions]
    newQuestions[questionIndex].options = newQuestions[questionIndex].options.filter(
      (_, i) => i !== optionIndex
    )
    setQuestions(newQuestions)
  }

  function validateForm() {
    if (!title.trim()) return 'Session title is required.'
    if (questions.length === 0) return 'At least one question is required.'
    for (const q of questions) {
      if (!q.question.trim()) return 'All questions must have text.'
      if ((q.type === 'single_choice' || q.type === 'multiple_choice') &&
        (!q.options || q.options.filter((o) => o.trim()).length < 2)) {
        return 'Choice questions need at least 2 options.'
      }
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)

    // Clean questions: remove empty options, strip options from non-choice types
    const cleanedQuestions = questions.map((q) => {
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        return { ...q, options: q.options.filter((o) => o.trim()) }
      }
      const { options, ...rest } = q
      return rest
    })

    try {
      if (editSession) {
        await updateSession(editSession.id, {
          title: title.trim(),
          description: description.trim(),
          questions: cleanedQuestions,
        })
      } else {
        await createSession({
          title: title.trim(),
          description: description.trim(),
          questions: cleanedQuestions,
        })
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (onSaved) onSaved()
    } catch (err) {
      setFormError(err.message)
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {editSession ? 'Edit Feedback Session' : 'Create Peer Feedback Session'}
      </h2>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Session {editSession ? 'updated' : 'created'} successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Week 4 Peer Feedback"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions or context for this feedback session..."
            rows={2}
            className="input"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Questions ({questions.length})
            </label>
            <button
              type="button"
              onClick={addQuestion}
              className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg"
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, qi) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-gray-400 mt-2">{qi + 1}.</span>
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                      placeholder="Enter question text..."
                      className="input"
                    />
                    <div className="flex flex-wrap gap-3 items-center">
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const updates = { type: e.target.value }
                          if (
                            (e.target.value === 'single_choice' || e.target.value === 'multiple_choice') &&
                            !q.options
                          ) {
                            updates.options = ['', '']
                          }
                          if (e.target.value === 'rating' && !q.maxRating) {
                            updates.maxRating = 5
                          }
                          updateQuestion(qi, updates)
                        }}
                        className="input w-auto"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>

                      <label className="flex items-center gap-1 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQuestion(qi, { required: e.target.checked })}
                        />
                        Required
                      </label>

                      {q.type === 'rating' && (
                        <label className="flex items-center gap-1 text-sm text-gray-600">
                          Max:
                          <select
                            value={q.maxRating || 5}
                            onChange={(e) =>
                              updateQuestion(qi, { maxRating: Number(e.target.value) })
                            }
                            className="input w-auto"
                          >
                            {[3, 4, 5, 7, 10].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>

                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="space-y-2 pl-4">
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(qi, oi, e.target.value)}
                              placeholder={`Option ${oi + 1}`}
                              className="input flex-1"
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(qi, oi)}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(qi)}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          + Add Option
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveQuestion(qi, -1)}
                      disabled={qi === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(qi, 1)}
                      disabled={qi === questions.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(qi)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Remove question"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : editSession ? 'Update Session' : 'Create Session'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
