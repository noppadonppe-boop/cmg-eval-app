import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Only initialize if we have required config (avoid white screen on missing .env)
const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId
let app = null
let db = null

if (hasConfig) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
  } catch (e) {
    console.error('Firebase init error:', e)
  }
}

export { app, db, hasConfig }
