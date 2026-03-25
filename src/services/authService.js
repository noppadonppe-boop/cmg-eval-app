import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  doc, getDoc, setDoc, collection, query, where,
  getDocs, updateDoc, serverTimestamp, runTransaction,
  addDoc, onSnapshot, deleteDoc,
} from 'firebase/firestore'
import { auth, db, googleProvider, hasConfig } from '../firebase'

export const APP_NAME = 'CMG-eval-app'
export const ROOT_DOC_ID = 'root'

export const ALL_ROLES = [
  'Staff', 'HR', 'HRM', 'GM', 'MD', 'MasterAdmin', 'Viewer', 'Creator',
]

// ── Firestore refs ─────────────────────────────────────────────────────────────
const userDocRef = (uid) => doc(db, APP_NAME, ROOT_DOC_ID, 'users', uid)
const usersCol = () => collection(db, APP_NAME, ROOT_DOC_ID, 'users')
const appMetaRef = () => doc(db, APP_NAME, ROOT_DOC_ID, 'appMeta', 'config')
const logsCol = () => collection(db, APP_NAME, ROOT_DOC_ID, 'activityLogs')

// ── Activity log (non-blocking) ────────────────────────────────────────────────
function logActivity(uid, action, extra = {}) {
  if (!db) return
  addDoc(logsCol(), { uid, action, ...extra, createdAt: serverTimestamp() }).catch(() => {})
}

// ── Fetch profile ──────────────────────────────────────────────────────────────
export async function fetchProfile(uid) {
  if (!db) return null
  try {
    const snap = await getDoc(userDocRef(uid))
    if (!snap.exists()) return null
    return { ...snap.data(), uid: snap.id }
  } catch {
    return null
  }
}

// ── Detect first user & create profile (Transaction) ──────────────────────────
async function createUserProfile(firebaseUser, extra = {}) {
  if (!db) return null
  const metaRef = appMetaRef()
  let profile = null

  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef)
    const isFirst = !metaSnap.exists() || !metaSnap.data()?.firstUserRegistered

    profile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      firstName: extra.firstName || firebaseUser.displayName?.split(' ')[0] || '',
      lastName: extra.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      position: extra.position || '',
      roles: isFirst ? ['MasterAdmin'] : ['Staff'],
      status: isFirst ? 'approved' : 'pending',
      assignedProjects: [],
      photoURL: firebaseUser.photoURL || '',
      isFirstUser: isFirst,
      staffCode: '',
      createdAt: serverTimestamp(),
    }

    tx.set(userDocRef(firebaseUser.uid), profile)
    tx.set(
      metaRef,
      {
        firstUserRegistered: true,
        totalUsers: (metaSnap.data()?.totalUsers ?? 0) + 1,
        createdAt: metaSnap.exists() ? metaSnap.data().createdAt : serverTimestamp(),
      },
      { merge: true }
    )
  })

  return profile
}

// ── loginWithEmail ─────────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  const profile = await fetchProfile(cred.user.uid)
  logActivity(cred.user.uid, 'LOGIN', { method: 'email' })
  return { user: cred.user, profile }
}

// ── loginWithGoogle ────────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  let profile = await fetchProfile(cred.user.uid)
  if (!profile) {
    profile = await createUserProfile(cred.user)
    logActivity(cred.user.uid, 'REGISTER', { method: 'google' })
  }
  logActivity(cred.user.uid, 'LOGIN', { method: 'google' })
  return { user: cred.user, profile }
}

// ── registerWithEmail ──────────────────────────────────────────────────────────
export async function registerWithEmail(email, password, firstName, lastName, position) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, {
    displayName: [firstName, lastName].filter(Boolean).join(' '),
  })
  const profile = await createUserProfile(cred.user, { firstName, lastName, position })
  logActivity(cred.user.uid, 'REGISTER', { method: 'email' })
  return { user: cred.user, profile }
}

// ── logout ─────────────────────────────────────────────────────────────────────
export async function logout() {
  if (auth) await signOut(auth)
}

// ── Admin: get all users (one-time) ───────────────────────────────────────────
export async function getAllUsers() {
  if (!db) return []
  const snap = await getDocs(usersCol())
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id }))
}

// ── Admin: update user ─────────────────────────────────────────────────────────
export async function updateUserProfile(uid, updates) {
  if (!db) return
  await updateDoc(userDocRef(uid), updates)
}

// ── Subscribe to all users (realtime) ─────────────────────────────────────────
export function subscribeAllUsers(callback) {
  if (!hasConfig || !db) { callback([]); return () => {} }
  return onSnapshot(
    usersCol(),
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), uid: d.id }))),
    () => callback([])
  )
}

// ── Subscribe to pending count (realtime badge) ────────────────────────────────
export function subscribePendingCount(callback) {
  if (!hasConfig || !db) { callback(0); return () => {} }
  const q = query(usersCol(), where('status', '==', 'pending'))
  return onSnapshot(q, (snap) => callback(snap.size), () => callback(0))
}
