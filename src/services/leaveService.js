import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { hasLeaveConfig, leaveAuth, leaveDb } from '../firebase'

let anonymousSignInPromise = null

function assertLeaveConfig() {
  if (!hasLeaveConfig || !leaveDb || !leaveAuth) {
    throw new Error('ยังไม่ได้ตั้งค่า Firebase โปรเจกต์ลาใน .env')
  }
}

async function ensureAnonymousUser() {
  assertLeaveConfig()
  if (leaveAuth.currentUser) return leaveAuth.currentUser
  if (!anonymousSignInPromise) {
    anonymousSignInPromise = signInAnonymously(leaveAuth)
      .then(({ user }) => user)
      .catch((error) => {
        // The source project in the user's Firebase console currently has
        // public Firestore rules, but Anonymous Auth is disabled. Public reads
        // do not need an auth token, so allow the read to continue. If the
        // rules later require request.auth, Firestore will return a clear
        // permission-denied error and the console must enable Anonymous Auth.
        if (error?.code === 'auth/admin-restricted-operation') return null
        throw error
      })
      .finally(() => {
        anonymousSignInPromise = null
      })
  }
  return anonymousSignInPromise
}

function asDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value?.toDate === 'function') {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function toIso(value) {
  const date = asDate(value)
  return date ? date.toISOString() : ''
}

function toDateOnly(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const iso = toIso(value)
  return iso ? iso.slice(0, 10) : ''
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1
}

function extractEmployeeCode(documentId) {
  const separatorIndex = String(documentId || '').indexOf('_')
  return (separatorIndex >= 0
    ? String(documentId).slice(0, separatorIndex)
    : String(documentId || '')
  ).trim()
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function addSourceUserLookup(lookup, key, user) {
  const value = String(key ?? '').trim()
  if (!value) return
  lookup.set(value, user)
  lookup.set(normalizeText(value), user)
}

function buildSourceUserLookup(userSnapshots) {
  const lookup = new Map()
  for (const snapshot of userSnapshots) {
    const user = snapshot.data() || {}
    addSourceUserLookup(lookup, snapshot.id, user)
    addSourceUserLookup(lookup, user.id, user)
    addSourceUserLookup(lookup, user.uid, user)
    addSourceUserLookup(lookup, user.user_id, user)
  }
  return lookup
}

function stableFingerprint(record) {
  return JSON.stringify([
    record.userId,
    record.employeeCode,
    record.status,
    record.type,
    record.startDate,
    record.endDate,
    record.totalDays,
    record.isHalfDay,
    record.halfDayPeriod,
    record.attendanceSyncDates,
    record.sourceUpdatedAt,
  ])
}

function normalizeSourceRecord(documentSnapshot, collectionName, year, sourceUsers) {
  const source = documentSnapshot.data() || {}
  const sourceDocId = documentSnapshot.id
  const userId = String(source.user_id ?? source.userId ?? extractEmployeeCode(sourceDocId)).trim()
  const sourceUser = sourceUsers?.get(userId) || sourceUsers?.get(normalizeText(userId))
  const record = {
    year,
    sourceCollection: collectionName,
    sourceDocId,
    sourceKey: `${collectionName}::${sourceDocId}`,
    userId,
    employeeCode: String(
      source.employee_id
      ?? source.employeeId
      ?? source.employee_code
      ?? source.employeeCode
      ?? sourceUser?.employee_id
      ?? sourceUser?.employeeId
      ?? sourceUser?.staffCode
      ?? extractEmployeeCode(sourceDocId),
    ).trim(),
    status: normalizeText(source.status ?? source.approval_status ?? source.approvalStatus),
    type: normalizeText(source.type ?? source.leave_type ?? source.leaveType ?? source.category),
    startDate: toDateOnly(source.start_date ?? source.startDate ?? source.from_date ?? source.fromDate),
    endDate: toDateOnly(source.end_date ?? source.endDate ?? source.to_date ?? source.toDate),
    totalDays: toNumber(source.total_days ?? source.totalDays ?? source.days ?? source.duration, 0),
    isHalfDay: toBoolean(source.is_half_day ?? source.isHalfDay),
    halfDayPeriod: normalizeText(source.half_day_period ?? source.halfDayPeriod),
    attendanceSyncDates: Array.isArray(source.attendance_sync_dates)
      ? source.attendance_sync_dates.map(toDateOnly).filter(Boolean)
      : [],
    sourceUpdatedAt: toIso(source.updated_at ?? source.updatedAt),
  }
  return { ...record, fingerprint: stableFingerprint(record) }
}

function getCursorDate(syncMeta) {
  if (!syncMeta?.incrementalSafe || !syncMeta.lastSourceUpdatedAt) return null
  const cursor = asDate(syncMeta.lastSourceUpdatedAt)
  return cursor && !Number.isNaN(cursor.getTime()) ? cursor : null
}

function getLatestIso(values) {
  const dates = values.map(asDate).filter(Boolean)
  if (!dates.length) return ''
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString()
}

function explainReadError(error) {
  if (error?.code === 'permission-denied' && !leaveAuth?.currentUser) {
    return new Error(
      'Firebase อ่านข้อมูลไม่ได้: เปิด Anonymous Authentication หรือกำหนด Firestore Rules ให้ allow read ได้โดยไม่ต้อง Login',
    )
  }
  return error
}

/**
 * Read leave requests from the separate Firebase project. This function never
 * writes to that project. After the first full read it uses updated_at as a
 * cursor when every imported record has a usable timestamp.
 */
export async function fetchLeaveRecords(year, syncMeta = null) {
  await ensureAnonymousUser()

  const collectionName = `leave_requests_${year}`
  const sourceRef = collection(leaveDb, collectionName)
  let sourceUsers
  const cursorDate = getCursorDate(syncMeta)
  let incremental = Boolean(cursorDate)
  let snapshot

  try {
    const userSnapshot = await getDocs(collection(leaveDb, 'users'))
    sourceUsers = buildSourceUserLookup(userSnapshot.docs)
    snapshot = incremental
      ? await getDocs(query(sourceRef, where('updated_at', '>', Timestamp.fromDate(cursorDate))))
      : await getDocs(sourceRef)
  } catch (error) {
    if (error?.code === 'permission-denied' && !leaveAuth?.currentUser) throw explainReadError(error)
    // A mixed/legacy updated_at field can make an incremental query invalid.
    // Retry once with a full read; permission errors still surface to the UI.
    if (!incremental) throw error
    incremental = false
    try {
      snapshot = await getDocs(sourceRef)
    } catch (fallbackError) {
      throw explainReadError(fallbackError)
    }
  }

  const records = snapshot.docs.map((documentSnapshot) => (
    normalizeSourceRecord(documentSnapshot, collectionName, year, sourceUsers)
  ))
  const allHaveUpdatedAt = records.every((record) => Boolean(record.sourceUpdatedAt))
  const maxSourceUpdatedAt = getLatestIso([
    syncMeta?.lastSourceUpdatedAt,
    ...records.map((record) => record.sourceUpdatedAt),
  ])

  return {
    year,
    collectionName,
    records,
    incremental,
    incrementalSafe: allHaveUpdatedAt && Boolean(maxSourceUpdatedAt),
    maxSourceUpdatedAt,
  }
}

export { asDate, extractEmployeeCode }
