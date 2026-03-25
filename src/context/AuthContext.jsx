import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot, doc } from 'firebase/firestore'
import { auth, db, hasConfig } from '../firebase'
import { logout as firebaseLogout, fetchProfile, APP_NAME, ROOT_DOC_ID } from '../services/authService'

const userDocRef = (uid) => doc(db, APP_NAME, ROOT_DOC_ID, 'users', uid)

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const profileUnsubRef = useRef(null)

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) return null
    const p = await fetchProfile(auth.currentUser.uid)
    if (p) setUserProfile(p)
    return p
  }, [])

  useEffect(() => {
    if (!hasConfig || !auth) {
      setAuthLoading(false)
      return
    }

    const authUnsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser)

      if (profileUnsubRef.current) {
        profileUnsubRef.current()
        profileUnsubRef.current = null
      }

      if (fbUser && db) {
        profileUnsubRef.current = onSnapshot(
          userDocRef(fbUser.uid),
          (snap) => {
            setUserProfile(snap.exists() ? { ...snap.data(), uid: snap.id } : null)
            setAuthLoading(false)
          },
          () => {
            setUserProfile(null)
            setAuthLoading(false)
          }
        )
      } else {
        setUserProfile(null)
        setAuthLoading(false)
      }
    })

    return () => {
      authUnsub()
      if (profileUnsubRef.current) profileUnsubRef.current()
    }
  }, [])

  const logout = async () => {
    await firebaseLogout()
    setUserProfile(null)
    setFirebaseUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userProfile, authLoading, refreshProfile, logout, hasConfig }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
