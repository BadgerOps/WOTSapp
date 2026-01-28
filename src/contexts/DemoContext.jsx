/**
 * Demo Mode Context
 *
 * Provides mock data for screenshots and demos without requiring Firebase.
 * Activated by adding ?demo=user or ?demo=admin to any URL.
 *
 * SECURITY: Demo mode is ONLY available in development (import.meta.env.DEV).
 * In production builds, the ?demo parameter is ignored.
 *
 * This context wraps the app and intercepts data hooks when in demo mode.
 */

import { createContext, useContext, useMemo, useCallback } from 'react'
import { ROLES, hasPermission, PERMISSIONS } from '../lib/roles'

const DemoContext = createContext(null)

// Check if demo mode is enabled via URL param (development only)
export function getDemoMode() {
  // SECURITY: Only allow demo mode in development builds
  if (!import.meta.env.DEV) return null

  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const demo = params.get('demo')
  if (demo === 'admin' || demo === 'user') return demo
  return null
}

// Helper to create Firestore-like timestamps
function createTimestamp(daysAgo = 0, hoursAgo = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(date.getHours() - hoursAgo)
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
  }
}

// Today's date for assignments
const today = new Date().toISOString().split('T')[0]
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

// Mock data definitions - Air Force Warrant Officer Training School
const MOCK_DATA = {
  users: {
    admin: {
      uid: 'demo-admin-001',
      email: 'admin@wots-demo.mil',
      displayName: 'MSgt Thompson',
      photoURL: null,
    },
    user: {
      uid: 'demo-user-001',
      email: 'snuffy@wots-demo.mil',
      displayName: 'A1C Snuffy',
      photoURL: null,
    },
  },

  appConfig: {
    graduationDate: (() => {
      const grad = new Date()
      grad.setDate(grad.getDate() + 45)
      return grad.toISOString().split('T')[0]
    })(),
    className: 'WOTS Class 25-01',
    detailNotificationsEnabled: true,
  },

  posts: [
    {
      id: 'post-001',
      title: 'Morning Formation Change',
      content:
        'Due to inclement weather, morning formation will be held in Building 4 instead of the parade field. Report time remains 0630.',
      type: 'announcement',
      authorId: 'demo-admin-001',
      authorName: 'MSgt Thompson',
      status: 'published',
      createdAt: createTimestamp(0, 2),
      updatedAt: createTimestamp(0, 2),
    },
    {
      id: 'post-002',
      title: 'Uniform of the Day - Lunch',
      content: 'OCPs with patrol cap. Ensure name tapes and rank are properly affixed.',
      type: 'uotd',
      targetSlot: 'lunch',
      authorId: 'demo-admin-001',
      authorName: 'MSgt Thompson',
      status: 'published',
      weatherBased: true,
      weatherCondition: 'Partly Cloudy',
      weatherTemp: 72,
      createdAt: createTimestamp(0, 4),
      updatedAt: createTimestamp(0, 4),
    },
    {
      id: 'post-003',
      title: 'Weekly Training Schedule',
      content: `**Monday:** Land Navigation (0800-1200), PT Assessment (1300-1600)
**Tuesday:** Flight Operations Fundamentals (All Day)
**Wednesday:** Classroom Instruction - Leadership (0800-1200)
**Thursday:** Field Training Exercise Begins
**Friday:** FTX Continues - Recovery Operations`,
      type: 'schedule',
      authorId: 'demo-admin-001',
      authorName: 'MSgt Thompson',
      status: 'published',
      createdAt: createTimestamp(0, 6),
      updatedAt: createTimestamp(0, 6),
    },
    {
      id: 'post-004',
      title: 'Reminder: CAC Renewal',
      content:
        'All candidates with CACs expiring within 60 days must schedule renewal appointments with MPF.',
      type: 'general',
      authorId: 'demo-admin-001',
      authorName: 'MSgt Thompson',
      status: 'published',
      createdAt: createTimestamp(1, 0),
      updatedAt: createTimestamp(1, 0),
    },
  ],

  uniforms: [
    { id: 'uniform-001', number: 1, name: 'OCPs', description: 'Operational Camouflage Pattern with patrol cap' },
    { id: 'uniform-002', number: 2, name: 'PT Gear', description: 'Air Force PT uniform - shorts and t-shirt' },
    { id: 'uniform-003', number: 3, name: 'Blues', description: 'Air Force Service Dress' },
    { id: 'uniform-004', number: 4, name: 'OCPs w/ Fleece', description: 'OCPs with fleece jacket for cold weather' },
    { id: 'uniform-005', number: 5, name: 'Wet Weather', description: 'OCPs with rain gear' },
  ],

  personnel: [
    { id: 'pers-001', rank: 'A1C', firstName: 'John', lastName: 'Snuffy', email: 'snuffy@wots-demo.mil', role: 'user', userId: 'demo-user-001' },
    { id: 'pers-002', rank: 'SrA', firstName: 'Maria', lastName: 'Rodriguez', email: 'rodriguez@wots-demo.mil', role: 'user', userId: null },
    { id: 'pers-003', rank: 'SSgt', firstName: 'Michael', lastName: 'Chen', email: 'chen@wots-demo.mil', role: 'candidate_leadership', userId: null },
    { id: 'pers-004', rank: 'A1C', firstName: 'Sarah', lastName: 'Williams', email: 'williams@wots-demo.mil', role: 'user', userId: null },
    { id: 'pers-005', rank: 'SrA', firstName: 'David', lastName: 'Martinez', email: 'martinez@wots-demo.mil', role: 'user', userId: null },
    { id: 'pers-006', rank: 'A1C', firstName: 'Emily', lastName: 'Davis', email: 'davis@wots-demo.mil', role: 'user', userId: null },
    { id: 'pers-007', rank: 'Amn', firstName: 'Robert', lastName: 'Miller', email: 'miller@wots-demo.mil', role: 'user', userId: null },
    { id: 'pers-008', rank: 'A1C', firstName: 'Ashley', lastName: 'Wilson', email: 'wilson@wots-demo.mil', role: 'user', userId: null },
  ],

  personnelStatus: [
    { id: 'status-001', personnelId: 'pers-001', status: 'present', updatedAt: createTimestamp(0, 1) },
    { id: 'status-002', personnelId: 'pers-002', status: 'present', updatedAt: createTimestamp(0, 1) },
    { id: 'status-003', personnelId: 'pers-003', status: 'pass', passType: 'Regular Pass', expectedReturn: tomorrow + 'T18:00', updatedAt: createTimestamp(0, 5) },
    { id: 'status-004', personnelId: 'pers-004', status: 'present', updatedAt: createTimestamp(0, 1) },
    { id: 'status-005', personnelId: 'pers-005', status: 'sick_call', notes: 'Medical appointment', updatedAt: createTimestamp(0, 3) },
    { id: 'status-006', personnelId: 'pers-006', status: 'present', updatedAt: createTimestamp(0, 1) },
    { id: 'status-007', personnelId: 'pers-007', status: 'present', updatedAt: createTimestamp(0, 1) },
    { id: 'status-008', personnelId: 'pers-008', status: 'present', updatedAt: createTimestamp(0, 1) },
  ],

  cqShifts: [
    {
      id: 'shift-001',
      dateString: today,
      startTime: '06:00',
      endTime: '18:00',
      assignee1Id: 'pers-001',
      assignee1Name: 'A1C Snuffy',
      assignee2Id: 'pers-002',
      assignee2Name: 'SrA Rodriguez',
      status: 'active',
      createdAt: createTimestamp(1, 0),
    },
  ],

  cqNotes: [
    { id: 'note-001', shiftId: 'shift-001', content: 'Shift began. All personnel accounted for.', authorId: 'pers-001', authorName: 'A1C Snuffy', noteType: 'general', createdAt: createTimestamp(0, 10) },
    { id: 'note-002', shiftId: 'shift-001', content: 'SSgt Chen departed on regular pass. Expected return tomorrow 1800.', authorId: 'pers-001', authorName: 'A1C Snuffy', noteType: 'departure', createdAt: createTimestamp(0, 5) },
    { id: 'note-003', shiftId: 'shift-001', content: 'Building check completed. All areas secure.', authorId: 'pers-002', authorName: 'SrA Rodriguez', noteType: 'general', createdAt: createTimestamp(0, 2) },
  ],

  detailTemplates: [
    {
      id: 'template-001',
      name: 'Dorm Common Area',
      description: 'Daily cleaning of dormitory common areas',
      active: true,
      areas: [
        { name: 'Day Room', locations: ['1st Floor', '2nd Floor'], items: ['Vacuum floors', 'Wipe tables', 'Empty trash', 'Clean windows'] },
        { name: 'Latrine', locations: ['1st Floor', '2nd Floor'], items: ['Clean toilets', 'Clean sinks', 'Mop floors', 'Restock supplies'] },
        { name: 'Hallway', locations: ['1st Floor', '2nd Floor'], items: ['Sweep floors', 'Mop floors', 'Dust surfaces'] },
      ],
      createdAt: createTimestamp(30, 0),
      updatedAt: createTimestamp(7, 0),
    },
    {
      id: 'template-002',
      name: 'Classroom Building',
      description: 'Weekly classroom maintenance',
      active: true,
      areas: [
        { name: 'Classroom 101', locations: ['Main'], items: ['Clean whiteboard', 'Arrange desks', 'Empty trash', 'Vacuum'] },
        { name: 'Classroom 102', locations: ['Main'], items: ['Clean whiteboard', 'Arrange desks', 'Empty trash', 'Vacuum'] },
      ],
      createdAt: createTimestamp(30, 0),
      updatedAt: createTimestamp(14, 0),
    },
  ],

  detailAssignments: [
    {
      id: 'assign-001',
      templateId: 'template-001',
      templateName: 'Dorm Common Area',
      assigneeId: 'demo-user-001',
      assigneeName: 'A1C Snuffy',
      assignmentDate: today,
      timeSlot: 'morning',
      dueDateTime: today + 'T08:00',
      status: 'in_progress',
      tasks: [
        { area: 'Day Room', location: '1st Floor', item: 'Vacuum floors', completed: true },
        { area: 'Day Room', location: '1st Floor', item: 'Wipe tables', completed: true },
        { area: 'Day Room', location: '1st Floor', item: 'Empty trash', completed: false },
        { area: 'Day Room', location: '1st Floor', item: 'Clean windows', completed: false },
        { area: 'Latrine', location: '1st Floor', item: 'Clean toilets', completed: false },
        { area: 'Latrine', location: '1st Floor', item: 'Clean sinks', completed: false },
      ],
      createdAt: createTimestamp(0, 12),
      updatedAt: createTimestamp(0, 1),
    },
  ],

  documents: [
    { id: 'doc-001', name: 'Training Schedule - Week 12.pdf', category: 'Training Materials', fileSize: 245000, mimeType: 'application/pdf', uploadedBy: 'demo-admin-001', uploadedByName: 'MSgt Thompson', createdAt: createTimestamp(2, 0) },
    { id: 'doc-002', name: 'Land Navigation Manual.pdf', category: 'Training Materials', fileSize: 1250000, mimeType: 'application/pdf', uploadedBy: 'demo-admin-001', uploadedByName: 'MSgt Thompson', createdAt: createTimestamp(14, 0) },
    { id: 'doc-003', name: 'Air Force PT Standards.pdf', category: 'Reference', fileSize: 89000, mimeType: 'application/pdf', uploadedBy: 'demo-admin-001', uploadedByName: 'MSgt Thompson', createdAt: createTimestamp(30, 0) },
    { id: 'doc-004', name: 'AF Form 988 - Leave Request.pdf', category: 'Forms', fileSize: 45000, mimeType: 'application/pdf', uploadedBy: 'demo-admin-001', uploadedByName: 'MSgt Thompson', createdAt: createTimestamp(60, 0) },
  ],

  surveys: [
    {
      id: 'survey-001',
      title: 'Weekly Training Feedback',
      description: 'Please provide your feedback on this weeks training.',
      status: 'published',
      questions: [
        { id: 'q1', type: 'rating', text: 'How would you rate the overall training quality?', required: true },
        { id: 'q2', type: 'text', text: 'What could be improved?', required: false },
        { id: 'q3', type: 'multiple_choice', text: 'Which training block was most valuable?', options: ['Land Navigation', 'Flight Ops', 'Leadership', 'PT'], required: true },
      ],
      createdAt: createTimestamp(1, 0),
      updatedAt: createTimestamp(1, 0),
    },
  ],

  weatherLocation: {
    id: 'location-001',
    zipCode: '36112',
    address: 'Maxwell AFB, AL',
    latitude: 32.3829,
    longitude: -86.3647,
    updatedAt: createTimestamp(7, 0),
  },

  weatherRules: [
    { id: 'rule-001', condition: 'temperature', operator: 'lt', value: 40, uniformId: 'uniform-004', uniformName: 'OCPs w/ Fleece', priority: 1 },
    { id: 'rule-002', condition: 'temperature', operator: 'gte', value: 80, uniformId: 'uniform-002', uniformName: 'PT Gear', priority: 2 },
    { id: 'rule-003', condition: 'precipitation', operator: 'eq', value: true, uniformId: 'uniform-005', uniformName: 'Wet Weather', priority: 0 },
  ],
}

