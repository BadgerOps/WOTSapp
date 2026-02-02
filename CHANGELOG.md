# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-02-02

### Added

#### New Leave Admin Role
- **New `leave_admin` role** - Specialized role for managing leave and pass requests
- Role positioned between `uniform_admin` and `candidate_leadership` in hierarchy
- Leave admins can approve/reject pass and liberty requests
- Leave admins can create requests on behalf of other users

#### Leave Admin Panel
- **New "Leave Admin" tab** in Admin → CQ section
- **Create pass requests on behalf of users**:
  - Select personnel from searchable dropdown
  - Specify destination, expected return time, contact number, and notes
  - Option to auto-approve and sign out immediately (default) or create as pending
  - Auto-approves create personnel status, history entries, and sign out the user
- **Create liberty requests on behalf of users**:
  - Select personnel and choose from standard locations or specify custom
  - Set departure/return dates and times
  - Add purpose, contact number, and notes
  - Create as approved (default) or pending status
  - Weekend date auto-calculated

#### Admin Leave Request Hooks
- `useLeaveAdminActions()` hook with `createLibertyRequestForUser()` function
- `usePassAdminActions()` hook with `createPassRequestForUser()` function
- Both hooks support creating requests with `createdOnBehalfOf` tracking
- Auto-approval flow signs out users and creates history entries
- Batch operations for efficient database writes

### New Files
- `src/components/cq/LeaveAdminPanel.jsx` - Admin UI for creating leave/pass requests for others
- `src/hooks/useLibertyRequests.test.js` - Unit tests for liberty request hooks

### Modified Files
- `src/lib/roles.js` - Added `LEAVE_ADMIN` role with permissions: `APPROVE_PASS_REQUESTS`, `VIEW_PASS_REQUESTS`, `CREATE_LEAVE_FOR_OTHERS`
- `src/lib/roles.test.js` - Updated tests for new role
- `src/contexts/AuthContext.jsx` - Added `isLeaveAdmin`, `canCreateLeaveForOthers`, updated `hasApprovalAuthority`
- `src/hooks/useLibertyRequests.js` - Added `useLeaveAdminActions()` hook
- `src/hooks/usePassApproval.js` - Added `usePassAdminActions()` hook
- `src/hooks/usePassApproval.test.js` - Added tests for `usePassAdminActions`
- `src/pages/Admin.jsx` - Added Leave Admin sub-tab to CQ section
- `src/components/personnel/PersonnelRoleCell.test.jsx` - Updated for new role option
- `firestore.rules` - Added `isLeaveAdmin()` function, updated passApprovalRequests and libertyRequests rules

### Security
- Firestore rules allow leave_admin to read all pass/liberty requests
- Firestore rules allow leave_admin to create requests on behalf of others (when `createdOnBehalfOf` is true)
- Firestore rules allow leave_admin to approve/reject requests

---

## [0.5.4] - 2026-02-02

### Added

#### Weekend Liberty Request System
- **New liberty request workflow** for submitting weekend plans prior to the weekend
- **LibertyRequestForm component** (`/cq` page, Accountability tab) - Submit liberty requests with:
  - Destination (Shoppette, BX/Commissary, Gym, Library, or custom)
  - Departure date and time
  - Return date and time
  - Contact number (auto-populated from personnel record)
  - Purpose/reason for liberty
  - Optional companions (searchable personnel list)
- **MyLibertyCard component** on Home page showing:
  - Approved liberty details (green card with destination, times, companions)
  - Pending request status (yellow card with submission details)
  - Prompt to submit request when within deadline window (blue card)
- **LibertyApprovalQueue component** for candidate leadership to:
  - View all pending liberty requests
  - Bulk select and approve/reject requests
  - Expandable detail view showing full request information
  - Rejection modal with optional reason
- **Liberty tab in Approvals page** with real-time badge count

