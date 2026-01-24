import { useState } from 'react'
import { useSurveyResultsAggregation } from '../../hooks/useSurveyResponses'
import Loading from '../common/Loading'
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export default function SurveyResults({ survey, onBack }) {
  const { aggregatedResults, responses, loading, error } = useSurveyResultsAggregation(
    survey?.id,
    survey?.questions
  )
  const [viewMode, setViewMode] = useState('summary') // 'summary' or 'individual'
  const [exporting, setExporting] = useState(false)

  if (!survey) return null

  if (loading) {
    return <Loading />
  }

  function exportToCSV() {
    const headers = ['Respondent', 'Submitted At', ...survey.questions.map((q) => q.question)]
    const rows = responses.map((r) => {
      const row = [
        r.respondentName || 'Anonymous',
        r.submittedAt?.toDate ? format(r.submittedAt.toDate(), 'yyyy-MM-dd HH:mm') : '',
      ]
      survey.questions.forEach((q) => {
        const answer = r.answers?.[q.id]
        if (Array.isArray(answer)) {
          row.push(answer.join('; '))
        } else {
          row.push(answer || '')
        }
      })
      return row
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    downloadFile(csvContent, `${survey.title}-responses.csv`, 'text/csv')
  }

  function exportToJSON() {
    const data = {
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        type: survey.type,
        questions: survey.questions,
        responseCount: responses.length,
        exportedAt: new Date().toISOString(),
      },
      responses: responses.map((r) => ({
        respondent: r.respondentName || 'Anonymous',
        respondentEmail: r.respondentEmail,
        isAnonymous: r.isAnonymous,
        submittedAt: r.submittedAt?.toDate ? r.submittedAt.toDate().toISOString() : null,
        answers: r.answers,
      })),
      aggregatedResults,
    }

    downloadFile(JSON.stringify(data, null, 2), `${survey.title}-responses.json`, 'application/json')
  }

  function exportToPDF() {
    setExporting(true)
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      // Title
      doc.setFontSize(18)
      doc.text(survey.title, pageWidth / 2, 20, { align: 'center' })

      doc.setFontSize(10)
      doc.text(`Total Responses: ${responses.length}`, pageWidth / 2, 28, { align: 'center' })
      doc.text(`Exported: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageWidth / 2, 34, {
        align: 'center',
      })

      let yPosition = 45

      // Summary for each question
      survey.questions.forEach((question, qIndex) => {
        const result = aggregatedResults[question.id]

        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage()
          yPosition = 20
        }

        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        doc.text(`Q${qIndex + 1}: ${question.question}`, 14, yPosition)
        yPosition += 8

        doc.setFont(undefined, 'normal')
        doc.setFontSize(10)

        if (result) {
          if (question.type === 'single_choice' || question.type === 'multiple_choice') {
            // Show counts for each option
            Object.entries(result.counts || {}).forEach(([option, count]) => {
              const percentage = result.total > 0 ? Math.round((count / result.total) * 100) : 0
              doc.text(`• ${option}: ${count} (${percentage}%)`, 20, yPosition)
              yPosition += 6
            })
          } else if (question.type === 'rating') {
            doc.text(`Average: ${result.average} / ${question.maxRating || 5}`, 20, yPosition)
            yPosition += 6
            Object.entries(result.distribution || {}).forEach(([rating, count]) => {
              doc.text(`Rating ${rating}: ${count} responses`, 20, yPosition)
              yPosition += 5
            })
          } else if (
            question.type === 'text' ||
            question.type === 'long_text' ||
            question.type === 'open_contribution'
          ) {
            doc.text(`${result.total || 0} text responses`, 20, yPosition)
            yPosition += 6
          }
        }

        yPosition += 10
      })

      // Individual responses table
      if (responses.length > 0) {
        doc.addPage()
        doc.setFontSize(14)
        doc.text('Individual Responses', 14, 20)

        const tableHeaders = ['#', 'Respondent', 'Date', ...survey.questions.map((_, i) => `Q${i + 1}`)]
        const tableData = responses.map((r, index) => {
          const row = [
            index + 1,
            r.respondentName || 'Anonymous',
            r.submittedAt?.toDate ? format(r.submittedAt.toDate(), 'MM/dd/yy') : '',
          ]
          survey.questions.forEach((q) => {
            const answer = r.answers?.[q.id]
            if (Array.isArray(answer)) {
              row.push(answer.join(', ').substring(0, 30))
            } else {
              row.push(String(answer || '').substring(0, 30))
            }
          })
          return row
        })

        doc.autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: 30,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [54, 112, 171] },
        })
      }

      doc.save(`${survey.title}-results.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
    } finally {
      setExporting(false)
    }
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">{survey.title}</h2>
            <p className="text-gray-600">{responses.length} responses</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              CSV
            </button>
            <button
              onClick={exportToJSON}
              className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              JSON
            </button>
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'PDF'}
            </button>
            {onBack && (
              <button onClick={onBack} className="btn-secondary text-sm">
                Back
              </button>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === 'summary'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('individual')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === 'individual'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Individual Responses
          </button>
        </div>
      </div>

      {error && (
        <div className="card text-center py-4 text-red-600">Error loading results: {error}</div>
      )}

      {responses.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">No responses yet.</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* Summary View */
        <div className="space-y-4">
          {survey.questions.map((question, qIndex) => {
            const result = aggregatedResults[question.id]
            return (
              <div key={question.id} className="card">
                <h3 className="font-medium text-gray-900 mb-4">
                  {qIndex + 1}. {question.question}
                </h3>

                {/* Choice questions - bar chart style */}
                {(question.type === 'single_choice' || question.type === 'multiple_choice') &&
                  result && (
                    <div className="space-y-2">
                      {Object.entries(result.counts || {}).map(([option, count]) => {
                        const percentage =
                          result.total > 0 ? Math.round((count / result.total) * 100) : 0
                        return (
                          <div key={option}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-700">{option}</span>
                              <span className="text-gray-500">
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                      <p className="text-xs text-gray-400 mt-2">
                        Total responses: {result.total}
                      </p>
                    </div>
                  )}

                {/* Rating questions */}
                {question.type === 'rating' && result && (
                  <div>
                    <div className="text-3xl font-bold text-primary-600 mb-2">
                      {result.average}
                      <span className="text-lg text-gray-400"> / {question.maxRating || 5}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: question.maxRating || 5 }, (_, i) => i + 1).map(
                        (rating) => (
                          <div
                            key={rating}
                            className={`w-8 h-8 rounded flex items-center justify-center text-sm ${
                              rating <= Math.round(result.average)
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {rating}
                          </div>
                        )
                      )}
                    </div>
                    <div className="space-y-1">
                      {Object.entries(result.distribution || {}).map(([rating, count]) => (
                        <div key={rating} className="flex items-center gap-2 text-sm">
                          <span className="w-8 text-gray-600">{rating}:</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-400 rounded-full"
                              style={{
                                width: `${result.total > 0 ? (count / result.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 text-right text-gray-500">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text responses */}
                {(question.type === 'text' ||
                  question.type === 'long_text' ||
                  question.type === 'open_contribution') &&
                  result && (
                    <div>
                      <p className="text-sm text-gray-500 mb-3">
                        {result.total || result.contributions?.length || 0} responses
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(result.responses || result.contributions || []).map((item, i) => (
                          <div
                            key={i}
                            className="p-3 bg-gray-50 rounded-lg text-sm border-l-2 border-primary-200"
                          >
                            <p className="text-gray-800">{item.text || item.value}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              — {item.respondent}
                              {item.submittedAt &&
                                ` • ${format(
                                  item.submittedAt.toDate
                                    ? item.submittedAt.toDate()
                                    : item.submittedAt,
                                  'MMM d'
                                )}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Individual Responses View */
        <div className="space-y-3">
          {responses.map((response, rIndex) => (
            <div key={response.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="font-medium text-gray-900">
                    {response.respondentName || 'Anonymous'}
                  </span>
                  {response.respondentEmail && (
                    <span className="text-sm text-gray-500 ml-2">{response.respondentEmail}</span>
                  )}
                </div>
                <span className="text-sm text-gray-400">
                  {response.submittedAt &&
                    format(
                      response.submittedAt.toDate
                        ? response.submittedAt.toDate()
                        : response.submittedAt,
                      'MMM d, yyyy HH:mm'
                    )}
                </span>
              </div>
              <div className="space-y-3">
                {survey.questions.map((question, qIndex) => {
                  const answer = response.answers?.[question.id]
                  return (
                    <div key={question.id} className="text-sm">
                      <p className="text-gray-500 mb-1">
                        {qIndex + 1}. {question.question}
                      </p>
                      <p className="text-gray-900 font-medium">
                        {Array.isArray(answer) ? answer.join(', ') : answer || '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
