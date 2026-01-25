# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.9] - 2026-01-24

### Fixed
- CQ Shift 2 date display now shows correct calendar date (the day after schedule date, since 0100-0600 is after midnight)
- Swap request modals and approval queue now display correct dates for Shift 2

### Added
- `getActualShiftDate()` utility function for calculating actual shift dates

---

## [0.4.8] - 2026-01-24

### Added

#### Timezone Consistency
- Timezone clock in footer showing configured timezone (e.g., "EST: 14:35")
- CQ shift scheduling now uses configured timezone for shift times and dates

### Fixed
- Audit log display now uses configured timezone instead of browser local time
- Audit log sign-out counting incorrectly included companion sign-outs (was double-counting)
- Edit buttons now appear for legacy format CQ schedule entries
- CQ shift swap availability filtering improved to correctly exclude unavailable shifts
- vitest OOM issues with useCQSwapRequests tests resolved

---

## [0.4.7] - 2026-01-24

### Added

#### Full Shift Swap Support
- Users can now swap entire shifts (both people) with another shift
- Choose between "Individual" (replace one person) or "Full Shift" swap types
- Select target shift from upcoming schedule dates
- Approval queue shows swap type with distinct badge for full shift swaps

#### CQ Schedule Editing for Candidate Leadership
- Candidate Leadership role can now edit CQ shift assignments
- Edit buttons visible to both Admin and Candidate Leadership in schedule view

### Changed
- Firestore rules updated to allow candidate_leadership to update cqSchedule
- Swap requests now support swapType field (individual or fullShift)

