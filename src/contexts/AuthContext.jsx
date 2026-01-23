import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { authLog } from '../lib/authDebugger'
import { ROLES, PERMISSIONS, hasPermission, normalizeRole } from '../lib/roles'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const authStateChangeCount = useRef(0)
  const mountTime = useRef(Date.now())

  authLog('AuthProvider', 'Component mounting', {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    url: window.location.href,
  })

  async function fetchUserRole(uid) {
    authLog('Auth', 'Fetching user role', { uid })
    try {
      const userDoc = await getDoc(doc(db, 'users', uid))
      if (userDoc.exists()) {
        const role = normalizeRole(userDoc.data().role)
        authLog('Auth', 'User role fetched', { uid, role })
        return role
      }
      authLog('Auth', 'User doc does not exist, defaulting to user role', { uid })
      return ROLES.USER
    } catch (error) {
      authLog('Auth', 'ERROR fetching user role', { uid, error: error.message })
      console.error('Error fetching user role:', error)
      return ROLES.USER
    }
  }

  async function createUserDocument(user, preAssignedRole = null) {
    console.log('[Auth] Creating user document for:', user.uid)
    try {
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        console.log('[Auth] User document does not exist, creating...')
        // Use pre-assigned role from personnel record if available, otherwise default to user
        const role = preAssignedRole ? normalizeRole(preAssignedRole) : ROLES.USER
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        })
        console.log('[Auth] User document created successfully with role:', role)
      } else {
        console.log('[Auth] User document exists, updating lastLogin...')
        await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
      }
    } catch (error) {
      console.error('[Auth] Failed to create user document:', error)
      throw error
    }
  }

  async function checkPersonnelExists(email) {
    console.log('[Auth] Checking if email exists in personnel:', email)
    try {
      const personnelQuery = query(
        collection(db, 'personnel'),
        where('email', '==', email.toLowerCase())
      )
      const snapshot = await getDocs(personnelQuery)
      return !snapshot.empty
    } catch (error) {
      console.error('[Auth] Error checking personnel:', error)
      return false
    }
  }

  async function autoLinkPersonnelRecord(user) {
    authLog('Auth', 'Auto-linking personnel record', { email: user.email, uid: user.uid })
    try {
      const personnelQuery = query(
        collection(db, 'personnel'),
        where('email', '==', user.email.toLowerCase())
      )
      const snapshot = await getDocs(personnelQuery)

      if (snapshot.empty) {
        authLog('Auth', 'No personnel record found for auto-link', { email: user.email })
        return { linked: false, role: null }
      }

      const personnelDoc = snapshot.docs[0]
      const personnelData = personnelDoc.data()
      const personnelRole = personnelData.role ? normalizeRole(personnelData.role) : null

      // Only link if not already linked
      if (!personnelData.userId) {
        authLog('Auth', 'Linking personnel record', {
          personnelId: personnelDoc.id,
          email: user.email,
          uid: user.uid,
          personnelRole,
        })
        await updateDoc(doc(db, 'personnel', personnelDoc.id), {
          userId: user.uid,
          linkedAt: serverTimestamp(),
        })
        authLog('Auth', 'Personnel record linked successfully')

        // Migrate any status document from personnel doc ID to Auth UID
        try {
          const oldStatusRef = doc(db, 'personnelStatus', personnelDoc.id)
          const oldStatusSnap = await getDoc(oldStatusRef)
          if (oldStatusSnap.exists()) {
            const newStatusRef = doc(db, 'personnelStatus', user.uid)
            const newStatusSnap = await getDoc(newStatusRef)

            // Only migrate if no status exists at Auth UID
            if (!newStatusSnap.exists()) {
              authLog('Auth', 'Migrating status from personnel doc ID to Auth UID', {
                from: personnelDoc.id,
                to: user.uid,
              })
              const oldData = oldStatusSnap.data()
              await setDoc(newStatusRef, {
                ...oldData,
                personnelId: user.uid,
                migratedFrom: personnelDoc.id,
                migratedAt: serverTimestamp(),
              })
              await deleteDoc(oldStatusRef)
              authLog('Auth', 'Status migrated successfully')
            }
          }
        } catch (migrationError) {
          // Non-critical - log but don't fail the linking
          authLog('Auth', 'Status migration failed (non-critical)', { error: migrationError.message })
          console.error('[Auth] Status migration error:', migrationError)
        }

        // If personnel has a pre-assigned role, sync it to the user document
        if (personnelRole && personnelRole !== ROLES.USER) {
          authLog('Auth', 'Syncing pre-assigned role from personnel to user', {
            uid: user.uid,
            role: personnelRole,
          })
          await updateDoc(doc(db, 'users', user.uid), {
            role: personnelRole,
          })
          authLog('Auth', 'Role synced successfully')
        }

        return { linked: true, role: personnelRole }
      } else if (personnelData.userId !== user.uid) {
        authLog('Auth', 'Personnel record already linked to different user', {
          personnelId: personnelDoc.id,
          existingUserId: personnelData.userId,
          attemptedUserId: user.uid,
        })
        return { linked: false, role: null }
      } else {
        authLog('Auth', 'Personnel record already linked to this user')
        return { linked: true, role: personnelRole }
      }
    } catch (error) {
      authLog('Auth', 'Error auto-linking personnel record', { error: error.message })
      console.error('[Auth] Error auto-linking personnel:', error)
      // Don't throw - this is a non-critical operation
      return { linked: false, role: null }
    }
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    authLog('Auth', 'Starting Google sign-in', {
      authDomain: auth.config.authDomain,
      currentUser: auth.currentUser?.email || null,
    })

    try {
      const result = await signInWithPopup(auth, provider)
      authLog('Auth', 'signInWithPopup succeeded', {
        uid: result.user.uid,
        email: result.user.email,
        providerId: result.providerId,
      })

      // Check if user exists in personnel table
      authLog('Auth', 'Checking personnel table...')
      const isPersonnel = await checkPersonnelExists(result.user.email)
      authLog('Auth', 'Personnel check result', { isPersonnel, email: result.user.email })

      if (!isPersonnel) {
        authLog('Auth', 'User NOT in personnel table, signing out', { email: result.user.email })
        await signOut(auth)
        throw new Error('Access denied. You must be registered in the personnel roster to use this application.')
      }

      // Auto-link personnel record to Firebase user first to get pre-assigned role
      authLog('Auth', 'Auto-linking personnel record...')
      const { role: preAssignedRole } = await autoLinkPersonnelRecord(result.user)

      authLog('Auth', 'Creating/updating user document...')
      await createUserDocument(result.user, preAssignedRole)

      authLog('Auth', 'Sign-in complete', { uid: result.user.uid })
      return result.user
    } catch (error) {
      authLog('Auth', 'SIGN-IN ERROR', {
        code: error.code,
        message: error.message,
        name: error.name,
      })
      throw error
    }
  }

  async function logout() {
    authLog('Auth', 'Logout initiated by user')
    try {
      await signOut(auth)
      authLog('Auth', 'signOut() completed')
      setUserRole(null)
    } catch (error) {
      authLog('Auth', 'Logout error', { error: error.message })
      throw error
    }
  }

  useEffect(() => {
    authLog('Auth', 'Setting up onAuthStateChanged listener')

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      authStateChangeCount.current += 1
      const timeSinceMount = Date.now() - mountTime.current

      authLog('Auth', 'onAuthStateChanged fired', {
        changeCount: authStateChangeCount.current,
        timeSinceMount: `${timeSinceMount}ms`,
        hasUser: !!currentUser,
        uid: currentUser?.uid || null,
        email: currentUser?.email || null,
        emailVerified: currentUser?.emailVerified || null,
        isAnonymous: currentUser?.isAnonymous || null,
        providerId: currentUser?.providerId || null,
        previousUser: user?.uid || null,
      })

      // Check if this is a logout (had user, now don't)
      if (user && !currentUser) {
        authLog('Auth', 'USER LOGGED OUT - was logged in, now null', {
          previousUid: user.uid,
          previousEmail: user.email,
        })
      }

      setUser(currentUser)

      if (currentUser) {
        authLog('Auth', 'User authenticated, fetching role...')
        try {
          const role = await fetchUserRole(currentUser.uid)
          authLog('Auth', 'Role fetch complete, setting state', { role })
          setUserRole(role)
        } catch (error) {
          authLog('Auth', 'ERROR during role fetch', { error: error.message })
          setUserRole(ROLES.USER)
        }
      } else {
        authLog('Auth', 'No user, clearing role')
        setUserRole(null)
      }

      authLog('Auth', 'Setting loading to false')
      setLoading(false)
    })

    return () => {
      authLog('Auth', 'Cleaning up onAuthStateChanged listener')
      unsubscribe()
    }
  }, [])

  // Memoized permission check function
  const can = useCallback(
    (permission) => hasPermission(userRole, permission),
    [userRole]
  )

  const value = {
    user,
    userRole,
    loading,

    // Legacy computed properties (keep for backward compatibility)
    isAdmin: userRole === ROLES.ADMIN,
    isUniformAdmin: userRole === ROLES.UNIFORM_ADMIN || userRole === ROLES.ADMIN,
    canManageWeather: userRole === ROLES.UNIFORM_ADMIN || userRole === ROLES.ADMIN,

    // New permission-based check function
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

    signInWithGoogle,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
