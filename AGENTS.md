# WOTS Student Progress App - Agent Guidelines

## Project Overview

WOTS SPA is a military class communication application built with React + Firebase. It enables instructors (admins) to share updates, schedules, and documents with students.

**Project ID:** `wots-app-484617`

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Storage, Cloud Messaging)
- **Authentication:** Google OAuth via Firebase Auth
- **Infrastructure:** Terraform (in `./terraform/`)
- **Package Manager:** npm

## Directory Structure

```
wots-app/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Shared components (Loading, ErrorBoundary, etc.)
│   │   ├── layout/       # Layout components (Navbar, Footer)
│   │   ├── posts/        # Post-related components
│   │   └── documents/    # Document-related components
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
├── role: "admin" | "user"
├── createdAt: timestamp
└── lastLogin: timestamp

posts/{postId}
├── title: string
├── content: string
├── type: "announcement" | "uotd" | "schedule" | "general"
├── authorId: string
├── authorName: string
├── status: "draft" | "published"
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
```

Generate from Terraform: `terraform output -raw firebase_config_env`

## Common Tasks

### Running the App
```bash
npm install
npm run dev
```

### Deploying Infrastructure
```bash
cd terraform
export GOOGLE_APPLICATION_CREDENTIALS="../.secrets/service-account.json"
terraform init
terraform apply
```

### Creating an Admin User
After a user logs in, update their Firestore document:
```javascript
// In Firestore console or via script
db.collection('users').doc(userId).update({ role: 'admin' })
```

### Deploying to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

## Security Rules

- Users can only read posts with `status: "published"`
- Only admins can create/edit/delete posts and documents
- Users can only read/write their own user document
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