### Fixed
- Weather approval workflow crash when approving uniform overrides (e.g., wet weather gear) - uniformId was null causing Firestore path error (Sentry #7216023775)

---

## [0.4.6] - 2026-01-24

### Added

#### CQ Shift Editing (Admin)
- Admins can now edit imported CQ shift assignments directly
- Edit button next to each person in schedule view
- Search and select from personnel roster to swap users
- Real-time updates to shift assignments

#### CQ Shift Swap Requests
- Users can request to swap their CQ shifts with another person
- "Request Swap" button on MyCQShiftCard for assigned shifts
- Select replacement personnel and provide reason for swap
- Pending swap request indicator on shift card

#### Shift Swap Approval Workflow
- New "Swap Requests" sub-tab in CQ admin section with pending count badge
- Candidate Leadership and Admin roles can approve/reject swap requests
- Bulk approve/reject functionality for multiple requests
- Rejection modal with optional reason
- Approved swaps automatically update the schedule

### Changed
- Added cqSwapRequests Firestore collection with security rules
- useCQScheduleActions now includes updateShiftAssignment function

---

## [0.4.5] - 2026-01-24

### Added

#### CQ Schedule Management (Dual Shifts)
- New CQ schedule format with 2 people per shift
- Shift 1: 2000-0100 (8 PM to 1 AM)
- Shift 2: 0100-0600 (1 AM to 6 AM)
- CSV import with format: date, shift, user1, user2, isPotentialSkip
- Potential skip day labeling (orange highlight) for quiz/PT test days
- Schedule display shows all 4 assigned personnel per day

#### CQ Shift Card Enhancement
- MyCQShiftCard now shows shifts the day before for overnight shifts
- Shift 2 (0100-0600) displays the evening before since it starts after midnight
- "Tonight" badge (blue) for upcoming overnight shifts
- "(starts after midnight)" indicator for shift 2 previews
- Partner name display for each shift

### Changed
- useMyCQShift hook now queries both today and tomorrow to catch overnight shifts
- Updated Firestore rules for cqSchedule, cqRoster, and cqSkips collections

---

## [0.4.4] - 2026-01-24

### Added

#### Pass Approval System
- Users can submit pass requests with destination, expected return time, contact number, and notes
- Support for companions (group sign-out requests)
- Candidate Leadership role can approve/reject pass requests
- Push notifications sent to candidate_leadership and admins when pass requests are created
- Approval automatically signs out requester and companions
- Pass request history tracked in personnelStatusHistory
- PassApprovalQueue component for leadership to manage pending requests
- Bulk approve/reject functionality
- SelfSignOutForm integrates pass approval workflow for regular users
- Admins and candidate leadership can still sign out directly without approval
- Pending request status shown with cancel option
- Recent rejection notices displayed with reason

#### New Role: Candidate Leadership
- New `candidate_leadership` role between uniform_admin and admin
- Can approve pass requests and manage CQ operations
- Added to role hierarchy and permissions system
- APPROVE_PASS_REQUESTS permission added

### Changed
- Updated Firestore rules for passApprovalRequests collection
- Role hierarchy now includes candidate_leadership

---

## [0.4.3] - 2026-01-24

### Added

#### Sentry Error Tracking & Performance Monitoring
- Frontend error tracking with `@sentry/react` integration
- Backend error tracking with `@sentry/node` for Cloud Functions
- React Error Boundary with user-friendly fallback UI
- Automatic user context (uid, email, role) attached to error reports
- Performance monitoring with configurable sample rates
- Source map upload support for readable stack traces in production
- Console logging integration sends console.log/warn/error to Sentry Logs

#### Sentry Wrappers for Cloud Functions
- `wrapCallable()` - Wraps callable functions with error tracking and user context
- `wrapScheduled()` - Wraps scheduled functions with breadcrumbs and error capture
- `wrapFirestoreTrigger()` - Wraps Firestore triggers with document context

#### Error Filtering
- Auth popup errors filtered out (user-closed, blocked, cancelled)
- Network errors filtered (offline, timeouts)
- Expected permission-denied errors filtered
- Service worker load failures filtered (transient PWA errors)
- Firebase Auth API transient errors filtered
- Sensitive data scrubbed from headers and URLs

#### Profile Self-Service
- Users can edit their own phone number and room number from Profile page
- Profile changes sync to both users and personnel collections
- Personnel info (rank, name, flight) displayed on profile

### Changed
- All Cloud Functions now wrapped with Sentry error tracking
- Vite build now generates source maps for Sentry
- Updated Firestore rules to allow users to update own personnel record (phone/room only)

---

## [0.4.2] - 2026-01-24

### Added
- Survey response editing: Users can now edit/update their previously submitted survey responses from both the main Surveys page and Admin dashboard
- Survey results viewing: Users who have responded can view aggregated results from the main Surveys page
- Pending survey card on Home page: Shows unanswered surveys, disappears after user responds
- Push notifications for new surveys: Users receive notifications when surveys are published

### Changed
- nix-shell prompt now shows git branch and status indicators (* for uncommitted changes, ? for untracked files)

---

## [0.4.1] - 2026-01-24

### Fixed
- CQ Shifts permission error: Non-admin users can now view CQ shifts (read access opened to all authenticated users, write access remains admin-only)

---

## [0.4.0] - 2026-01-23

### Added

#### Surveys, Quizzes & Polls
- Complete survey system allowing any authenticated user to create and manage surveys
- Six question types supported:
  - **Single Choice** - Radio button selection (one answer)
  - **Multiple Choice** - Checkbox selection (multiple answers)
  - **Short Text** - Single line text input
  - **Long Text** - Paragraph text input
  - **Rating** - 1-5 or 1-10 scale rating
  - **Open Contribution** - Everyone adds their own answer (e.g., "What's your favorite song?")
- Three survey types: Survey, Quiz, Poll
- Survey options:
  - Allow anonymous responses
  - Allow multiple responses per user
- Survey lifecycle: Draft → Published → Closed
- Results viewing with two modes:
  - **Summary View** - Aggregated statistics with bar charts for choices, averages for ratings, and collected text responses
  - **Individual View** - See each respondent's complete answers
- Export functionality:
  - **CSV** - Spreadsheet-compatible format with all responses
  - **JSON** - Full data export including survey definition and aggregated results
  - **PDF** - Formatted report with summary statistics and response table

#### Navigation & Access
- New "Surveys" link in main navigation (available to all users)
- New "Surveys" tab in Admin dashboard with sub-tabs:
  - Create Survey - Build new surveys with drag-and-drop question ordering
  - Manage Surveys - List, edit, publish, close, and delete surveys
- Public Surveys page (`/surveys`) for users to view and complete surveys
- Completion status shown on survey cards (prevents duplicate submissions unless allowed)

#### Security
- Firestore security rules for `surveys` and `surveyResponses` collections
- Creators can edit/delete their own surveys
- Admins can manage all surveys and delete any responses
- Response ownership validation for updates

#### Infrastructure
- Composite Firestore indexes for survey queries (status, createdBy, createdAt)
- Composite Firestore indexes for survey response queries (surveyId, submittedAt, respondentId)

---

## [0.3.0] - 2026-01-23

### Added

#### CQ Signout Roster PDF Export
- Export pass audit log as PDF matching military DA Form signout roster format
- Columns: Date (DDMMMYY), Name (Last, First), Room #, Flight, Week of Training, Destination, Contact #, Time Out, Expected Return, Initials, Actual Time In, CQ Initials
- Export with data populated from audit log entries
- Export blank roster form for printing
- Auto-calculate initials from personnel name (first initial + last initial)
- Calculate week of training from configurable training start date
- Training Start Date added to app configuration settings
- Room and flight info pulled from personnel records

### Dependencies
- Added jspdf (^4.0.0) for PDF generation
- Added jspdf-autotable (^5.0.7) for table formatting

---

## [0.2.0] - 2026-01-23

### Added

#### Role-Based Access Control (RBAC)
- Centralized role constants and permissions system (`src/lib/roles.js`)
- Three role levels: User, Uniform Admin, Admin
- Role management UI in Personnel tab
  - Role column with color-coded badges (User=gray, Uniform Admin=blue, Admin=purple)
  - Inline role editing for admins via dropdown
- Permission-based access control via `AuthContext.can(permission)` method
- Role sync between personnel and users collections
- Cloud Function (`syncPersonnelRoleToUser`) to sync role changes to linked user accounts
- Pre-assignment of roles on personnel records before user links their account

#### New Permissions
- `VIEW_ASSIGNED_DETAILS` - View assigned cleaning details
- `SIGN_OTHERS_ON_PASS` - Sign others out on pass
- `VIEW_UPDATES` - View updates and announcements
- `MODIFY_UOTD` - Create/edit UOTD posts
- `APPROVE_WEATHER_UOTD` - Approve weather recommendations
- `MODIFY_UNIFORMS` - Manage uniform catalog
- `MANAGE_POSTS` - Create/edit/delete posts
- `MANAGE_DOCUMENTS` - Manage document uploads
- `MANAGE_PERSONNEL` - Manage personnel records
- `MANAGE_ROLES` - Change user roles (admin only)
- `MANAGE_DETAILS` - Manage cleaning details
- `MANAGE_CQ` - Manage CQ shifts
- `MANAGE_CONFIG` - Manage app configuration

### Fixed
- Companion pass sign-out ID mismatch: When signing out with companions, their status documents now use Auth UID instead of personnel doc ID, ensuring group sign-in correctly updates all members' status
- Auth race condition: Fixed brief flash of user content before personnel check completed. Auth state (user, role, loading) is now set atomically only after all verification passes, with guards to abort if auth changes during async operations

### Changed
- AuthContext now uses centralized role constants from `lib/roles.js`
- Personnel CSV import supports role field
- PersonnelEditModal includes role dropdown (visible to admins only)
- PersonnelRosterTable displays role column with inline editing

---

## [0.1.0] - 2026-01-23

### Added

#### Weather-Based UOTD System
- Automatic weather checking at configured UOTD schedule times
- 30-90 minute forecast window for accurate recommendations (weather when students will actually be outside)
- Sunrise/sunset data for twilight detection
- Smart accessory recommendation engine with configurable rules:
  - **Rain/Storm** → Wet Weather Gear (OCP, ECWS, Water source)
  - **Below 40°F** → Fleece Jacket + Watch Cap
  - **40-45°F** → Fleece Jacket + Patrol Cap
  - **Twilight/Nighttime** → Reflective Belt + Light Source (auto-added)
  - **High Wind (>20mph)** → Secured headgear note
- Weather labels on UOTD cards (Wet, Snow, Cold, Cool, Hot)
- Meal slot labels (Breakfast, Lunch, Dinner)

#### Push Notifications
- Single unified notification when UOTD posts are created
- Format: `🔴 BETA | UOTD Breakfast Wet Posted at 0600 on Jan 23 2026`
- Includes uniform name, items, and auto-added accessories with reasons

#### UI Improvements
- Red BETA label on UOTD cards
- Warning banner: "Use Williams' Signal posts as source of truth!"
- Weather condition icons on UOTD cards
- Both current and forecast weather stored in recommendations

#### Duplicate Prevention
- Weather system takes precedence when rules are configured
- `uotdScheduler` defers to weather system to prevent duplicate posts
- Defense-in-depth duplicate checks in approval workflow

#### Infrastructure
- Personnel roster import foundation (CSV/Excel)
- Cleaning details management
- CQ (Charge of Quarters) tracker foundation

### Fixed
- Duplicate UOTD notifications issue resolved
- Weather recommendations now use forecast data instead of current conditions

### Changed
- Renamed "PT Belt" to "Reflective Belt" in accessory rules
- Renamed "Flashlight" to "Light Source" in accessory rules
- Notification format updated to match card display

---

## [Unreleased]

### Planned
- Cleaning details assignment and tracking
- CQ status board with DA Form generation
- Remove BETA label when system is validated
