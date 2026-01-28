import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { DemoProvider } from './contexts/DemoContext'
import { SentryErrorBoundary } from './components/common/SentryErrorBoundary'
import { initSentry } from './config/sentry'
import './index.css'

// Initialize Sentry before rendering
initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SentryErrorBoundary>
      <BrowserRouter>
        <DemoProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        </DemoProvider>
      </BrowserRouter>
    </SentryErrorBoundary>
  </React.StrictMode>
)
