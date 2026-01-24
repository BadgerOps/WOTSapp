# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
