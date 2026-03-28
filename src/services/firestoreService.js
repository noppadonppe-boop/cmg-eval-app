import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore'
import { db, hasConfig } from '../firebase'

const COLLECTION_ID = 'CMG-eval-app'
const ROOT_DOC_ID = 'root'

export function getRootRef() {
  if (!db) return null
  return doc(db, COLLECTION_ID, ROOT_DOC_ID)
}

const DEFAULT_DATA = {
  users: [],
  evaluationYears: [],
  activeYear: null,
  activeQuarter: 'Q1',
  staffConfigs: [],
  kpis: [],
  quarterlyEvaluations: [],
}

function toWritePayload(data) {
  const q = String(data.activeQuarter || '').toUpperCase()
  const activeQuarter = q === 'Q1' || q === 'Q2' || q === 'Q3' || q === 'Q4' ? q : 'Q1'
  return {
    users: data.users ?? [],
    evaluationYears: data.evaluationYears ?? [],
    activeYear: typeof data.activeYear === 'number' ? data.activeYear : null,
    activeQuarter,
    staffConfigs: data.staffConfigs ?? [],
    kpis: data.kpis ?? [],
    quarterlyEvaluations: data.quarterlyEvaluations ?? [],
  }
}

export function parseSnapshot(snap) {
  if (!snap?.exists?.()) return null
  const d = snap.data()
  const q = String(d.activeQuarter || '').toUpperCase()
  const activeQuarter = q === 'Q1' || q === 'Q2' || q === 'Q3' || q === 'Q4' ? q : DEFAULT_DATA.activeQuarter
  return {
    users: Array.isArray(d.users) ? d.users : DEFAULT_DATA.users,
    evaluationYears: Array.isArray(d.evaluationYears) ? d.evaluationYears : DEFAULT_DATA.evaluationYears,
    activeYear: typeof d.activeYear === 'number' ? d.activeYear : DEFAULT_DATA.activeYear,
    activeQuarter,
    staffConfigs: Array.isArray(d.staffConfigs) ? d.staffConfigs : DEFAULT_DATA.staffConfigs,
    kpis: Array.isArray(d.kpis) ? d.kpis : DEFAULT_DATA.kpis,
    quarterlyEvaluations: Array.isArray(d.quarterlyEvaluations) ? d.quarterlyEvaluations : DEFAULT_DATA.quarterlyEvaluations,
  }
}

/**
 * Subscribe to the root document. Callback receives parsed data or null if doc missing.
 * Returns unsubscribe function.
 */
export function subscribeToRoot(callback) {
  if (!hasConfig || !db) {
    callback(null)
    return () => {}
  }
  const ref = getRootRef()
  return onSnapshot(
    ref,
    (snap) => callback(parseSnapshot(snap)),
    (err) => {
      console.error('Firestore subscribe error:', err)
      callback(null)
    }
  )
}

/**
 * Write full app data to root document. All users share this doc.
 */
export async function writeRoot(data) {
  if (!db) return
  const ref = getRootRef()
  await setDoc(ref, toWritePayload(data))
}

/**
 * Apply an update via Transaction: read current doc, apply updater(current), write.
 * Prevents one user's save from overwriting another's — merges with latest Firestore state.
 * @param { (current: object) => object } updater - receives current doc, returns new doc
 */
export async function persistUpdate(updater) {
  if (!db) return
  const ref = getRootRef()
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    const current = parseSnapshot(snap) ?? DEFAULT_DATA
    const next = updater(current)
    transaction.set(ref, toWritePayload(next))
    return next
  })
}

/**
 * Seed root document with initial mock data if it doesn't exist or is empty.
 */
export async function seedIfEmpty(initialData) {
  if (!db) return
  const ref = getRootRef()
  const snap = await getDoc(ref)
  const existing = parseSnapshot(snap)
  const isEmpty = !existing || 
    !existing.users?.length || 
    !existing.evaluationYears?.length
  if (isEmpty) {
    await writeRoot(initialData)
  }
}

export { hasConfig }
