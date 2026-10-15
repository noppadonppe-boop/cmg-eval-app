import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const hasConfig = !!(firebaseConfig.apiKey && firebaseConfig.projectId)
let app = null
let db = null
let auth = null
let leaveApp = null
let leaveDb = null
let leaveAuth = null
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

if (hasConfig) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
  } catch (e) {
    console.error('Firebase init error:', e)
  }
}

const leaveFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_LEAVE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_LEAVE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_LEAVE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_LEAVE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_LEAVE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_LEAVE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_LEAVE_MEASUREMENT_ID,
}

const hasLeaveConfig = !!(
  leaveFirebaseConfig.apiKey &&
  leaveFirebaseConfig.authDomain &&
  leaveFirebaseConfig.projectId &&
  leaveFirebaseConfig.appId
)

if (hasLeaveConfig) {
  try {
    // Keep the leave project completely separate from the evaluation project.
    // The leave project is only used for Anonymous reads; all writes stay in
    // the current application's Firebase project.
    leaveApp = initializeApp(leaveFirebaseConfig, 'leave-source')
    leaveDb = getFirestore(leaveApp)
    leaveAuth = getAuth(leaveApp)
  } catch (e) {
    console.error('Leave Firebase init error:', e)
  }
}

export {
  app,
  db,
  auth,
  googleProvider,
  hasConfig,
  leaveApp,
  leaveDb,
  leaveAuth,
  hasLeaveConfig,
}
