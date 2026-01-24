import { Link } from 'react-router-dom'

const APP_VERSION = '0.4.2'

const changelog = [
  {
    version: '0.4.2',
    date: '2026-01-24',
    sections: [
      {
        title: 'Added',
        items: [
          {
            details: [
              'Survey response editing: Users can now edit/update their previously submitted survey responses from both the main Surveys page and Admin dashboard',
              'Survey results viewing: Users who have responded can view aggregated results from the main Surveys page',
              'Pending survey card on Home page: Shows unanswered surveys, disappears after user responds',
              'Push notifications for new surveys: Users receive notifications when surveys are published',
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-01-24',
    sections: [
      {
        title: 'Fixed',
        items: [
          {
            details: [
              'CQ Shifts permission error: Non-admin users can now view CQ shifts (read access opened to all authenticated users, write access remains admin-only)',
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-01-23',
    sections: [
      {
        title: 'Added',
        items: [
          {
            category: 'Surveys, Quizzes & Polls',
            details: [
              'Complete survey system allowing any authenticated user to create and manage surveys',
              'Six question types: Single Choice, Multiple Choice, Short Text, Long Text, Rating, Open Contribution',
              'Three survey types: Survey, Quiz, Poll',
              'Survey options: Allow anonymous responses, allow multiple responses per user',
              'Survey lifecycle: Draft → Published → Closed',
              'Results viewing with Summary View (aggregated stats) and Individual View (per-respondent)',
              'Export to CSV, JSON, and PDF formats',
            ],
          },
          {
            category: 'Navigation & Access',
            details: [
              'New "Surveys" link in main navigation (available to all users)',
              'New "Surveys" tab in Admin dashboard with Create and Manage sub-tabs',
              'Public Surveys page for users to view and complete surveys',
              'Completion status shown on survey cards',
            ],
          },
          {
            category: 'Security & Infrastructure',
            details: [
              'Firestore security rules for surveys and surveyResponses collections',
              'Creators can edit/delete their own surveys, admins can manage all',
              'Composite Firestore indexes for survey queries',
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-01-23',
    sections: [
      {
        title: 'Added',
        items: [
          {
            category: 'CQ Signout Roster PDF Export',
            details: [
              'Export pass audit log as PDF matching military DA Form signout roster format',
              'Columns: Date, Name, Room #, Flight, Week of Training, Destination, Contact #, Time Out, Expected Return, Initials, Actual Time In, CQ Initials',
              'Export with data populated from audit log entries',
              'Export blank roster form for printing',
              'Auto-calculate initials from personnel name (first + last initial)',
              'Calculate week of training from configurable training start date',
              'Training Start Date added to app configuration settings',
              'Room and flight info pulled from personnel records',
            ],
          },
        ],
      },
      {
        title: 'Dependencies',
        items: [
          { details: ['Added jspdf for PDF generation'] },
          { details: ['Added jspdf-autotable for table formatting'] },
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-01-23',
    sections: [
      {
        title: 'Added',
        items: [
          {
            category: 'Role-Based Access Control (RBAC)',
            details: [
              'Centralized role constants and permissions system',
              'Three role levels: User, Uniform Admin, Admin',
              'Role management UI in Personnel tab',
              'Role column with color-coded badges (User=gray, Uniform Admin=blue, Admin=purple)',
              'Inline role editing for admins via dropdown',
              'Permission-based access control via AuthContext.can() method',
              'Role sync between personnel and users collections',
              'Cloud Function to sync role changes to linked user accounts',
              'Pre-assignment of roles on personnel records before user links their account',
            ],
          },
          {
            category: 'New Permissions',
            details: [
              'VIEW_ASSIGNED_DETAILS - View assigned cleaning details',
              'SIGN_OTHERS_ON_PASS - Sign others out on pass',
              'VIEW_UPDATES - View updates and announcements',
              'MODIFY_UOTD - Create/edit UOTD posts',
              'APPROVE_WEATHER_UOTD - Approve weather recommendations',
              'MODIFY_UNIFORMS - Manage uniform catalog',
              'MANAGE_POSTS - Create/edit/delete posts',
              'MANAGE_DOCUMENTS - Manage document uploads',
              'MANAGE_PERSONNEL - Manage personnel records',
              'MANAGE_ROLES - Change user roles (admin only)',
              'MANAGE_DETAILS - Manage cleaning details',
              'MANAGE_CQ - Manage CQ shifts',
              'MANAGE_CONFIG - Manage app configuration',
            ],
          },
        ],
      },
      {
        title: 'Changed',
        items: [
          { details: ['AuthContext now uses centralized role constants from lib/roles.js'] },
          { details: ['Personnel CSV import supports role field'] },
          { details: ['PersonnelEditModal includes role dropdown (visible to admins only)'] },
          { details: ['PersonnelRosterTable displays role column with inline editing'] },
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-23',
    sections: [
      {
        title: 'Added',
        items: [
          {
            category: 'Weather-Based UOTD System',
            details: [
              'Automatic weather checking at configured UOTD schedule times',
              '30-90 minute forecast window for accurate recommendations',
              'Sunrise/sunset data for twilight detection',
              'Smart accessory recommendation engine with configurable rules',
            ],
          },
          {
            category: 'Accessory Rules',
            details: [
              'Rain/Storm → Wet Weather Gear (OCP, ECWS, Water source)',
              'Below 40°F → Fleece Jacket + Watch Cap',
              '40-45°F → Fleece Jacket + Patrol Cap',
              'Twilight/Nighttime → Reflective Belt + Light Source (auto-added)',
              'High Wind (>20mph) → Secured headgear note',
            ],
          },
          {
            category: 'Push Notifications',
            details: [
              'Single unified notification when UOTD posts are created',
              'Includes uniform name, items, and auto-added accessories',
              'Weather and meal slot labels',
            ],
          },
          {
            category: 'UI Improvements',
            details: [
              'Red BETA label on UOTD cards',
              'Warning banner for source of truth',
              'Weather condition icons on UOTD cards',
              'Weather labels (Wet, Snow, Cold, Cool, Hot)',
              'Meal slot labels (Breakfast, Lunch, Dinner)',
            ],
          },
          {
            category: 'Infrastructure',
            details: [
              'Personnel roster import foundation (CSV/Excel)',
              'Cleaning details management',
              'CQ (Charge of Quarters) tracker foundation',
              'Duplicate UOTD prevention system',
            ],
          },
        ],
      },
      {
        title: 'Fixed',
        items: [
          { details: ['Duplicate UOTD notifications issue resolved'] },
          { details: ['Weather recommendations now use forecast data instead of current conditions'] },
        ],
      },
    ],
  },
]

const planned = [
  'Cleaning details assignment and tracking',
  'CQ status board with DA Form generation',
  'Remove BETA label when system is validated',
]

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Changelog</h1>
            <p className="text-gray-600">What's new in WOTS App</p>
          </div>
          <Link
            to="/profile"
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            ← Back to Profile
          </Link>
        </div>
      </div>

      {/* Current Version Banner */}
      <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-bold rounded bg-primary-600 text-white">
            CURRENT
          </span>
          <span className="font-semibold text-primary-900">v{APP_VERSION}</span>
        </div>
      </div>

      {/* Changelog Entries */}
      {changelog.map((release) => (
        <div key={release.version} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">v{release.version}</h2>
            <span className="text-sm text-gray-500">{release.date}</span>
          </div>

          {release.sections.map((section) => (
            <div key={section.title} className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                {section.title === 'Added' && (
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                )}
                {section.title === 'Fixed' && (
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                )}
                {section.title === 'Changed' && (
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                )}
                {section.title === 'Dependencies' && (
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                )}
                {section.title}
              </h3>

              <div className="space-y-3">
                {section.items.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
                    {item.category && (
                      <h4 className="font-medium text-gray-900 mb-2">{item.category}</h4>
                    )}
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {item.details.map((detail, i) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Planned Features */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          Planned
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          {planned.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
