import { useState } from 'react'
import PostComposer from '../components/posts/PostComposer'
import PostManager from '../components/posts/PostManager'
import DocumentUpload from '../components/documents/DocumentUpload'
import UniformManager from '../components/admin/UniformManager'
import UotdScheduleManager from '../components/admin/UotdScheduleManager'
import WeatherLocationManager from '../components/admin/WeatherLocationManager'
import WeatherRulesManager from '../components/admin/WeatherRulesManager'
import WeatherApprovalQueue from '../components/admin/WeatherApprovalQueue'
import ManualWeatherCheck from '../components/admin/ManualWeatherCheck'
import PersonnelRosterUpload from '../components/personnel/PersonnelRosterUpload'
import PersonnelRosterTable from '../components/personnel/PersonnelRosterTable'
import PersonnelAddForm from '../components/personnel/PersonnelAddForm'
import PersonnelConfigPanel from '../components/personnel/PersonnelConfigPanel'
import ConfigManager from '../components/admin/ConfigManager'
import DetailTemplateManager from '../components/details/DetailTemplateManager'
import TaskAssignmentForm from '../components/details/TaskAssignmentForm'
import DetailAssignmentList from '../components/details/DetailAssignmentList'
import DetailApprovalQueue from '../components/details/DetailApprovalQueue'
import DetailHistory from '../components/details/DetailHistory'
import DetailAssignmentImporter from '../components/details/DetailAssignmentImporter'
import DetailResetTool from '../components/details/DetailResetTool'
import DetailNotificationSettings from '../components/admin/DetailNotificationSettings'
import CQDashboard from '../components/cq/CQDashboard'
import ShiftManager from '../components/cq/ShiftManager'
import CQScheduleManager from '../components/cq/CQScheduleManager'
import PersonnelStatusTracker from '../components/cq/PersonnelStatusTracker'
import CQNotesLog from '../components/cq/CQNotesLog'
import CQAuditLog from '../components/cq/CQAuditLog'
import StatusCleanupTool from '../components/cq/StatusCleanupTool'
import CQSwapApprovalQueue from '../components/cq/CQSwapApprovalQueue'
import PassApprovalQueue from '../components/cq/PassApprovalQueue'
import SurveyComposer from '../components/surveys/SurveyComposer'
import SurveyManager from '../components/surveys/SurveyManager'
import SurveyResults from '../components/surveys/SurveyResults'
import { usePendingCount } from '../hooks/useWeatherRecommendations'
import { usePendingDetailApprovals } from '../hooks/useDetailAssignments'
import { useActiveShift } from '../hooks/useCQShifts'
import { usePendingSwapRequestCount } from '../hooks/useCQSwapRequests'
import { usePendingPassRequestCount } from '../hooks/usePassApproval'

