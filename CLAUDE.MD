# CLAUDE.MD - AI Assistant Guide

This file provides context and guidelines for AI assistants (Claude, GPT, etc.) working on the WOTS Student Progress Application.

## Project Summary

**WOTS SPA** is a military class communication application that enables instructors (admins) to share updates, schedules, and documents with students. Built with React + Firebase.

**Firebase Project ID:** `wots-app-484617`

**Current Status:** Infrastructure complete (20%), ready for feature development

## Quick Context

```
Tech Stack: React 18 + Vite + Tailwind CSS + Firebase
Auth: Google OAuth via Firebase Auth
Database: Firestore (NoSQL)
Storage: Firebase Storage (documents/files)
Hosting: Firebase Hosting
Infrastructure: Terraform managed
```

## File References (Read These First)

When starting work on this project, read these files in order:

1. **PROJECT_STATUS.md** - Current progress, what's done, what's next
2. **AGENTS.md** - Technical architecture, data models, conventions
3. **handoff.md** - Quick onboarding guide for new contributors
4. **package.json** - Dependencies and scripts

## Project Structure

```
wots-app/
├── src/
│   ├── components/       # UI components
│   │   ├── common/       # Shared (Loading, ErrorBoundary)
│   │   ├── layout/       # Navbar, Footer
│   │   ├── posts/        # Post-related components
│   │   └── documents/    # Document-related components
│   ├── pages/            # Route components
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React Context (AuthContext)
│   ├── services/         # Firebase service functions
│   ├── lib/              # Utilities and helpers
│   └── config/           # Configuration (firebase.js)
├── public/               # Static assets
├── terraform/            # Infrastructure as Code
├── functions/            # Firebase Cloud Functions
└── .secrets/             # Service account keys (gitignored)
```

## Key Implementation Patterns

### 1. Authentication Flow
```javascript
// Use AuthContext for user state
import { useAuth } from '../contexts/AuthContext';

function Component() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  // Component logic
}
```

### 2. Firestore Data Fetching
```javascript
// Create custom hooks for data operations
// Example: src/hooks/usePosts.js
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export function usePosts(status = 'published') {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPosts(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status]);

  return { posts, loading, error };
}
```

### 3. Component Structure
```javascript
// Functional components with hooks
// Props destructuring, early returns, clear sections

function PostCard({ post }) {
  if (!post) return null;

  const handleClick = () => {
    // Event handlers
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Component JSX */}
    </div>
  );
}

export default PostCard;
```

### 4. Error Handling
```javascript
// Always wrap Firebase calls in try/catch
try {
  await addDoc(collection(db, 'posts'), postData);
  // Success feedback
} catch (error) {
  console.error('Error creating post:', error);
  // User-friendly error message
}
```

## Firestore Data Model

### users/{userId}
```javascript
{
  email: "user@example.com",
  displayName: "John Doe",
  photoURL: "https://...",
  role: "admin" | "user",
  fcmToken: "...", // for push notifications
  createdAt: timestamp,
  lastLogin: timestamp
}
```

