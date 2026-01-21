import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { pushEnabled, pushSupported, enablePushNotifications } = useNotifications()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [enablingPush, setEnablingPush] = useState(false)

  async function handleEnablePush() {
    setEnablingPush(true)
    await enablePushNotifications()
    setEnablingPush(false)
  }

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/schedule', label: 'Schedule' },
    { path: '/documents', label: 'Documents' },
    { path: '/details', label: 'Details' },
  ]

  if (isAdmin) {
    navLinks.push({ path: '/admin', label: 'Admin' })
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="fixed top-0 left-0 right-0 bg-primary-600 text-white shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <img src="/logo.png" alt="WOTS Logo" className="w-8 h-8 rounded" />
            WOTSapp
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-100 hover:bg-primary-500'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <>
                {pushSupported && !pushEnabled && (
                  <button
                    onClick={handleEnablePush}
                    disabled={enablingPush}
                    className="p-2 text-primary-200 hover:text-white hover:bg-primary-500 rounded-lg transition-colors"
                    title="Enable notifications"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                )}
                {pushEnabled && (
                  <span className="p-2 text-green-300" title="Notifications enabled">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
                    </svg>
                  </span>
                )}
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm">{user.displayName}</span>
                <button
                  onClick={logout}
                  className="text-sm text-primary-200 hover:text-white"
                >
                  Sign out
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="md:hidden pb-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(link.path)
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-100 hover:bg-primary-500'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <div className="mt-4 pt-4 border-t border-primary-500">
                <div className="flex items-center px-3 py-2">
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <span className="text-sm">{user.displayName}</span>
                </div>
                {!pushEnabled && (
                  <button
                    onClick={() => {
                      handleEnablePush()
                      setMenuOpen(false)
                    }}
                    disabled={enablingPush}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-primary-100 hover:bg-primary-500 rounded-md"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {enablingPush ? 'Enabling...' : 'Enable Notifications'}
                  </button>
                )}
                {pushEnabled && (
                  <div className="flex items-center gap-2 px-3 py-2 text-green-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
                    </svg>
                    Notifications Enabled
                  </div>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                  className="block w-full text-left px-3 py-2 text-primary-200 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
