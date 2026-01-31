# WOTSapp Cloudflare Pages Migration Plan

## Overview

This document outlines the migration strategy for moving WOTSapp from Firebase Hosting to Cloudflare Pages while maintaining Firebase Auth and Firestore. This hybrid approach provides immediate benefits (free hosting, global edge performance) with minimal risk.

### Migration Goals

1. **Reduce costs** - Cloudflare Pages is free with generous limits
2. **Improve performance** - Edge deployment = lower latency globally
3. **Maintain stability** - Keep Firebase Auth & Firestore (proven, working)
4. **Enable future migration** - Set foundation for gradual backend migration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: HYBRID ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   React SPA ──► Cloudflare Pages (edge hosting)                     │
│       │                                                             │
│       ├──► Firebase Auth (unchanged)                                │
│       ├──► Firestore (unchanged, real-time)                         │
│       ├──► Cloud Storage (unchanged)                                │
│       └──► Cloud Functions (unchanged initially)                    │
│                                                                     │
│   Benefits: Free hosting, faster global delivery, same backend      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: WORKERS INTEGRATION                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   React SPA ──► Cloudflare Pages                                    │
│       │                                                             │
│       ├──► Pages Functions (new API layer)                          │
│       │         │                                                   │
│       │         ├──► Firebase Auth (token verification)             │
│       │         ├──► Firestore (via Admin SDK)                      │
│       │         └──► R2 (file storage, optional)                    │
│       │                                                             │
│       └──► Firestore (direct, for real-time only)                   │
│                                                                     │
│   Cron Workers ──► Scheduled tasks (weather, notifications)         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Frontend Migration to Cloudflare Pages

**Duration:** 2-3 days
**Risk:** Low
**Rollback:** Switch DNS back to Firebase

### 1.1 Prerequisites

- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare (if using custom domain)
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Cloudflare API token generated

### 1.2 Project Configuration

#### Create `wrangler.toml` in project root:

```toml
# wrangler.toml
name = "wotsapp"
compatibility_date = "2024-12-01"

# Pages-specific settings
pages_build_output_dir = "dist"

# Environment variables (non-secret)
[vars]
VITE_APP_VERSION = "0.5.2"
```

#### Update `vite.config.js` for Cloudflare Pages:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ... existing PWA config
    }),
  ],
  build: {
    // Cloudflare Pages supports modern browsers
    target: 'esnext',
    // Generate sourcemaps for Sentry
    sourcemap: true,
    rollupOptions: {
      output: {
        // Consistent chunk naming for caching
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

#### Create `_headers` file for Cloudflare Pages:

```
# public/_headers

# Security headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

# Cache static assets aggressively
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Don't cache HTML (SPA)
/*.html
  Cache-Control: no-cache

# Service worker
/sw.js
  Cache-Control: no-cache
```

#### Create `_redirects` file for SPA routing:

```
# public/_redirects

# SPA fallback - all routes serve index.html
/*    /index.html   200
```

### 1.3 CI/CD Pipeline

#### Create `.github/workflows/cloudflare-preview.yml`:

```yaml
name: Cloudflare Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      deployments: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --run

      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}

      - name: Deploy to Cloudflare Pages (Preview)
        uses: cloudflare/wrangler-action@v3
        id: deploy
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=wotsapp --branch=${{ github.head_ref }}

      - name: Comment PR with preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const previewUrl = '${{ steps.deploy.outputs.deployment-url }}';
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Cloudflare Preview Deployment\n\n:rocket: Preview deployed to: ${previewUrl}\n\nThis preview will be available for 7 days.`
            });
```

#### Create `.github/workflows/cloudflare-production.yml`:

```yaml
name: Cloudflare Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --run

      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}

      - name: Deploy to Cloudflare Pages (Production)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=wotsapp --branch=main

      # Keep Firebase Functions deployed (they still work)
      - name: Deploy Firebase Functions
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only functions
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
```

### 1.4 Cloudflare Pages Setup

#### Manual setup via Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** > **Workers & Pages**
2. Click **Create application** > **Pages**
3. Choose **Direct Upload** (we'll use CI/CD, not Git integration)
4. Name: `wotsapp`
5. Production branch: `main`

#### Or via Wrangler CLI:

```bash
# Login to Cloudflare
wrangler login

# Create the Pages project
wrangler pages project create wotsapp --production-branch=main

