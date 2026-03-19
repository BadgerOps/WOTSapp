import { useState } from 'react'
import { usePeerFeedbackResultsAggregation, usePeerFeedbackResponses } from '../../hooks/usePeerFeedback'
import { usePersonnel } from '../../hooks/usePersonnel'
import Loading from '../common/Loading'

function RatingBar({ value, max, count, total }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-right text-gray-500">{value}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className="bg-primary-400 h-2 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-8 text-right text-gray-400">{count}</span>
    </div>
  )
}

function SubjectCard({ subjectData, questions, isExpanded, onToggle }) {
  const { aggregated, responseCount, subjectName } = subjectData

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
      >
        <div>
          <h3 className="font-medium text-gray-900">{subjectName}</h3>
          <p className="text-xs text-gray-500">{responseCount} review{responseCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {questions
            .filter((q) => q.type === 'rating')
            .map((q) => {
              const result = aggregated[q.id]
              return result ? (
                <div key={q.id} className="text-center">
                  <div className="text-lg font-bold text-primary-600">{result.average}</div>
                  <div className="text-[10px] text-gray-400 max-w-[80px] truncate">
                    {q.question}
                  </div>
                </div>
              ) : null
            })}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-5">
          {questions.map((q) => {
            const result = aggregated[q.id]
            if (!result) return null

            return (
              <div key={q.id} className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">{q.question}</h4>

                {result.type === 'rating' && (
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary-600">
                        {result.average}
                      </span>
                      <span className="text-sm text-gray-400">
                        / {q.maxRating || 5} avg ({result.total} reviews)
                      </span>
                    </div>
                    <div className="space-y-1 max-w-xs">
                      {Object.entries(result.distribution)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([value, count]) => (
                          <RatingBar
                            key={value}
                            value={value}
                            max={q.maxRating || 5}
                            count={count}
                            total={result.total}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {(result.type === 'text' || result.type === 'long_text') && (
                  <div className="space-y-2">
                    {result.responses.map((r, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700"
                      >
                        {r.text}
                      </div>
                    ))}
                    {result.responses.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No responses</p>
                    )}
                  </div>
                )}

                {(result.type === 'single_choice' || result.type === 'multiple_choice') && (
                  <div className="space-y-1">
                    {Object.entries(result.counts).map(([option, count]) => {
                      const percent =
                        result.total > 0 ? Math.round((count / result.total) * 100) : 0
                      return (
                        <div key={option} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-gray-600">{option}</span>
                          <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-primary-400 h-2 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs text-gray-400">
                            {count} ({percent}%)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProgressMatrix({ sessionId, personnel }) {
  const { responses, loading } = usePeerFeedbackResponses(sessionId)

  if (loading) return <Loading />

  // Build a lookup: reviewerId -> Set of subjectIds they've reviewed
  const reviewedMap = {}
  responses.forEach((r) => {
    if (!reviewedMap[r.reviewerId]) reviewedMap[r.reviewerId] = new Set()
    reviewedMap[r.reviewerId].add(r.subjectId)
  })

  // Personnel who haven't reviewed anyone yet
  const notStarted = personnel.filter((p) => {
    const reviewerId = p.userId || p.id
    return !reviewedMap[reviewerId] || reviewedMap[reviewerId].size === 0
  })

  // Personnel who have started but not finished
  const inProgress = personnel.filter((p) => {
    const reviewerId = p.userId || p.id
    const reviewed = reviewedMap[reviewerId]?.size || 0
    return reviewed > 0 && reviewed < personnel.length - 1
  })

  // Personnel who have reviewed everyone
  const completed = personnel.filter((p) => {
    const reviewerId = p.userId || p.id
    const reviewed = reviewedMap[reviewerId]?.size || 0
    return reviewed >= personnel.length - 1
  })

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Completion Status</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-gray-600">
              Completed ({completed.length})
            </span>
          </div>
          <div className="space-y-1">
            {completed.map((p) => (
              <p key={p.id} className="text-xs text-gray-500">
                {p.firstName} {p.lastName}
              </p>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs font-medium text-gray-600">
              In Progress ({inProgress.length})
            </span>
          </div>
          <div className="space-y-1">
            {inProgress.map((p) => {
              const reviewerId = p.userId || p.id
              const reviewed = reviewedMap[reviewerId]?.size || 0
              return (
                <p key={p.id} className="text-xs text-gray-500">
                  {p.firstName} {p.lastName}{' '}
                  <span className="text-gray-400">
                    ({reviewed}/{personnel.length - 1})
                  </span>
                </p>
              )
            })}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="text-xs font-medium text-gray-600">
              Not Started ({notStarted.length})
            </span>
          </div>
          <div className="space-y-1">
            {notStarted.map((p) => (
              <p key={p.id} className="text-xs text-gray-500">
                {p.firstName} {p.lastName}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PeerFeedbackResults({ session, onBack }) {
  const { resultsBySubject, loading } = usePeerFeedbackResultsAggregation(
    session.id,
    session.questions
  )
  const { personnel } = usePersonnel()
  const [expandedSubject, setExpandedSubject] = useState(null)
  const [sortBy, setSortBy] = useState('name')

  if (loading) return <Loading />

  // Sort subjects
  let sortedSubjects = Object.values(resultsBySubject)
  if (sortBy === 'name') {
    sortedSubjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName))
  } else if (sortBy === 'rating') {
    // Sort by average of first rating question, descending
    const firstRatingQ = session.questions.find((q) => q.type === 'rating')
    if (firstRatingQ) {
      sortedSubjects.sort((a, b) => {
        const aAvg = a.aggregated[firstRatingQ.id]?.average || 0
        const bAvg = b.aggregated[firstRatingQ.id]?.average || 0
        return bAvg - aAvg
      })
    }
  } else if (sortBy === 'reviews') {
    sortedSubjects.sort((a, b) => b.responseCount - a.responseCount)
  }

  function handleExportCSV() {
    const headers = ['Candidate', 'Reviews Received']
    session.questions.forEach((q) => {
      if (q.type === 'rating') headers.push(`${q.question} (Avg)`)
      else headers.push(q.question)
    })

    const rows = sortedSubjects.map((subject) => {
      const row = [subject.subjectName, subject.responseCount]
      session.questions.forEach((q) => {
        const result = subject.aggregated[q.id]
        if (!result) {
          row.push('')
        } else if (result.type === 'rating') {
          row.push(result.average)
        } else if (result.type === 'text' || result.type === 'long_text') {
          row.push(result.responses.map((r) => r.text).join(' | '))
        } else if (result.type === 'single_choice' || result.type === 'multiple_choice') {
          row.push(
            Object.entries(result.counts)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          )
        }
      })
      return row
    })

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `peer-feedback-${session.title.replace(/\s+/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            Results: {session.title}
          </h2>
          <p className="text-sm text-gray-500">
            {sortedSubjects.length} candidates reviewed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="name">Sort by Name</option>
            <option value="rating">Sort by Rating</option>
            <option value="reviews">Sort by Reviews</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-200"
          >
            Export CSV
          </button>
        </div>
      </div>

      <ProgressMatrix sessionId={session.id} personnel={personnel} />

      <div className="space-y-2">
        {sortedSubjects.map((subjectData) => (
          <SubjectCard
            key={subjectData.subjectId}
            subjectData={subjectData}
            questions={session.questions}
            isExpanded={expandedSubject === subjectData.subjectId}
            onToggle={() =>
              setExpandedSubject(
                expandedSubject === subjectData.subjectId ? null : subjectData.subjectId
              )
            }
          />
        ))}
      </div>

      {sortedSubjects.length === 0 && (
        <div className="card text-center text-gray-500 text-sm">
          No feedback has been submitted yet.
        </div>
      )}
    </div>
  )
}
