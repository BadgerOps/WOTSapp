import { useState } from 'react'
import { useSurveyActions } from '../../hooks/useSurveys'

const QUESTION_TYPES = [
  { id: 'single_choice', label: 'Single Choice', description: 'One answer only' },
  { id: 'multiple_choice', label: 'Multiple Choice', description: 'Select multiple answers' },
  { id: 'text', label: 'Short Text', description: 'Single line answer' },
  { id: 'long_text', label: 'Long Text', description: 'Paragraph answer' },
  { id: 'rating', label: 'Rating', description: '1-5 star rating' },
  { id: 'open_contribution', label: 'Open Contribution', description: 'Everyone adds their answer (e.g., favorite song)' },
]

function generateId() {
  return Math.random().toString(36).substring(2, 11)
}

export default function SurveyComposer({ editSurvey, onCancel, onSaved }) {
  const { createSurvey, updateSurvey, loading: saving } = useSurveyActions()
  const isEditing = !!editSurvey

  // Form state
  const [title, setTitle] = useState(editSurvey?.title || '')
  const [description, setDescription] = useState(editSurvey?.description || '')
  const [type, setType] = useState(editSurvey?.type || 'survey')
  const [allowAnonymous, setAllowAnonymous] = useState(editSurvey?.allowAnonymous || false)
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(
    editSurvey?.allowMultipleResponses || false
  )
  const [questions, setQuestions] = useState(editSurvey?.questions || [])
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  function resetForm() {
    setTitle('')
    setDescription('')
    setType('survey')
    setAllowAnonymous(false)
    setAllowMultipleResponses(false)
    setQuestions([])
    setFormError(null)
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        id: generateId(),
        type: 'single_choice',
        question: '',
        options: ['', ''],
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
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= questions.length) return
    const newQuestions = [...questions]
    ;[newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]]
    setQuestions(newQuestions)
  }

  function addOption(questionIndex) {
    const newQuestions = [...questions]
    newQuestions[questionIndex].options = [...(newQuestions[questionIndex].options || []), '']
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
    if (!title.trim()) {
      setFormError('Title is required')
      return false
    }
    if (questions.length === 0) {
      setFormError('At least one question is required')
      return false
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) {
        setFormError(`Question ${i + 1} text is required`)
        return false
      }
      if (
        (q.type === 'single_choice' || q.type === 'multiple_choice') &&
        (!q.options || q.options.filter((o) => o.trim()).length < 2)
      ) {
        setFormError(`Question ${i + 1} needs at least 2 options`)
        return false
      }
    }
    return true
  }

  async function handleSubmit(e, saveAsDraft = false) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)

    if (!validateForm()) return

    // Clean up options for non-choice questions
    const cleanedQuestions = questions.map((q) => {
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        return { ...q, options: q.options.filter((o) => o.trim()) }
      }
      const { options, ...rest } = q
      return rest
    })

    const surveyData = {
      title: title.trim(),
      description: description.trim(),
      type,
      allowAnonymous,
      allowMultipleResponses,
      questions: cleanedQuestions,
      status: saveAsDraft ? 'draft' : 'published',
    }

    try {
      if (isEditing) {
        await updateSurvey(editSurvey.id, surveyData)
      } else {
        await createSurvey(surveyData)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (onSaved) onSaved()
      if (!isEditing) resetForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {isEditing ? 'Edit Survey' : 'Create New Survey'}
      </h2>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Survey {isEditing ? 'updated' : 'created'} successfully!
        </div>
      )}

      <div className="space-y-4">
        {/* Basic Info */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="e.g., Weekly Feedback Survey"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[80px]"
            placeholder="Brief description of what this survey is about..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input"
            >
              <option value="survey">Survey</option>
              <option value="quiz">Quiz</option>
              <option value="poll">Poll</option>
            </select>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowAnonymous}
              onChange={(e) => setAllowAnonymous(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Allow anonymous responses</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMultipleResponses}
              onChange={(e) => setAllowMultipleResponses(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Allow multiple responses per user</span>
          </label>
        </div>

        {/* Questions */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-semibold text-gray-900">Questions</h3>
            <button type="button" onClick={addQuestion} className="btn-secondary text-sm">
              + Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              No questions yet. Click "Add Question" to start.
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, qIndex) => (
                <div key={q.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-500">
                      Question {qIndex + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(qIndex, -1)}
                        disabled={qIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(qIndex, 1)}
                        disabled={qIndex === questions.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove question"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                          className="input"
                          placeholder="Enter your question..."
                        />
                      </div>
                      <div>
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(qIndex, {
                              type: e.target.value,
                              options:
                                e.target.value === 'single_choice' ||
                                e.target.value === 'multiple_choice'
                                  ? q.options || ['', '']
                                  : undefined,
                            })
                          }
                          className="input"
                        >
                          {QUESTION_TYPES.map((qt) => (
                            <option key={qt.id} value={qt.id}>
                              {qt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Options for choice questions */}
                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="space-y-2">
                        <label className="text-sm text-gray-600">Options:</label>
                        {q.options?.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              className="input flex-1"
                              placeholder={`Option ${oIndex + 1}`}
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(qIndex, oIndex)}
                                className="p-2 text-red-400 hover:text-red-600"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(qIndex)}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          + Add option
                        </button>
                      </div>
                    )}

                    {/* Rating scale */}
                    {q.type === 'rating' && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Max rating:</label>
                        <select
                          value={q.maxRating || 5}
                          onChange={(e) =>
                            updateQuestion(qIndex, { maxRating: parseInt(e.target.value) })
                          }
                          className="input w-20"
                        >
                          {[3, 4, 5, 7, 10].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Open contribution hint */}
                    {q.type === 'open_contribution' && (
                      <p className="text-sm text-gray-500">
                        Users can each add their own answer. Great for collecting favorites like songs, books, etc.
                      </p>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-600">Required</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Update & Publish' : 'Create & Publish'}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={saving}
            className="btn-secondary disabled:opacity-50"
          >
            Save as Draft
          </button>
          {(isEditing || onCancel) && (
            <button
              type="button"
              onClick={() => {
                resetForm()
                if (onCancel) onCancel()
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