# Initial deployment (test)
npm run build
wrangler pages deploy dist --project-name=wotsapp
```

### 1.5 DNS Configuration

#### Option A: Cloudflare-managed domain

1. Go to **Cloudflare Dashboard** > **Workers & Pages** > **wotsapp**
2. Click **Custom domains** > **Set up a custom domain**
3. Enter your domain (e.g., `app.wotsapp.com`)
4. Cloudflare auto-configures DNS

#### Option B: External domain with CNAME

Add a CNAME record:
```
app.wotsapp.com  CNAME  wotsapp.pages.dev
```

### 1.6 Environment Variables & Secrets

#### Set up in Cloudflare Dashboard:

Go to **Workers & Pages** > **wotsapp** > **Settings** > **Environment variables**

**Production variables:**
```
VITE_FIREBASE_API_KEY = [your-api-key]
VITE_FIREBASE_AUTH_DOMAIN = [project].firebaseapp.com
VITE_FIREBASE_PROJECT_ID = [project-id]
VITE_FIREBASE_STORAGE_BUCKET = [project].appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = [sender-id]
VITE_FIREBASE_APP_ID = [app-id]
VITE_SENTRY_DSN = [sentry-dsn]
```

#### GitHub Secrets needed:

```
CLOUDFLARE_API_TOKEN     # From Cloudflare dashboard > API Tokens
CLOUDFLARE_ACCOUNT_ID    # From Cloudflare dashboard URL
VITE_FIREBASE_*          # All Firebase config vars
VITE_SENTRY_DSN          # Sentry DSN
GCP_SA_KEY               # For Firebase Functions deployment
```

### 1.7 Testing Checklist

- [ ] Build succeeds locally with `npm run build`
- [ ] Preview deployment works via `wrangler pages deploy dist`
- [ ] All routes work (SPA fallback functioning)
- [ ] Firebase Auth login works
- [ ] Firestore data loads correctly
- [ ] Real-time updates work (onSnapshot)
- [ ] Cloud Storage file uploads work
- [ ] Push notifications work (FCM)
- [ ] PWA installs correctly
- [ ] Service worker registers
- [ ] Sentry error reporting works

### 1.8 Rollback Plan

If issues arise, rollback is simple:

```bash
# Point DNS back to Firebase Hosting
# Or if using Cloudflare DNS, disable the Pages custom domain

# Firebase Hosting is still deployed and functional
# Just update DNS to point back to Firebase
```

---

## Phase 2: Pages Functions (API Layer)

**Duration:** 1-2 weeks
**Risk:** Medium
**Benefit:** Edge compute, reduced Cloud Functions costs

### 2.1 Project Structure

```
wotsapp/
├── src/                          # React frontend (unchanged)
├── functions/                    # NEW: Pages Functions
│   ├── api/
│   │   ├── _middleware.ts        # Auth middleware
│   │   ├── health.ts             # Health check endpoint
│   │   ├── weather/
│   │   │   ├── current.ts        # GET /api/weather/current
│   │   │   └── check.ts          # POST /api/weather/check
│   │   ├── posts/
│   │   │   ├── index.ts          # GET/POST /api/posts
│   │   │   └── [id].ts           # GET/PUT/DELETE /api/posts/:id
│   │   ├── personnel/
│   │   │   └── ...
│   │   └── notifications/
│   │       └── send.ts           # POST /api/notifications/send
│   └── tsconfig.json
├── public/
├── wrangler.toml
└── package.json
```

### 2.2 Updated Wrangler Configuration

```toml
# wrangler.toml
name = "wotsapp"
compatibility_date = "2024-12-01"
pages_build_output_dir = "dist"

# KV namespace for caching
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

# Environment variables
[vars]
FIREBASE_PROJECT_ID = "your-project-id"

# Secrets (set via wrangler secret put):
# - FIREBASE_SERVICE_ACCOUNT (JSON string)
# - WEATHER_API_KEY
# - SENTRY_DSN
```

### 2.3 Auth Middleware

```typescript
// functions/api/_middleware.ts
import { verifyFirebaseToken } from '../lib/firebase-auth';

interface Env {
  FIREBASE_PROJECT_ID: string;
  CACHE: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  // Skip auth for health checks
  if (new URL(request.url).pathname === '/api/health') {
    return next();
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);

  try {
    // Check cache first (tokens are valid for 1 hour)
    const cacheKey = `auth:${token.slice(-32)}`;
    const cachedUser = await env.CACHE.get(cacheKey, 'json');

    if (cachedUser) {
      context.data.user = cachedUser;
      return next();
    }

    // Verify token with Firebase
    const user = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);

    // Cache for 5 minutes
    await env.CACHE.put(cacheKey, JSON.stringify(user), { expirationTtl: 300 });

