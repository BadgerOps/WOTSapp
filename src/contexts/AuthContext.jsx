import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

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

  async function fetchUserRole(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid))
      if (userDoc.exists()) {
        return userDoc.data().role || 'user'
      }
      return 'user'
    } catch (error) {
      console.error('Error fetching user role:', error)
      return 'user'
    }
  }

  async function createUserDocument(user) {
    console.log('[Auth] Creating user document for:', user.uid)
    try {
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        console.log('[Auth] User document does not exist, creating...')
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        })
        console.log('[Auth] User document created successfully')
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

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    console.log('[Auth] Starting Google sign-in...')
    console.log('[Auth] Auth domain:', auth.config.authDomain)
    try {
      const result = await signInWithPopup(auth, provider)
      console.log('[Auth] Sign-in successful:', result.user.email)

      // Check if user exists in personnel table
      const isPersonnel = await checkPersonnelExists(result.user.email)
      if (!isPersonnel) {
        console.log('[Auth] User not in personnel table, signing out')
        await signOut(auth)
        throw new Error('Access denied. You must be registered in the personnel roster to use this application.')
      }

      await createUserDocument(result.user)
      return result.user
    } catch (error) {
      console.error('[Auth] Sign-in error:', {
        code: error.code,
        message: error.message,
        fullError: error,
      })
      throw error
    }
  }

  async function logout() {
    try {
      await signOut(auth)
      setUserRole(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const role = await fetchUserRole(currentUser.uid)
        setUserRole(role)
      } else {
        setUserRole(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    user,
    userRole,
    loading,
    isAdmin: userRole === 'admin',
    isUniformAdmin: userRole === 'uniform_admin' || userRole === 'admin',
    canManageWeather: userRole === 'uniform_admin' || userRole === 'admin',
    signInWithGoogle,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