#### Liberty Request Administration
- **LibertyRequestsManager component** in Admin → CQ → Liberty Requests tab:
  - Table view of all liberty requests with filters (status, weekend)
  - Expandable row details showing full request information
  - CSV export with all request data for OPLAN loading
  - Status summary showing counts by status

#### Liberty Group Join System
- **ApprovedLibertyList component** on `/cq` page (Accountability tab):
  - View all liberty groups (pending and approved) for the upcoming weekend
  - See group leader, companions, destination, and times
  - Status badges show "Pending Approval" (yellow) or "Approved" (green)
  - "Request to Join" button to join existing groups
- **Join request workflow**:
  - Users can request to join pending OR approved liberty groups (before deadline lockdown)
  - Group leaders see pending join requests with badge count
  - Approve/Decline buttons for group leaders
  - Approved members automatically added as companions
  - Cancel pending join request option

#### Configurable Liberty Deadline
- **Liberty Request Deadline settings** in Admin → Config tab:
  - Day of week dropdown (Sunday through Saturday, default: Tuesday)
  - Time picker for deadline cutoff (default: 23:59)
- **Dynamic deadline enforcement** - requests blocked after configured deadline
- **Deadline display** shows configured day and time in forms and cards

### New Files
- `src/hooks/useLibertyRequests.js` - Liberty request data operations, deadline utilities, and join actions
- `src/components/cq/LibertyRequestForm.jsx` - User form for submitting liberty requests
- `src/components/cq/LibertyApprovalQueue.jsx` - Leadership approval queue
- `src/components/cq/MyLibertyCard.jsx` - Home page liberty status card
- `src/components/cq/LibertyRequestsManager.jsx` - Admin table view with CSV export
- `src/components/cq/ApprovedLibertyList.jsx` - Public approved groups list with join functionality

### Modified Files
- `src/hooks/useAppConfig.js` - Added `libertyDeadlineDayOfWeek` and `libertyDeadlineTime` defaults
- `src/hooks/useUnifiedApprovalCount.js` - Added `libertyCount` and `canApproveLiberty`
- `src/components/admin/ConfigManager.jsx` - Added Liberty Request Deadline section
- `src/pages/Admin.jsx` - Added Liberty Requests sub-tab to CQ section
- `src/pages/Approvals.jsx` - Added Liberty tab
- `src/pages/CQView.jsx` - Added LibertyRequestForm and ApprovedLibertyList to Accountability tab
- `src/pages/Home.jsx` - Added MyLibertyCard component
- `firestore.rules` - Added libertyRequests collection rules with join request support
- `firestore.indexes.json` - Added libertyRequests indexes including approved+weekend query

---

## [0.5.3] - 2026-02-01

### Added

#### CQ Schedule Visible to All Users
- **New "Upcoming CQ Schedule" section on the /cq page** - all authenticated users can now see who's on CQ duty for the next 14 days
- **Clean, read-only display** showing both shifts (2000-0100 and 0100-0600) with assigned personnel
- **Today's shift highlighted** with "Tonight" badge for quick reference
- **Potential skip days marked** with orange highlighting (for quiz/PT test days)
- Component: `UpcomingCQSchedule.jsx` - reusable with configurable day limit

#### Tabbed CQ Page Layout
- **/cq page now uses tabs** to separate CQ schedule from personnel accountability
- **Schedule tab** (default): Current active shift + upcoming 14-day schedule
- **Accountability tab**: Sign-out form, personnel status summary, status table, and recent CQ notes
- **Badge on Accountability tab** shows count of personnel currently out on pass

---

## [0.5.2] - 2026-01-28

### Added

#### Automatic Daily Detail Assignment Cloning
- **Details now auto-reset each day** at configured notification times (default 07:00 and 19:00)
- When the scheduled reminder runs, if no assignment exists for today's time slot, the most recent completed/approved assignment is cloned
- Cloned assignments have all tasks reset to uncompleted with fresh `assigned` status
- The `clonedFrom` field tracks which assignment was used as the source
- This eliminates the need for admins to manually create new assignments each day