export function DemoProvider({ children }) {
  const demoMode = getDemoMode()

  const value = useMemo(() => {
    if (!demoMode) return null

    const currentUser = demoMode === 'admin' ? MOCK_DATA.users.admin : MOCK_DATA.users.user
    const userRole = demoMode === 'admin' ? ROLES.ADMIN : ROLES.USER

    return {
      enabled: true,
      mode: demoMode,
      currentUser,
      userRole,
      data: MOCK_DATA,
    }
  }, [demoMode])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  return useContext(DemoContext)
}

export function useDemoData(key) {
  const demo = useDemo()
  if (!demo?.enabled) return null
  return demo.data[key] ?? null
}

/**
 * Hook to get demo-aware auth state
 * Returns mock auth data when in demo mode, null otherwise
 */
export function useDemoAuth() {
  const demo = useDemo()

  const can = useCallback(
    (permission) => {
      if (!demo?.enabled) return false
      return hasPermission(demo.userRole, permission)
    },
    [demo]
  )

  if (!demo?.enabled) return null

  const userRole = demo.userRole

  return {
    user: demo.currentUser,
    userRole,
    loading: false,
    authError: null,
    clearAuthError: () => {},

    // Legacy computed properties
    isAdmin: userRole === ROLES.ADMIN,
    isUniformAdmin: userRole === ROLES.UNIFORM_ADMIN || userRole === ROLES.ADMIN,
    canManageWeather: userRole === ROLES.UNIFORM_ADMIN || userRole === ROLES.ADMIN,
    isCandidateLeadership: userRole === ROLES.CANDIDATE_LEADERSHIP || userRole === ROLES.ADMIN,
    hasApprovalAuthority:
      userRole === ROLES.ADMIN ||
      userRole === ROLES.UNIFORM_ADMIN ||
      userRole === ROLES.CANDIDATE_LEADERSHIP,

    // Permission-based check function
    can,

    // Convenience permission checks
    canViewAssignedDetails: hasPermission(userRole, PERMISSIONS.VIEW_ASSIGNED_DETAILS),
    canSignOthersOnPass: hasPermission(userRole, PERMISSIONS.SIGN_OTHERS_ON_PASS),
    canViewUpdates: hasPermission(userRole, PERMISSIONS.VIEW_UPDATES),
    canModifyUOTD: hasPermission(userRole, PERMISSIONS.MODIFY_UOTD),
    canApproveWeatherUOTD: hasPermission(userRole, PERMISSIONS.APPROVE_WEATHER_UOTD),
    canModifyUniforms: hasPermission(userRole, PERMISSIONS.MODIFY_UNIFORMS),
    canManagePosts: hasPermission(userRole, PERMISSIONS.MANAGE_POSTS),
    canManageDocuments: hasPermission(userRole, PERMISSIONS.MANAGE_DOCUMENTS),
    canManagePersonnel: hasPermission(userRole, PERMISSIONS.MANAGE_PERSONNEL),
    canManageRoles: hasPermission(userRole, PERMISSIONS.MANAGE_ROLES),
    canManageDetails: hasPermission(userRole, PERMISSIONS.MANAGE_DETAILS),
    canManageCQ: hasPermission(userRole, PERMISSIONS.MANAGE_CQ),
    canManageConfig: hasPermission(userRole, PERMISSIONS.MANAGE_CONFIG),
    canApprovePassRequests: hasPermission(userRole, PERMISSIONS.APPROVE_PASS_REQUESTS),
    canViewPassRequests: hasPermission(userRole, PERMISSIONS.VIEW_PASS_REQUESTS),
    canManageCQOperations: hasPermission(userRole, PERMISSIONS.MANAGE_CQ_OPERATIONS),

    // Stub auth methods (no-op in demo mode)
    signInWithGoogle: async () => demo.currentUser,
    logout: async () => {},
  }
}

// Export mock data for external use (e.g., Playwright scripts)
export { MOCK_DATA }