    context.data.user = user;
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

### 2.4 Firebase Token Verification

```typescript
// functions/lib/firebase-auth.ts

interface DecodedToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
}

// Lightweight Firebase token verification without Admin SDK
// (Admin SDK is heavy for edge functions)
export async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<DecodedToken> {
  // Fetch Google's public keys
  const keysResponse = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  const keys = await keysResponse.json();

  // Decode and verify JWT
  const [headerB64, payloadB64, signatureB64] = token.split('.');

  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64));

  // Verify claims
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  if (payload.iat > now + 300) {
    throw new Error('Token issued in the future');
  }

  if (payload.aud !== projectId) {
    throw new Error('Invalid audience');
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid issuer');
  }

  // Verify signature using Web Crypto API
  const key = keys[header.kid];
  if (!key) {
    throw new Error('Unknown key ID');
  }

  const isValid = await verifySignature(
    `${headerB64}.${payloadB64}`,
    signatureB64,
    key
  );

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  return {
    uid: payload.user_id || payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    email_verified: payload.email_verified,
  };
}

async function verifySignature(
  data: string,
  signature: string,
  pemKey: string
): Promise<boolean> {
  // Convert PEM to ArrayBuffer
  const pemContents = pemKey
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Import the public key
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Verify signature
  const signatureBytes = Uint8Array.from(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );

  const dataBytes = new TextEncoder().encode(data);

  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes,
    dataBytes
  );
}
```

### 2.5 Example API Endpoints

#### Health Check

```typescript
// functions/api/health.ts
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.5.2',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

#### Weather Check

```typescript
// functions/api/weather/current.ts
interface Env {
  WEATHER_API_KEY: string;
  CACHE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const location = url.searchParams.get('location') || 'Montgomery,AL';

  // Check cache (weather data valid for 15 minutes)
  const cacheKey = `weather:${location}`;
  const cached = await env.CACHE.get(cacheKey, 'json');

  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }

  // Fetch from WeatherAPI
  const response = await fetch(
    `https://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${encodeURIComponent(location)}`
  );

  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'Weather API error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await response.json();

  // Cache for 15 minutes
  await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 900 });

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    },
  });
};
```

#### Posts CRUD

```typescript
// functions/api/posts/index.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
}

