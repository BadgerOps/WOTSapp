import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Loading from './components/common/Loading'
import Login from './pages/Login'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Documents from './pages/Documents'
import MyDetails from './pages/MyDetails'
import CQView from './pages/CQView'
import Profile from './pages/Profile'
import Changelog from './pages/Changelog'
import Surveys from './pages/Surveys'
import Admin from './pages/Admin'
import { authLog } from './lib/authDebugger'

function ProtectedRoute({ children, adminOnly = false, routeName = 'unknown' }) {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    authLog('Router', `ProtectedRoute[${routeName}] - loading`, { path: location.pathname })
    return <Loading />
  }

  if (!user) {
    authLog('Router', `ProtectedRoute[${routeName}] - NO USER, redirecting to login`, {
      path: location.pathname,
      wasLoading: false,
    })
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAdmin) {
    authLog('Router', `ProtectedRoute[${routeName}] - not admin, redirecting to home`, {
      path: location.pathname,
      userEmail: user.email,
    })
    return <Navigate to="/" replace />
  }

  authLog('Router', `ProtectedRoute[${routeName}] - access granted`, {
    path: location.pathname,
    userEmail: user.email,
  })
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

  authLog('App', 'Render', {
    loading,
    hasUser: !!user,
    userEmail: user?.email || null,
    path: location.pathname,
  })

  if (loading) {
    authLog('App', 'Showing fullscreen loading')
    return <Loading fullScreen />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {user && <Navbar />}
      <main className={user ? 'pt-16' : ''}>
        <Routes>
          <Route
            path="/login"
            element={
              user ? (
                (() => {
                  authLog('Router', 'Login page - user exists, redirecting to home', { email: user.email })
                  return <Navigate to="/" replace />
                })()
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute routeName="Home">
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute routeName="Schedule">
                <Schedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute routeName="Documents">
                <Documents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/details"
            element={
              <ProtectedRoute routeName="Details">
                <MyDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cq"
            element={
              <ProtectedRoute routeName="CQ">
                <CQView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute routeName="Profile">
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/changelog"
            element={
              <ProtectedRoute routeName="Changelog">
                <Changelog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys"
            element={
              <ProtectedRoute routeName="Surveys">
                <Surveys />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly routeName="Admin">
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {user && <Footer />}
    </div>
  )
}