### posts/{postId}
```javascript
{
  title: "Update on Training",
  content: "Full content here...",
  type: "announcement" | "uotd" | "schedule" | "general",
  authorId: "userId",
  authorName: "John Doe",
  status: "draft" | "published",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### documents/{documentId}
```javascript
{
  name: "Syllabus.pdf",
  category: "Training Materials",
  storageUrl: "gs://bucket/path/to/file",
  fileSize: 1024000,
  mimeType: "application/pdf",
  uploadedBy: "userId",
  uploadedByName: "Admin Name",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Security Rules Summary

- **Posts:** Users can read published posts, admins can CRUD all
- **Documents:** Users can read, admins can CRUD
- **Users:** Users can read/write own document, admins can read all
- **Storage:** Authenticated users only, admins can upload

## Common Commands

```bash
# Development
npm install
npm run dev

# Build
npm run build
npm run preview

# Firebase
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage:rules

# Terraform
cd terraform
export GOOGLE_APPLICATION_CREDENTIALS="../.secrets/service-account.json"
terraform init
terraform plan
terraform apply
```

## Environment Variables

Required in `.env` (never commit this file):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=wots-app-484617.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=wots-app-484617
VITE_FIREBASE_STORAGE_BUCKET=wots-app-484617.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Development Guidelines

### Before Making Changes
1. Read the relevant files first (components, hooks, configs)
2. Check PROJECT_STATUS.md for current priorities
3. Understand existing patterns before adding new ones

### When Adding Features
1. Start with data model (Firestore structure)
2. Update security rules if needed
3. Create/update hooks for data operations
4. Build UI components
5. Connect components to data
6. Test as both admin and user
7. Test on mobile viewport

### Code Style
- **Components:** PascalCase, one per file (.jsx extension)
- **Hooks:** camelCase with 'use' prefix (.js extension)
- **Styling:** Tailwind utility classes, mobile-first
- **Imports:** Group by external, internal, relative
- **Async:** Use async/await over .then()
- **Error handling:** Always include try/catch for Firebase calls

### Don't Do This
- Don't hardcode Firebase credentials
- Don't commit .env, .secrets/, or terraform.tfvars
- Don't skip role checks for admin features
- Don't create abstractions before they're needed
- Don't add features not explicitly requested
- Don't use class components (use functional + hooks)

## Current Implementation Status (January 2026)

**✅ COMPLETED (Phase 1 & 2):**
- Post management system (PostFeed, PostCard, PostComposer)
- Document upload/download system
- Uniform catalog management (CRUD operations)
- **Weather API integration** (sophisticated rule-based system with approval workflow)
- UOTD (Uniform of the Day) schedule management
- Admin dashboard with tabbed interface
- Push notification infrastructure (frontend ready)

**Key Weather System Features:**
- Location-based weather via geocoding (zipcode/address)
- Automatic scheduled checks (6 AM, 10 AM, 3 PM Eastern)
- Manual weather check with time slot selection
- Weather-based uniform recommendation rules with priority system
- Approval queue for weather recommendations (uniform_admin or admin)
- Weather cache stored in Firestore

**🚧 IN PROGRESS (Phase 3 - Military Features):**
1. Personnel Roster Import (CSV/Excel upload) - FOUNDATION
2. Cleaning Details Management (assignments, checklists, history)
3. CQ (Charge of Quarters) Tracker (in/out status, pass details, DA Form generation)
4. Contextual Tab Navigation (extend admin tabs with new features)

## Testing Checklist

When implementing features, verify:
- [ ] Works as admin user
- [ ] Works as regular user
- [ ] Loading states show correctly
- [ ] Error states display user-friendly messages
- [ ] Empty states render properly
- [ ] Mobile responsive (test at 375px width)
- [ ] Data updates in real-time (Firestore listeners)
- [ ] Security rules prevent unauthorized access

## Helpful Context

### Role-Based Access
```javascript
const { isAdmin } = useAuth();

// Conditionally render admin features
{isAdmin && <AdminPanel />}
```

### Tailwind Custom Colors
```javascript
// Defined in tailwind.config.js
colors: {
  'wots-green': '#4a5d23',
  'wots-gold': '#d4af37',
  'wots-blue': '#003366'
}
```

### Firebase Timestamp
```javascript
import { serverTimestamp } from 'firebase/firestore';

// Always use serverTimestamp() for consistency
const postData = {
  // ... other fields
  createdAt: serverTimestamp()
};
```

## Known Issues & Limitations

- No error boundary implemented yet
- No pagination (will need when posts grow)
- Security rules in development mode (need production deployment)
- No rate limiting on operations
- No offline persistence configured yet

## Getting Help

When stuck:
1. Check Firebase Console for Firestore/Auth logs
2. Review browser console for client-side errors
3. Verify .env file has correct credentials
4. Check firestore.rules and storage.rules are deployed
5. Test with Firebase emulator for local development

## Success Metrics

**MVP Ready When:**
- Users can sign in with Google
- Admins can create/edit/delete posts
- Users can view published posts
- Admins can upload documents
- Users can download documents
- Push notifications work on at least one platform

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev)

---

**Last Updated:** January 2026
**For Questions:** Reference PROJECT_STATUS.md and AGENTS.md for more detail