function getFirestoreClient(env: Env) {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// GET /api/posts
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = getFirestoreClient(context.env);
  const url = new URL(context.request.url);

  const status = url.searchParams.get('status') || 'published';
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const snapshot = await db
    .collection('posts')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  const posts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST /api/posts
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = getFirestoreClient(context.env);
  const user = context.data.user;
  const body = await context.request.json();

  const post = {
    ...body,
    authorId: user.uid,
    authorName: user.name || user.email,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const docRef = await db.collection('posts').add(post);

  return new Response(JSON.stringify({ id: docRef.id, ...post }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### 2.6 Frontend API Client

```typescript
// src/services/api.ts
import { getAuth } from 'firebase/auth';

const API_BASE = '/api';

async function getAuthHeaders(): Promise<HeadersInit> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  },

  async post<T>(path: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  },

  async put<T>(path: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  },

  async delete(path: string): Promise<void> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  },
};
```

### 2.7 Gradual Hook Migration

Migrate hooks one at a time, keeping Firestore for real-time:

```typescript
// src/hooks/usePosts.js - BEFORE (direct Firestore)
export function usePosts() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  return { posts };
}

// src/hooks/usePosts.js - AFTER (API for writes, Firestore for real-time)
export function usePosts() {
  const [posts, setPosts] = useState([]);

  // Keep real-time listener for reads
  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  // Use API for writes (validation, business logic at edge)
  const createPost = async (data) => {
    return api.post('/posts', data);
  };

  const updatePost = async (id, data) => {
    return api.put(`/posts/${id}`, data);
  };

  const deletePost = async (id) => {
    return api.delete(`/posts/${id}`);
  };

  return { posts, createPost, updatePost, deletePost };
}
```

---

## Phase 3: Scheduled Workers (Cron)

**Duration:** 3-5 days
**Risk:** Low (runs in parallel with Cloud Functions)

### 3.1 Cron Worker Setup

```
packages/
└── workers/
    └── cron/
        ├── src/
        │   ├── index.ts
        │   ├── jobs/
        │   │   ├── weather-checker.ts
        │   │   ├── detail-notifier.ts
        │   │   └── uotd-scheduler.ts
        │   └── lib/
        │       ├── firebase.ts
        │       ├── weather-api.ts
        │       └── fcm.ts
        ├── wrangler.toml
        ├── package.json
        └── tsconfig.json
```

### 3.2 Cron Worker Configuration

```toml
# packages/workers/cron/wrangler.toml
name = "wotsapp-cron"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[triggers]
crons = [
  # Weather checks (America/Chicago timezone - adjust for your location)
  "0 11 * * *",   # 5 AM CST - Morning check
  "0 17 * * *",   # 11 AM CST - Lunch check
  "0 23 * * *",   # 5 PM CST - Dinner check

  # Detail notifications
  "0 12 * * *",   # 6 AM CST - Morning reminders
  "0 0 * * *",    # 6 PM CST - Evening reminders
]

[vars]
FIREBASE_PROJECT_ID = "your-project-id"
TIMEZONE = "America/Chicago"

# Secrets (wrangler secret put):
# - FIREBASE_SERVICE_ACCOUNT
# - WEATHER_API_KEY
# - FCM_SERVER_KEY
```

### 3.3 Cron Worker Implementation

```typescript
// packages/workers/cron/src/index.ts
import { checkWeatherAndRecommend } from './jobs/weather-checker';
import { sendDetailReminders } from './jobs/detail-notifier';

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
  WEATHER_API_KEY: string;
  FCM_SERVER_KEY: string;
  FIREBASE_PROJECT_ID: string;
  TIMEZONE: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const hour = new Date(event.scheduledTime).getUTCHours();

    console.log(`Cron triggered at UTC hour ${hour}`);

    // Weather checks at 11, 17, 23 UTC (5am, 11am, 5pm CST)
    if ([11, 17, 23].includes(hour)) {
      ctx.waitUntil(checkWeatherAndRecommend(env));
    }

    // Detail notifications at 12, 0 UTC (6am, 6pm CST)
    if ([12, 0].includes(hour)) {
      ctx.waitUntil(sendDetailReminders(env, hour === 12 ? 'morning' : 'evening'));
    }
  },
};
```

```typescript
// packages/workers/cron/src/jobs/weather-checker.ts
import { getFirestore } from './lib/firebase';
import { getWeatherData } from './lib/weather-api';
import { evaluateWeatherRules } from './lib/rule-evaluator';

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
  WEATHER_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

export async function checkWeatherAndRecommend(env: Env) {
  console.log('Starting weather check...');

  const db = getFirestore(env);

  // Get weather location settings
  const settingsDoc = await db.collection('settings').doc('weather').get();
  const settings = settingsDoc.data();

  if (!settings?.location) {
    console.log('No weather location configured');
    return;
  }

  // Fetch current weather
  const weather = await getWeatherData(settings.location, env.WEATHER_API_KEY);

  // Get weather rules
  const rulesSnapshot = await db.collection('weatherRules')
    .where('active', '==', true)
    .orderBy('priority', 'desc')
    .get();

  const rules = rulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Evaluate rules
  const recommendation = evaluateWeatherRules(weather, rules);

  if (recommendation) {
    // Create pending recommendation
    await db.collection('weatherRecommendations').add({
      ...recommendation,
      weatherData: weather,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    console.log('Weather recommendation created:', recommendation.uniformId);
  } else {
    console.log('No matching weather rules');
  }
}
```

---

## Phase 4: Migration Execution Checklist

### Pre-Migration (Day -7 to Day -1)

- [ ] Audit current Firebase usage and costs
- [ ] Create Cloudflare account
- [ ] Generate Cloudflare API token with Pages permissions
- [ ] Set up GitHub secrets for Cloudflare
- [ ] Test build process locally
- [ ] Create wrangler.toml and supporting files
- [ ] Test deployment to Cloudflare Pages (staging)
- [ ] Verify all functionality on staging

### Migration Day (Day 0)

- [ ] Announce maintenance window to users
- [ ] Final backup of Firestore data
- [ ] Deploy latest build to Cloudflare Pages
- [ ] Verify deployment successful
- [ ] Update DNS to point to Cloudflare Pages
- [ ] Verify DNS propagation
- [ ] Test all critical paths:
  - [ ] Login/logout
  - [ ] View posts
  - [ ] Create/edit posts
  - [ ] CQ status updates
  - [ ] Detail assignments
  - [ ] Push notifications
- [ ] Monitor error rates in Sentry
- [ ] Announce migration complete

### Post-Migration (Day +1 to Day +7)

- [ ] Monitor Cloudflare analytics
- [ ] Compare performance metrics
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Disable Firebase Hosting (keep Functions running)
- [ ] Document any issues and resolutions

### Phase 2 Execution (Week 2-3)

- [ ] Create Pages Functions structure
- [ ] Implement auth middleware
- [ ] Migrate first endpoint (health check)
- [ ] Migrate weather endpoints
- [ ] Migrate posts endpoints
- [ ] Update frontend hooks gradually
- [ ] Test extensively
- [ ] Deploy to production

### Phase 3 Execution (Week 4)

- [ ] Create cron worker
- [ ] Implement weather checker job
- [ ] Implement detail notifier job
- [ ] Test cron triggers
- [ ] Deploy cron worker
- [ ] Monitor execution logs
- [ ] Disable corresponding Cloud Functions

---

## Cost Tracking

### Before Migration (Firebase)

| Service | Monthly Cost |
|---------|-------------|
| Hosting | $X.XX |
| Firestore | $X.XX |
| Functions | $X.XX |
| Storage | $X.XX |
| **Total** | **$X.XX** |

### After Migration (Cloudflare + Firebase)

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Pages | $0.00 |
| Cloudflare Workers | $0.00-5.00 |
| Cloudflare KV | $0.00 |
| Firebase Firestore | $X.XX |
| Firebase Auth | $0.00 |
| Firebase Storage | $X.XX |
| Firebase Functions | $X.XX (reduced) |
| **Total** | **$X.XX** |

### Projected Savings

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Hosting | $X/mo | $0/mo | 100% |
| Bandwidth | $X/mo | $0/mo | 100% |
| Functions | $X/mo | $X/mo | XX% |
| **Total** | $X/mo | $X/mo | XX% |

---

## Rollback Procedures

### Phase 1 Rollback (Hosting)

```bash
# If Cloudflare Pages has issues, revert DNS

# Option 1: If using Cloudflare DNS
# - Go to Cloudflare Dashboard > DNS
# - Update CNAME/A record to point back to Firebase

# Option 2: If using external DNS
# - Update DNS to point to Firebase Hosting
# - Firebase: [project].web.app or custom domain

# Firebase Hosting remains deployed and functional
firebase deploy --only hosting  # If needed
```

### Phase 2 Rollback (API)

```bash
# If Pages Functions have issues:
# 1. Frontend still works with direct Firestore
# 2. Update hooks to use Firestore directly
# 3. Or disable API routes and revert frontend changes

# Git revert the frontend changes
git revert [commit-hash]
npm run build
wrangler pages deploy dist
```

### Phase 3 Rollback (Cron)

```bash
# If Cron Workers fail:
# 1. Cloud Functions are still deployed
# 2. Re-enable Cloud Functions scheduling
# 3. Delete or disable Cron Worker

wrangler delete wotsapp-cron
```

---

## Support & Resources

### Cloudflare Documentation
- [Pages Documentation](https://developers.cloudflare.com/pages/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Firebase Documentation
- [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Firestore REST API](https://firebase.google.com/docs/firestore/use-rest-api)
- [Admin SDK](https://firebase.google.com/docs/admin/setup)

### Troubleshooting
- Cloudflare Discord: https://discord.gg/cloudflaredev
- Firebase Support: https://firebase.google.com/support

---

## Appendix A: File Changes Summary

### New Files
```
wrangler.toml                           # Cloudflare configuration
public/_headers                         # HTTP headers
public/_redirects                       # SPA routing
.github/workflows/cloudflare-*.yml      # CI/CD pipelines
functions/                              # Pages Functions (Phase 2)
packages/workers/cron/                  # Cron Worker (Phase 3)
```

### Modified Files
```
vite.config.js                          # Build optimizations
package.json                            # New scripts
src/services/api.ts                     # API client (Phase 2)
src/hooks/*.js                          # Gradual migration (Phase 2)
```

### Deprecated Files (Keep for rollback)
```
.github/workflows/pr.yml                # Eventually replace
.github/workflows/release.yml           # Eventually replace
firebase.json                           # Keep for Functions
```

---

## Appendix B: Environment Variables Reference

### Cloudflare Pages (Production)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_SENTRY_DSN
```

### Cloudflare Workers (Secrets)
```
FIREBASE_SERVICE_ACCOUNT      # JSON string
WEATHER_API_KEY               # WeatherAPI.com key
FCM_SERVER_KEY                # Firebase Cloud Messaging
SENTRY_DSN                    # Error tracking
```

### GitHub Actions Secrets
```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
VITE_FIREBASE_*               # All frontend env vars
GCP_SA_KEY                    # For Firebase Functions
```