export default function Admin() {
  const [activeTab, setActiveTab] = useState('posts')
  const [editingPost, setEditingPost] = useState(null)
  const [uotdSubTab, setUotdSubTab] = useState('uniforms')
  const [weatherSubTab, setWeatherSubTab] = useState('location')
  const [detailsSubTab, setDetailsSubTab] = useState('templates')
  const [cqSubTab, setCqSubTab] = useState('dashboard')
  const [personnelSubTab, setPersonnelSubTab] = useState('roster')
  const [surveySubTab, setSurveySubTab] = useState('create')
  const [editingSurvey, setEditingSurvey] = useState(null)
  const [viewingSurveyResults, setViewingSurveyResults] = useState(null)
  const { count: pendingCount } = usePendingCount()
  const { count: pendingDetailsCount } = usePendingDetailApprovals()
  const { activeShift } = useActiveShift()
  const { count: pendingSwapCount } = usePendingSwapRequestCount()
  const { count: pendingPassCount } = usePendingPassRequestCount()

  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'uotd', label: 'UOTD' },
    { id: 'approvals', label: 'Approvals', badge: pendingCount > 0 ? pendingCount : null },
    { id: 'details', label: 'Cleaning Details' },
    { id: 'cq', label: 'CQ', badge: activeShift ? '!' : null },
    { id: 'surveys', label: 'Surveys' },
    { id: 'documents', label: 'Documents' },
    { id: 'personnel', label: 'Personnel' },
    { id: 'config', label: 'Config' },
  ]

  function handleEditPost(post) {
    setEditingPost(post)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    setEditingPost(null)
  }

  function handlePostSaved() {
    setEditingPost(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Manage posts and documents</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 -mx-4 px-4 overflow-x-auto">
        <nav className="flex space-x-2 sm:space-x-4 md:space-x-8 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setEditingPost(null)
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        <div className="space-y-6">
          <PostComposer
            editPost={editingPost}
            onCancel={handleCancelEdit}
            onSaved={handlePostSaved}
          />
          <PostManager onEdit={handleEditPost} />
        </div>
      )}

      {activeTab === 'uotd' && (
        <div className="space-y-6">
          {/* UOTD Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setUotdSubTab('uniforms')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                uotdSubTab === 'uniforms'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Uniforms
            </button>
            <button
              onClick={() => setUotdSubTab('schedule')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                uotdSubTab === 'schedule'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setUotdSubTab('weather')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                uotdSubTab === 'weather'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Weather UOTD
            </button>
          </div>

          {uotdSubTab === 'uniforms' && <UniformManager />}
          {uotdSubTab === 'schedule' && <UotdScheduleManager />}
          {uotdSubTab === 'weather' && (
            <div className="space-y-6">
              {/* Weather Sub-tabs */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setWeatherSubTab('location')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    weatherSubTab === 'location'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Location
                </button>
                <button
                  onClick={() => setWeatherSubTab('rules')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    weatherSubTab === 'rules'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Rules
                </button>
                <button
                  onClick={() => setWeatherSubTab('check')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    weatherSubTab === 'check'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Weather Check
                </button>
              </div>

              {weatherSubTab === 'location' && <WeatherLocationManager />}
              {weatherSubTab === 'rules' && <WeatherRulesManager />}
              {weatherSubTab === 'check' && <ManualWeatherCheck />}
            </div>
          )}
        </div>
      )}

      {activeTab === 'approvals' && <WeatherApprovalQueue />}

      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Details Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDetailsSubTab('templates')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'templates'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setDetailsSubTab('assignments')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'assignments'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Assignments
            </button>
            <button
              onClick={() => setDetailsSubTab('approvals')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'approvals'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Approvals
              {pendingDetailsCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500 text-white">
                  {pendingDetailsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setDetailsSubTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'history'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setDetailsSubTab('import')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'import'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Import
            </button>
            <button
              onClick={() => setDetailsSubTab('settings')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'settings'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setDetailsSubTab('reset')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                detailsSubTab === 'reset'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Reset
            </button>
          </div>

          {detailsSubTab === 'templates' && <DetailTemplateManager />}
          {detailsSubTab === 'assignments' && (
            <div className="space-y-6">
              <TaskAssignmentForm />
              <DetailAssignmentList />
            </div>
          )}
          {detailsSubTab === 'approvals' && <DetailApprovalQueue />}
          {detailsSubTab === 'history' && <DetailHistory />}
          {detailsSubTab === 'import' && <DetailAssignmentImporter />}
          {detailsSubTab === 'settings' && <DetailNotificationSettings />}
          {detailsSubTab === 'reset' && <DetailResetTool />}
        </div>
      )}

      {activeTab === 'cq' && (
        <div className="space-y-6">
          {/* CQ Sub-tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCqSubTab('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'dashboard'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCqSubTab('schedule')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'schedule'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setCqSubTab('shifts')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'shifts'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Manual Shifts
            </button>
            <button
              onClick={() => setCqSubTab('status')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'status'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Personnel Status
            </button>
            <button
              onClick={() => setCqSubTab('notes')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'notes'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Notes Log
            </button>
            <button
              onClick={() => setCqSubTab('audit')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'audit'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Audit Log
            </button>
            <button
              onClick={() => setCqSubTab('maintenance')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'maintenance'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Maintenance
            </button>
            <button
              onClick={() => setCqSubTab('swaps')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'swaps'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Swap Requests
              {pendingSwapCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500 text-white">
                  {pendingSwapCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCqSubTab('passApprovals')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cqSubTab === 'passApprovals'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pass Approvals
              {pendingPassCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500 text-white">
                  {pendingPassCount}
                </span>
              )}
            </button>
          </div>

          {cqSubTab === 'dashboard' && <CQDashboard />}
          {cqSubTab === 'schedule' && <CQScheduleManager />}
          {cqSubTab === 'shifts' && <ShiftManager />}
          {cqSubTab === 'status' && <PersonnelStatusTracker />}
          {cqSubTab === 'notes' && <CQNotesLog />}
          {cqSubTab === 'audit' && <CQAuditLog />}
          {cqSubTab === 'maintenance' && <StatusCleanupTool />}
          {cqSubTab === 'swaps' && <CQSwapApprovalQueue />}
          {cqSubTab === 'passApprovals' && <PassApprovalQueue />}
        </div>
      )}

      {activeTab === 'surveys' && (
        <div className="space-y-6">
          {/* Survey Sub-tabs */}
          {!viewingSurveyResults && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSurveySubTab('create')
                  setEditingSurvey(null)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  surveySubTab === 'create'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Create Survey
              </button>
              <button
                onClick={() => {
                  setSurveySubTab('manage')
                  setEditingSurvey(null)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  surveySubTab === 'manage'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Manage Surveys
              </button>
            </div>
          )}

          {viewingSurveyResults ? (
            <SurveyResults
              survey={viewingSurveyResults}
              onBack={() => setViewingSurveyResults(null)}
            />
          ) : surveySubTab === 'create' ? (
            <SurveyComposer
              editSurvey={editingSurvey}
              onCancel={editingSurvey ? () => setEditingSurvey(null) : undefined}
              onSaved={() => {
                setEditingSurvey(null)
                setSurveySubTab('manage')
              }}
            />
          ) : (
            <SurveyManager
              onEdit={(survey) => {
                setEditingSurvey(survey)
                setSurveySubTab('create')
              }}
              onViewResults={(survey) => setViewingSurveyResults(survey)}
            />
          )}
        </div>
      )}

      {activeTab === 'documents' && <DocumentUpload />}

      {activeTab === 'personnel' && (
        <div className="space-y-6">
          {/* Personnel Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPersonnelSubTab('roster')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                personnelSubTab === 'roster'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Roster
            </button>
            <button
              onClick={() => setPersonnelSubTab('add')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                personnelSubTab === 'add'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Add
            </button>
            <button
              onClick={() => setPersonnelSubTab('import')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                personnelSubTab === 'import'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Import
            </button>
            <button
              onClick={() => setPersonnelSubTab('config')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                personnelSubTab === 'config'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Config
            </button>
          </div>

          {personnelSubTab === 'roster' && <PersonnelRosterTable />}
          {personnelSubTab === 'add' && <PersonnelAddForm onSuccess={() => setPersonnelSubTab('roster')} />}
          {personnelSubTab === 'import' && <PersonnelRosterUpload />}
          {personnelSubTab === 'config' && <PersonnelConfigPanel />}
        </div>
      )}

      {activeTab === 'config' && <ConfigManager />}
    </div>
  )
}
