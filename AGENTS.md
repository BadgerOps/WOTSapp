# WOTS Student Progress App - Agent Guidelines

## Project Overview

WOTS SPA is a military class communication application built with React + Firebase. It enables instructors (admins) to share updates, schedules, and documents with students.

**Project ID:** `wots-app-484617`

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Storage, Cloud Functions, Cloud Messaging)
- **Authentication:** Google OAuth via Firebase Auth
- **Infrastructure:** Terraform (in `./terraform/`)
- **Package Manager:** npm

## Directory Structure

```
wots-app/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── admin/        # Admin tools (UOTD, weather, config)
│   │   ├── common/       # Shared components (Loading, ErrorBoundary, etc.)
│   │   ├── cq/           # CQ tracking components
│   │   ├── details/      # Cleaning detail components
│   │   ├── documents/    # Document-related components
│   │   ├── layout/       # Layout components (Navbar, Footer)
│   │   ├── personnel/    # Personnel roster components
│   │   ├── posts/        # Post-related components
│   │   └── surveys/      # Survey components
│   ├── pages/            # Route-level page components
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React context providers
│   ├── services/         # Firebase service functions
│   ├── lib/              # Utility functions and helpers
│   └── config/           # Configuration files
├── public/               # Static assets
├── terraform/            # Infrastructure as Code
└── .secrets/             # Service account keys (gitignored)
```

## Key Files

- `src/config/firebase.js` - Firebase initialization
- `src/contexts/AuthContext.jsx` - Authentication state management
- `src/hooks/usePosts.js` - Post data fetching hook
- `src/hooks/useDocuments.js` - Document data fetching hook
- `terraform/main.tf` - Firebase/GCP resource definitions

## Firestore Data Model

### Collections

```
users/{userId}
├── email: string
├── displayName: string
├── photoURL: string
├── role: "admin" | "uniform_admin" | "candidate_leadership" | "user"
├── createdAt: timestamp
└── lastLogin: timestamp

posts/{postId}
├── title: string
├── content: string
├── type: "announcement" | "uotd" | "schedule" | "general"
├── authorId: string
├── authorName: string
├── status: "draft" | "published"
├── adminNote?: string
├── targetSlot?: string
├── weatherCondition?: string
├── createdAt: timestamp
└── updatedAt: timestamp

documents/{documentId}
├── name: string
├── category: string
├── storageUrl: string
├── fileSize: number
├── mimeType: string
├── uploadedBy: string
├── createdAt: timestamp
└── updatedAt: timestamp

uniforms/{uniformId}
├── number: string
├── name: string
├── description?: string
└── updatedAt: timestamp

settings/{settingId} (appConfig, uotdSchedule, weatherLocation, weatherRules, weatherCache)
weatherRecommendations/{id}
personnel/{personnelId}
detailTemplates/{templateId}
detailAssignments/{assignmentId}
detailCompletions/{completionId}
detailConfig/{configId}
personnelConfig/{configId}
cqSchedule/{scheduleId}
cqShifts/{shiftId}
cqRoster/{rosterId}
cqSkips/{skipId}
cqSwapRequests/{requestId}
passApprovalRequests/{requestId}
personnelStatus/{statusId}
personnelStatusHistory/{logId}
cqNotes/{noteId}
daForms/{formId}
passwordResets/{userId}
surveys/{surveyId}
surveyResponses/{responseId}
```

## Coding Conventions

### React Components
- Use functional components with hooks
- File naming: PascalCase for components (`PostCard.jsx`)
- One component per file
- Props destructuring in function signature

### Hooks
- Prefix with `use` (e.g., `usePosts`, `useAuth`)
- Return object with named properties for flexibility
- Handle loading, error, and data states

### Firebase Services
- Centralize Firebase calls in `src/services/`
- Use async/await for Firestore operations
- Always handle errors gracefully

### Styling
- Use Tailwind CSS utility classes
- Custom theme colors defined in `tailwind.config.js`
- Responsive design: mobile-first approach

## Environment Variables

Required in `.env`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=wots-app-484617
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=development
```

Generate from Terraform: `terraform output -raw firebase_config_env`

## Common Tasks

### Running the App
```bash
npm install
npm --prefix functions install
npm run dev
```

### Deploying Infrastructure
```bash
cd terraform
export GOOGLE_APPLICATION_CREDENTIALS="../.secrets/service-account.json"
terraform init
terraform apply
```

### Creating a Privileged User
After a user logs in, update their Firestore document:
```javascript
// In Firestore console or via script
db.collection('users').doc(userId).update({ role: 'admin' }) // or 'uniform_admin' / 'candidate_leadership'
```

### Deploying to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

### CI/CD (GitHub Actions)
Deployments are automated via GitHub Actions:
- **Pull Requests**: Lint, test, build, and deploy to Firebase preview channel
- **Merge to Master**: Automatic tagging, GitHub release, and production deployment

See `.github/workflows/` for workflow definitions.

## Security Rules

- Authenticated users can read published posts; admins can read all posts
- Only admins can create/edit/delete posts and documents
- Users can read/write their own user document; admins can read all users and update roles
- Uniform admins and candidate leadership have scoped write access for UOTD/weather and CQ/pass workflows
- Storage uploads restricted to authenticated users

## Testing Approach

- Test as both admin and regular user roles
- Verify mobile responsiveness
- Check loading and error states
- Test offline behavior for PWA

## Notes for AI Agents

1. **Before modifying code:** Always read the existing file first
2. **Firebase config:** Never hardcode Firebase credentials; use environment variables
3. **Role checks:** Use `AuthContext` to check user roles before rendering admin features
4. **Error handling:** Wrap Firebase calls in try/catch and show user-friendly errors
5. **Terraform:** Changes to infrastructure should go in `./terraform/`
6. **Secrets:** Never commit `.env`, `terraform.tfvars`, or files in `.secrets/`
7. **Changelog updates:** When updating `CHANGELOG.md`, also update the in-app changelog at `src/pages/Changelog.jsx` (update `APP_VERSION` and add the new version entry to the `changelog` array)
8. **Version bumps:** Update version in `package.json` - CI/CD will automatically create git tags and GitHub releases on merge to master
