# Contributing to WOTS App

Thank you for your interest in contributing to WOTS App! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- Git
- A Firebase project (for local development, use the existing dev environment)

### Setup

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

3. **Set up environment variables**

   Copy the example env file and fill in your Firebase credentials:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```
   Optional (used for notifications and error tracking):
   ```
   VITE_FIREBASE_VAPID_KEY=
   VITE_SENTRY_DSN=
   VITE_SENTRY_ENVIRONMENT=development
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/add-user-profiles` - New features
- `fix/login-redirect-bug` - Bug fixes
- `refactor/auth-context` - Code refactoring
- `docs/update-readme` - Documentation updates

### Making Changes

1. Create a new branch from `master`
   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the [code style guidelines](#code-style)

3. Run tests and lint
   ```bash
   npm run lint
   npm test
   ```

4. Commit your changes with a clear message
   ```bash
   git commit -m "feat: add user profile page"
   ```

5. Push your branch and create a Pull Request
   ```bash
   git push -u origin feature/your-feature-name
   ```

### Pull Request Process

1. **Create a PR** against the `master` branch
2. **CI checks run automatically**:
   - Lint (ESLint)
   - Tests (Vitest)
   - Build verification
   - Preview deployment to Firebase
3. **Review**: Wait for code review and address any feedback
4. **Merge**: Once approved, your PR will be merged
5. **Release**: Merging to master automatically:
   - Creates a git tag from `package.json` version
   - Creates a GitHub Release with changelog notes
   - Deploys to production Firebase

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring (no feature change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat: add CQ shift swap request feature
fix: correct date display for overnight shifts
docs: update API documentation
refactor: simplify auth context logic
```

## Code Style

### JavaScript/React

- Use functional components with hooks
- File naming: `PascalCase.jsx` for components, `camelCase.js` for utilities
- One component per file
- Use async/await for asynchronous operations
- Always handle errors in Firebase calls with try/catch

### Component Structure

```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

function MyComponent({ prop1, prop2 }) {
  const [state, setState] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    // Side effects
  }, [dependency])

  const handleClick = () => {
    // Event handler
  }

  if (!user) return null

  return (
    <div className="...">
      {/* JSX */}
    </div>
  )
}

export default MyComponent
```

### Styling

- Use Tailwind CSS utility classes
- Mobile-first responsive design
- Custom colors defined in `tailwind.config.js` under the `primary` and `accent` palettes

### Firebase/Firestore

- Centralize Firebase calls in `src/services/`
- Use real-time listeners (`onSnapshot`) for live data
- Always use `serverTimestamp()` for timestamps
- Handle loading, error, and empty states in hooks

## Testing

Run tests:
```bash
npm test              # Run once
npm run test:ui       # With UI
npm run test:coverage # With coverage report
```

Write tests for:
- Custom hooks
- Utility functions
- Complex component logic

## Updating the Changelog

When making user-facing changes:

1. **Update `CHANGELOG.md`** - Add entry under the next version section following [Keep a Changelog](https://keepachangelog.com/) format

2. **Update `src/pages/Changelog.jsx`** - Add the same changes to the in-app changelog:
   - Update `APP_VERSION` constant
   - Add new version entry to the `changelog` array

3. **Update `package.json` version** - Bump the version number

## Project Structure

```
wots-app/
├── .github/workflows/    # CI/CD GitHub Actions
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Shared (Loading, ErrorBoundary)
│   │   ├── layout/       # Navbar, Footer
│   │   └── ...
│   ├── pages/            # Route-level components
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React context providers
│   ├── services/         # Firebase service functions
│   ├── lib/              # Utility functions
│   └── config/           # Configuration
├── functions/            # Firebase Cloud Functions
├── terraform/            # Infrastructure as Code
└── public/               # Static assets
```

## Security

- **Never commit secrets**: `.env`, `.secrets/`, `terraform.tfvars`
- **Validate user input** at system boundaries
- **Check permissions** using `AuthContext.can(permission)` before sensitive operations
- **Don't expose admin functionality** to non-admin users

## Questions?

- Check existing issues and PRs
- Read [CLAUDE.md](./CLAUDE.md) for AI assistant context
- Read [AGENTS.md](./AGENTS.md) for technical details

## License

By contributing, you agree that your contributions will be licensed under the project's license.