### Fixed

#### CQ Schedule Retroactive Skip
- **`skipDate()` now supports retroactive skips** - previously only worked for future dates
- Skipping a past date (e.g., last night's CQ) now correctly shifts all subsequent assignments forward by one day
- **Day of week updates automatically** - when dates shift, the `dayOfWeek` field is recalculated using the configured timezone
- Example: Skip Jan 27 → Jan 27's people move to Jan 28, Jan 28's people move to Jan 29, etc.

#### Daily Detail Card Display Timing
- **Evening time slot now starts at 19:00 (7:00 PM)** instead of 19:30 - cards were appearing 30 minutes late
- **Timezone-aware date comparison** - fixed UTC date bug where cards wouldn't show because `today` was calculated in UTC instead of the configured timezone (America/New_York)
  - At 8 PM EST, UTC is already the next day, causing `assignmentDate === today` to fail
  - Now uses `getTodayInTimezone()` for consistent date handling

#### Time Windows
- Morning: 07:00 - 12:00 (unchanged)
- Evening: 19:00 - 23:59 (was 19:30 - 23:59)

---

## [0.5.1] - 2026-01-27

### Fixed

#### Firestore Permission Error on Login
- **`useUnifiedApprovalCount` was querying wrong collection name** - queried `passRequests` instead of `passApprovalRequests`
- This caused "Missing or insufficient permissions" errors in the Firestore snapshot listener for users with approval authority

#### Date Parsing Errors (continued from 0.5.0)
- **`safeParseDate()` now validates Firestore Timestamp conversion** - the `.toDate()` result is now checked with `isValid()` before returning
- **Fixed `DetailChecklistView` task completion time display** - was using `new Date(task.completedAt)` directly instead of `safeParseDate()`, causing `RangeError: Invalid time value` when viewing completed tasks

#### Detail Assignment Completion Permission Error
- **"Submit for Approval" button now checks assignment status** - buttons in `DetailChecklistView` and `MyDetailCard` now verify status is `in_progress` before showing
- Firestore rules only allow `in_progress → completed` transition; showing the button without this check caused permission errors

---

## [0.5.0] - 2026-01-27

### Added

#### Unified Approvals Tab
- **New top-level "Approvals" navigation tab** for users with approval authority (`candidate_leadership`, `uniform_admin`, or `admin` roles)
- **Consolidates all approval workflows** into a single location:
  - **Passes** - Pass request approvals (candidate_leadership, admin)
  - **Details** - Cleaning detail completion approvals (candidate_leadership, admin)
  - **CQ Swaps** - CQ shift swap request approvals (candidate_leadership, admin)
  - **Weather** - Weather-based UOTD recommendation approvals (uniform_admin, admin)
- **Real-time badge counter** in navbar showing total pending approval count
- **Tabbed interface** within Approvals page for each approval type
- **Permission-filtered tabs** - users only see tabs for approvals they can action
- **`hasApprovalAuthority`** property added to AuthContext for easy permission checking

#### Cleaning Details Multi-Select Workflow
- **Multi-select task starting** - Select which tasks to start instead of starting all at once
  - Checkbox list of assigned tasks with individual selection
  - "Select All" checkbox header for bulk selection
  - "Start Selected (N)" button showing count of selected tasks
  - All tasks selected by default when viewing
- **Multi-select task completion** - Complete multiple tasks in batch
  - "Complete Selected (N)" button replaces Start after beginning detail
  - All incomplete tasks selected by default for efficient completion
  - Individual task deselection supported
- **`completeSelectedTasks()`** action added to `useDetailCardActions` hook
- **Improved task tracking** using Set-based state management with task keys (`taskId-location`)

#### Detail Push Notification System
- **Scheduled cloud function** (`scheduledDetailReminder`) runs hourly to check for notification times
- **Configurable notification times** - Morning and evening times adjustable in Admin panel
  - Default: 07:00 (morning) and 19:00 (evening)
  - Times stored in `detailConfig/default` Firestore document
- **Time-slot aware notifications** - Morning notifications for morning/both details, evening for evening/both
- **Global timezone support** - Uses `getConfiguredTimezone()` from app settings (never hardcoded)
- **FCM push notifications** sent to users with assigned details for current time slot
  - Title: "Detail Reminder: [Morning/Evening] Cleaning"
  - Body: Template name and task count
- **Admin notification settings UI** (`DetailNotificationSettings.jsx`)
  - Toggle to enable/disable notifications
  - Time inputs for morning and evening notification times
  - Shows configured timezone for clarity
  - Available under Admin → Details → Settings sub-tab

### New Files
- `functions/detailNotifications.js` - Scheduled detail reminder cloud function
- `src/pages/Approvals.jsx` - Unified approvals page with tabbed interface
- `src/hooks/useUnifiedApprovalCount.js` - Combined pending approval counts hook
- `src/components/admin/DetailNotificationSettings.jsx` - Admin UI for notification settings

### Fixed

#### Date Parsing Errors
- **`safeParseDate()` helper** added to `MyDetails.jsx` and `DetailChecklistView.jsx`
- Handles Firestore Timestamps, Date objects, ISO strings, and `YYYY-MM-DD` format
- Gracefully displays "Unknown date" when dates cannot be parsed
- Fixes `RangeError: Invalid time value` when viewing detail assignments

#### Detail Card Visibility
- **In-progress and rejected details now show on home screen regardless of time window**
- Previously, details only appeared during morning (7am-12pm) or evening (7:30pm-midnight) windows
- Users can now complete and submit their started details at any time of day

#### Modal Auto-Close After Starting
- `DetailChecklistView` modal now closes automatically after successfully starting a detail
- User returns to the list view and can see the detail card on the home screen

### Changed

#### CI/CD Optimization
- Disabled npm cache in GitHub Actions workflows (`pr.yml` and `release.yml`)
- 713MB cache upload on every lockfile change was slower than running `npm ci` fresh

### New Files
- `functions/detailNotifications.js` - Scheduled detail reminder cloud function
- `src/pages/Approvals.jsx` - Unified approvals page with tabbed interface
- `src/hooks/useUnifiedApprovalCount.js` - Combined pending approval counts hook
- `src/components/admin/DetailNotificationSettings.jsx` - Admin UI for notification settings

### Modified Files
- `functions/index.js` - Export `scheduledDetailReminder` function
- `src/App.jsx` - Add `/approvals` route with lazy loading
- `src/components/layout/Navbar.jsx` - Add Approvals tab with badge for approval authority users
- `src/contexts/AuthContext.jsx` - Add `hasApprovalAuthority` computed property
- `src/components/details/MyDetailCard.jsx` - Complete rewrite with multi-select UI, show in_progress details outside time windows
- `src/hooks/useMyActiveDetail.js` - Add `completeSelectedTasks()` action, return in_progress/rejected details regardless of time slot
- `src/hooks/useDetailConfig.js` - Add notification time defaults
- `src/pages/Admin.jsx` - Add Settings sub-tab to details section
- `src/pages/MyDetails.jsx` - Add `safeParseDate()` for robust date handling
- `src/components/details/DetailChecklistView.jsx` - Add `safeParseDate()`, auto-close on start
- `.github/workflows/pr.yml` - Disable npm cache for faster CI
- `.github/workflows/release.yml` - Disable npm cache for faster CI

---

## [0.4.18] - 2026-01-27

### Fixed
- PWA navigation fallback: Fixed "text/html is not a valid JavaScript MIME type" error when directly navigating to SPA routes (e.g., /schedule) or refreshing the page
- Added workbox `navigateFallback` configuration to properly serve index.html for client-side routes

---

## [0.4.17] - 2026-01-27

### Changed
- Version display now derives from package.json for Profile and in-app changelog

---

## [0.4.16] - 2026-01-27

### Changed
- Documentation alignment: updated AGENTS/README/CONTRIBUTING to match current roles, env vars, scripts, and project structure
- Added clarification about Firestore rules/indexes deploy step and deploy-all script
- Documented optional Sentry and Web Push (VAPID) environment variables
- Added Firestore collections overview to README and noted functions install step for local dev

---

## [0.4.15] - 2026-01-26

### Added

#### Cleaning Details Self-Assignment
- Users can now sign up for cleaning detail tasks directly from Task Lists tab
- New TemplateTaskSelector component with multi-select task selection
- Select individual tasks or entire areas with one click
- Task counts properly account for locations (e.g., 5 items × 3 locations = 15 tasks)
- "Take Over" functionality allows reassigning tasks from others (with confirmation)

#### Personnel Management
- Manual "Add Personnel" form for admins to add individual personnel records
- Personnel Config panel for managing flights and classes

### Changed
- Removed "Available Tasks" tab from My Details page (replaced by self-assignment from Task Lists)
- Firestore rules updated to allow authenticated users to create self-assignments

### Fixed
- Template task counts showing "0 tasks" (field name mismatch: area.tasks → area.items)

---

## [0.4.14] - 2026-01-25

### Fixed
- Release workflow: Create functions/.env file for Firebase deploy (env vars must be in .env file)

---

## [0.4.13] - 2026-01-25

### Fixed
- Release workflow: Add `contents:write` permission for git tag creation
- Release workflow: Remove storage from deploy (managed separately via Firebase console)

---

## [0.4.12] - 2026-01-25

### Added

#### GitHub Actions CI/CD Pipeline
- **PR Workflow** (`pr.yml`): Runs lint, tests, and build on pull requests
- **Preview Deployments**: Automatic Firebase preview channel deployment for each PR
- **Release Workflow** (`release.yml`): Automatic tagging, GitHub release creation, and Firebase deployment on merge to master
- **Preview Cleanup** (`cleanup-preview.yml`): Deletes preview channels when PRs are closed
- **Sentry Source Maps**: Automatic source map upload for production builds
- Changelog notes automatically extracted from CHANGELOG.md for GitHub releases

### Infrastructure
- Added `.github/workflows/` directory with CI/CD configuration
- 13 GitHub secrets configured for Firebase, Sentry, and build environment

---

## [0.4.11] - 2026-01-25

### Changed

#### Bundle Size Optimization
- Reduced initial JavaScript bundle by ~60% through code splitting
- Route-based lazy loading for non-critical pages (Schedule, Documents, Details, CQ, Profile, Changelog, Surveys, Admin)
- Dynamic imports for jsPDF/jspdf-autotable (only loaded when exporting PDFs)
- Vendor chunk splitting for better caching (firebase-core, firebase-db, firebase-storage, firebase-functions, react, sentry, date-fns)

### Removed
- Removed unused dependencies: `luxon` and `axios`

---

## [0.4.10] - 2026-01-25

### Added

#### Pass Approval Queue Integration
- Pass Approval Queue now accessible under Admin → CQ → Pass Approvals tab
- Pending pass count badge shows number of requests awaiting approval
- Admins and Candidate Leadership can view and approve/reject pass requests

#### Duplicate Pass Request Detection
- System detects when a user already has a pending pass request
- Warning modal shows details of existing request
- Users can choose to replace existing request or keep it
- Automatic cancellation of old request when replacing

### Changed
- CQ Dashboard now shows destination (e.g., "BX", "Shoppette") instead of generic "Pass" label for personnel on pass

### Fixed
- Pass approval cards not visible to admins and candidate_leadership (component was not wired into Admin dashboard)

### Infrastructure
- Added Firestore indexes for passApprovalRequests collection (status + createdAt, requesterId + createdAt)

---

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
- CQ DA Form generation
- Remove BETA label when system is validated
