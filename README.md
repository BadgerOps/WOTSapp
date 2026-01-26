# WOTS App

A military class communication application that enables instructors and administrators to share updates, schedules, and documents with students. Built with React and Firebase.

## Features

- **Post Management** - Create and share announcements, schedules, and daily updates
- **Document Sharing** - Upload and organize training materials, syllabi, and reference documents
- **Uniform of the Day (UOTD)** - Weather-based uniform recommendations with approval workflow
- **Personnel Roster** - Import and manage student rosters via CSV
- **Cleaning Details** - Assign and track dormitory cleaning tasks with interactive checklists
- **CQ Tracker** - Track personnel in/out status and pass details
- **Role-Based Access** - Admin and user roles with granular permissions
- **Real-Time Updates** - Live data synchronization via Firestore
- **Mobile-First Design** - Responsive UI built with Tailwind CSS
- **PWA Support** - Installable on mobile devices for native-like experience

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| Authentication | Google OAuth via Firebase Auth |
| Infrastructure | Terraform |
| CI/CD | GitHub Actions |
| Testing | Vitest, React Testing Library |
| Error Tracking | Sentry |

## Quick Start

### Prerequisites

- Node.js 22+
- npm
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BadgerOps/wots-app.git
   cd wots-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Firebase credentials:
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser** at `http://localhost:5173`

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication with Google provider
3. Create a Firestore database
4. Enable Storage
5. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

## Project Structure

```
wots-app/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Shared (Loading, ErrorBoundary)
│   │   ├── layout/       # Navbar, Footer
│   │   ├── posts/        # Post-related components
│   │   ├── documents/    # Document management
│   │   ├── personnel/    # Personnel roster
│   │   └── details/      # Cleaning details
│   ├── pages/            # Route-level components
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React context providers
│   ├── services/         # Firebase service functions
│   ├── lib/              # Utility functions
│   └── config/           # Configuration files
├── functions/            # Firebase Cloud Functions
├── terraform/            # Infrastructure as Code
├── public/               # Static assets
└── .github/workflows/    # CI/CD pipelines
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run deploy` | Build and deploy to Firebase |
| `npm run deploy:hosting` | Deploy only hosting |
| `npm run deploy:functions` | Deploy only Cloud Functions |
| `npm run deploy:rules` | Deploy Firestore and Storage rules |

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute, code style, PR process |
| [AGENTS.md](./AGENTS.md) | Technical architecture and conventions for AI agents |
| [CLAUDE.md](./CLAUDE.md) | Detailed context for AI assistants |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Current progress and roadmap |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Setting up your development environment
- Branch naming conventions
- Commit message format (Conventional Commits)
- Pull request process
- Code style guidelines

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes following the code style guidelines
4. Run tests (`npm test`) and lint (`npm run lint`)
5. Commit with a descriptive message (`git commit -m "feat: add new feature"`)
6. Push to your fork (`git push origin feature/your-feature`)
7. Open a Pull Request

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **Pull Requests**: Automatically runs lint, tests, build verification, and deploys to a Firebase preview channel
- **Merge to Master**: Creates a git tag, GitHub Release, and deploys to production

## Security

- Authentication via Google OAuth
- Role-based access control (admin/user)
- Firestore security rules enforce data access policies
- Storage rules restrict uploads to authenticated users
- Never commit `.env`, `.secrets/`, or `terraform.tfvars`

## Architecture

### Authentication Flow

```
User → Google OAuth → Firebase Auth → AuthContext → Protected Routes
```

### Data Model (Firestore)

- `users/{userId}` - User profiles and roles
- `posts/{postId}` - Announcements and updates
- `documents/{documentId}` - Uploaded files metadata
- `personnel/{personnelId}` - Student roster
- `detailTemplates/{templateId}` - Cleaning task templates
- `detailAssignments/{assignmentId}` - Task assignments

### Real-Time Updates

The app uses Firestore's `onSnapshot` listeners for real-time data synchronization. Custom hooks (`usePosts`, `useDocuments`, etc.) abstract the data fetching logic.

## Deployment

### Manual Deployment

```bash
npm run build
firebase deploy --only hosting
```

### Infrastructure (Terraform)

```bash
cd terraform
export GOOGLE_APPLICATION_CREDENTIALS="../.secrets/service-account.json"
terraform init
terraform apply
```

## License

This project is licensed under the BSD 2-Clause License. See the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Built with [React](https://react.dev)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Powered by [Firebase](https://firebase.google.com)
- Bundled with [Vite](https://vitejs.dev)
