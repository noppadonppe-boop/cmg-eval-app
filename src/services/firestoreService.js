import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore'
import { db, hasConfig } from '../firebase'
import { reconcileSupervisorChanges } from '../utils/staffConfigUtils'

const COLLECTION_ID = 'CMG-eval-app'
const ROOT_DOC_ID = 'root'
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const DEFAULT_DATA = {
  users: [],
  evaluationYears: [],
  activeYear: null,
  activeQuarter: 'Q1',
  staffConfigs: [],
  kpis: [],
  kpiReassignments: [],
  quarterlyEvaluations: [],
  scorePartSettings: {},
  competencyConfig: null,
}

export function getRootRef() {
  if (!db) return null
  return doc(db, COLLECTION_ID, ROOT_DOC_ID)
}

function isValidQuarter(q) {
  return QUARTERS.includes(q)
}

function normalizeQuarter(q) {
  const normalized = String(q || '').toUpperCase()
  return isValidQuarter(normalized) ? normalized : DEFAULT_DATA.activeQuarter
}

// Older Q1 records were sometimes saved without a quarter or with lowercase
// values. Keep those records readable by the current exact-quarter filters.
function normalizeQuarterTaggedRecords(records) {
  return (Array.isArray(records) ? records : []).map((record) => {
    if (!record || typeof record !== 'object') return record
    const normalized = normalizeQuarter(record.quarter)
    return record.quarter === normalized ? record : { ...record, quarter: normalized }
  })
}

function normalizeStaffConfigRecords(records) {
  return (Array.isArray(records) ? records : []).map((record) => {
    if (!record || typeof record !== 'object' || !record.quarter) return record
    const normalized = normalizeQuarter(record.quarter)
    return record.quarter === normalized ? record : { ...record, quarter: normalized }
  })
}

function normalizeRootData(raw) {
  const d = raw || {}
  return {
    users: Array.isArray(d.users) ? d.users : DEFAULT_DATA.users,
    evaluationYears: Array.isArray(d.evaluationYears) ? d.evaluationYears : DEFAULT_DATA.evaluationYears,
    activeYear: typeof d.activeYear === 'number' ? d.activeYear : DEFAULT_DATA.activeYear,
    activeQuarter: normalizeQuarter(d.activeQuarter),
    staffConfigs: normalizeStaffConfigRecords(d.staffConfigs),
    kpis: normalizeQuarterTaggedRecords(d.kpis),
    kpiReassignments: normalizeQuarterTaggedRecords(d.kpiReassignments),
    quarterlyEvaluations: normalizeQuarterTaggedRecords(d.quarterlyEvaluations),
    scorePartSettings: d.scorePartSettings && typeof d.scorePartSettings === 'object' ? d.scorePartSettings : DEFAULT_DATA.scorePartSettings,
    competencyConfig: d.competencyConfig && typeof d.competencyConfig === 'object' ? d.competencyConfig : null,
  }
}

function toWritePayload(data) {
  return {
    users: data.users ?? [],
    evaluationYears: data.evaluationYears ?? [],
    activeYear: typeof data.activeYear === 'number' ? data.activeYear : null,
    activeQuarter: normalizeQuarter(data.activeQuarter),
    staffConfigs: data.staffConfigs ?? [],
    kpis: data.kpis ?? [],
    kpiReassignments: data.kpiReassignments ?? [],
    quarterlyEvaluations: data.quarterlyEvaluations ?? [],
    scorePartSettings: data.scorePartSettings ?? {},
    competencyConfig: data.competencyConfig ?? null,
  }
}

function getQuarterDocRef(year, quarter) {
  if (!db || !year || !isValidQuarter(quarter) || quarter === 'Q1') return null
  return doc(db, COLLECTION_ID, ROOT_DOC_ID, `${quarter}_${year}`, 'data')
}

function getQuarterNumber(quarter) {
  return QUARTERS.indexOf(quarter) + 1
}

function isRecordForQuarter(record, year, quarter) {
  return record?.year === year && normalizeQuarter(record?.quarter) === quarter
}

function isLegacyQ1Record(record) {
  return !record?.quarter || String(record.quarter).toUpperCase() === 'Q1'
}

function mergeRecords(lists) {
  const result = []
  const seenIds = new Set()
  for (const list of lists) {
    for (const record of Array.isArray(list) ? list : []) {
      if (record?.id) {
        if (seenIds.has(record.id)) continue
        seenIds.add(record.id)
      }
      result.push(record)
    }
  }
  return result
}

function quarterPayloadFromRoot(rootData, year, quarter) {
  return {
    staffConfigs: rootData.staffConfigs.filter((record) => isRecordForQuarter(record, year, quarter)),
    kpis: rootData.kpis.filter((record) => isRecordForQuarter(record, year, quarter)),
    kpiReassignments: rootData.kpiReassignments.filter((record) => isRecordForQuarter(record, year, quarter)),
    quarterlyEvaluations: rootData.quarterlyEvaluations.filter((record) => isRecordForQuarter(record, year, quarter)),
    scorePartSettings: rootData.scorePartSettings?.[year] ?? rootData.scorePartSettings?.[String(year)] ?? null,
    competencyConfig: rootData.competencyConfig ?? null,
  }
}

function parseQuarterSnapshot(snap, fallback) {
  if (!snap?.exists?.()) return fallback
  const d = snap.data() || {}
  return {
    staffConfigs: normalizeStaffConfigRecords(d.staffConfigs),
    kpis: normalizeQuarterTaggedRecords(d.kpis),
    kpiReassignments: normalizeQuarterTaggedRecords(d.kpiReassignments),
    quarterlyEvaluations: normalizeQuarterTaggedRecords(d.quarterlyEvaluations),
    scorePartSettings: d.scorePartSettings && typeof d.scorePartSettings === 'object' ? d.scorePartSettings : null,
    competencyConfig: d.competencyConfig && typeof d.competencyConfig === 'object' ? d.competencyConfig : null,
  }
}

function mergeQuarterData(rootData, quarterData, year, quarter = rootData.activeQuarter) {
  const quarterDataList = Array.isArray(quarterData) ? quarterData : []
  const mergedScoreSettings = { ...(rootData.scorePartSettings || {}) }
  let mergedCompetencyConfig = rootData.competencyConfig

  // Load records for every quarter, but use settings only through the active
  // quarter so preparing future KPIs does not change today's evaluation form.
  for (const data of quarterDataList.slice(0, getQuarterNumber(quarter) - 1)) {
    if (data?.scorePartSettings) mergedScoreSettings[year] = data.scorePartSettings
    if (data?.competencyConfig) mergedCompetencyConfig = data.competencyConfig
  }

  return {
    ...rootData,
    staffConfigs: mergeRecords([
      ...quarterDataList.map((data) => data.staffConfigs),
      rootData.staffConfigs,
    ]),
    kpis: mergeRecords([
      ...quarterDataList.map((data) => data.kpis),
      rootData.kpis,
    ]),
    kpiReassignments: mergeRecords([
      ...quarterDataList.map((data) => data.kpiReassignments),
      rootData.kpiReassignments,
    ]),
    quarterlyEvaluations: mergeRecords([
      ...quarterDataList.map((data) => data.quarterlyEvaluations),
      rootData.quarterlyEvaluations,
    ]),
    scorePartSettings: mergedScoreSettings,
    competencyConfig: mergedCompetencyConfig,
  }
}

function getEffectiveActiveYear(data) {
  const years = Array.isArray(data?.evaluationYears) ? data.evaluationYears : []
  if (years.length === 0) return null
  const fallback = Math.max(...years)
  return typeof data?.activeYear === 'number' && years.includes(data.activeYear)
    ? data.activeYear
    : fallback
}

function getActiveTarget(data, target) {
  const year = typeof target?.year === 'number' ? target.year : getEffectiveActiveYear(data)
  const quarter = normalizeQuarter(target?.quarter || data?.activeQuarter)
  return { year, quarter }
}

function rootPayloadAfterQuarterUpdate(rootData, next, target) {
  const staysInRoot = (record) => {
    return isLegacyQ1Record(record) || record?.year !== target.year
  }
  const mergeRootField = (field) => (next[field] || []).filter(staysInRoot)
  const rootScorePartSettings = { ...(next.scorePartSettings || {}) }
  const targetYearKey = String(target.year)
  if (Object.prototype.hasOwnProperty.call(rootData.scorePartSettings || {}, targetYearKey)) {
    rootScorePartSettings[targetYearKey] = rootData.scorePartSettings[targetYearKey]
  } else if (Object.prototype.hasOwnProperty.call(rootData.scorePartSettings || {}, target.year)) {
    rootScorePartSettings[target.year] = rootData.scorePartSettings[target.year]
  } else {
    delete rootScorePartSettings[targetYearKey]
    delete rootScorePartSettings[target.year]
  }

  return toWritePayload({
    ...rootData,
    users: next.users,
    evaluationYears: next.evaluationYears,
    activeYear: next.activeYear,
    activeQuarter: next.activeQuarter,
    staffConfigs: mergeRootField('staffConfigs'),
    kpis: mergeRootField('kpis'),
    kpiReassignments: mergeRootField('kpiReassignments'),
    quarterlyEvaluations: mergeRootField('quarterlyEvaluations'),
    // Q1 settings stay in root. Q2+ settings belong to their quarter document;
    // keep other years in root so actions such as Add Year are not lost.
    scorePartSettings: target.quarter === 'Q1' ? next.scorePartSettings : rootScorePartSettings,
    // Competency configuration is copied to each Q2+ document when it is first
    // opened; root remains the legacy Q1 configuration.
    competencyConfig: target.quarter === 'Q1' ? next.competencyConfig : rootData.competencyConfig,
  })
}

function quarterPayloadAfterUpdate(data, year, quarter) {
  const scorePartSettings = data.scorePartSettings?.[year] ?? data.scorePartSettings?.[String(year)] ?? null
  return {
    staffConfigs: (data.staffConfigs || []).filter((record) => isRecordForQuarter(record, year, quarter)),
    kpis: (data.kpis || []).filter((record) => isRecordForQuarter(record, year, quarter)),
    kpiReassignments: (data.kpiReassignments || []).filter((record) => isRecordForQuarter(record, year, quarter)),
    quarterlyEvaluations: (data.quarterlyEvaluations || []).filter((record) => isRecordForQuarter(record, year, quarter)),
    scorePartSettings,
    competencyConfig: data.competencyConfig ?? null,
  }
}

export function parseSnapshot(snap) {
  if (!snap?.exists?.()) return null
  return normalizeRootData(snap.data())
}

/**
 * Subscribe to root plus the active year's Q2-Q4 collections. Q1 remains in root.
 * Missing quarter documents are lazily created from the legacy root data.
 */
export function subscribeToApp(callback) {
  if (!hasConfig || !db) {
    callback(null)
    return () => {}
  }

  let quarterUnsubs = []
  let subscriptionId = 0

  const clearQuarterSubscriptions = () => {
    quarterUnsubs.forEach((unsubscribe) => unsubscribe())
    quarterUnsubs = []
  }

  const unsubscribeRoot = onSnapshot(
    getRootRef(),
    (snap) => {
      const rootData = parseSnapshot(snap)
      clearQuarterSubscriptions()
      subscriptionId += 1
      const currentSubscription = subscriptionId

      if (!rootData) {
        callback(null)
        return
      }

      const { year } = getActiveTarget(rootData)
      if (!year) {
        callback(rootData)
        return
      }

      const quarterNumbers = [2, 3, 4]
      const quarterStates = quarterNumbers.map((number) => {
        const q = QUARTERS[number - 1]
        return {
          quarter: q,
          data: quarterPayloadFromRoot(rootData, year, q),
        }
      })

      const emit = () => {
        if (currentSubscription !== subscriptionId) return
        callback(mergeQuarterData(rootData, quarterStates.map((state) => state.data), year))
      }

      // Render immediately from legacy data while the listeners and migration settle.
      emit()

      quarterStates.forEach((state) => {
        const ref = getQuarterDocRef(year, state.quarter)
        const unsubscribe = onSnapshot(
          ref,
          (quarterSnap) => {
            if (currentSubscription !== subscriptionId) return
            state.data = parseQuarterSnapshot(quarterSnap, state.data)
            emit()
            if (!quarterSnap.exists()) {
              ensureQuarterData(year, state.quarter).catch((error) => {
                console.error(`Firestore migration error for ${state.quarter}_${year}:`, error)
              })
            }
          },
          (error) => {
            console.error(`Firestore quarter subscribe error for ${state.quarter}_${year}:`, error)
            emit()
          }
        )
        quarterUnsubs.push(unsubscribe)
      })
    },
    (err) => {
      console.error('Firestore subscribe error:', err)
      callback(null)
    }
  )

  return () => {
    clearQuarterSubscriptions()
    subscriptionId += 1
    unsubscribeRoot()
  }
}

/** Backward-compatible name for callers that only need the root subscription. */
export const subscribeToRoot = subscribeToApp

export async function writeRoot(data) {
  if (!db) return
  await setDoc(getRootRef(), toWritePayload(data))
}

async function ensureQuarterData(year, quarter) {
  const quarterRef = getQuarterDocRef(year, quarter)
  if (!quarterRef) return
  await runTransaction(db, async (transaction) => {
    const [rootSnap, quarterSnap] = await Promise.all([
      transaction.get(getRootRef()),
      transaction.get(quarterRef),
    ])
    const rootData = parseSnapshot(rootSnap) ?? DEFAULT_DATA
    if (!quarterSnap.exists()) {
      transaction.set(quarterRef, quarterPayloadFromRoot(rootData, year, quarter))
    }

    // Once the quarter document is present, remove that quarter's legacy
    // records from root. Q1 records and global fields remain untouched.
    const removeMigratedQuarter = (field) => (rootData[field] || [])
      .filter((record) => !isRecordForQuarter(record, year, quarter))
    transaction.set(getRootRef(), toWritePayload({
      ...rootData,
      staffConfigs: removeMigratedQuarter('staffConfigs'),
      kpis: removeMigratedQuarter('kpis'),
      kpiReassignments: removeMigratedQuarter('kpiReassignments'),
      quarterlyEvaluations: removeMigratedQuarter('quarterlyEvaluations'),
    }))
  })
}

/**
 * Apply an update transactionally across all quarters of the selected year.
 * Q1/global fields remain in root; Q2-Q4 records go to root/{Qx_year}/data,
 * regardless of the active quarter. Only the target quarter's settings change.
 */
export async function persistUpdate(updater, target = null) {
  if (!db) return
  const rootRef = getRootRef()
  const requestedTarget = target

  return runTransaction(db, async (transaction) => {
    const rootSnap = await transaction.get(rootRef)
    const rootData = parseSnapshot(rootSnap) ?? DEFAULT_DATA
    const effectiveTarget = getActiveTarget(rootData, requestedTarget)

    if (!effectiveTarget.year) {
      const current = rootData
      const next = reconcileSupervisorChanges(current, updater(current))
      transaction.set(rootRef, toWritePayload(next))
      return next
    }

    const quarterNumbers = [2, 3, 4]
    const quarterRefs = quarterNumbers.map((number) => getQuarterDocRef(effectiveTarget.year, QUARTERS[number - 1]))
    const quarterSnaps = []
    for (const quarterRef of quarterRefs) {
      quarterSnaps.push(await transaction.get(quarterRef))
    }
    const quarterData = quarterSnaps.map((snap, index) => parseQuarterSnapshot(
      snap,
      quarterPayloadFromRoot(rootData, effectiveTarget.year, QUARTERS[quarterNumbers[index] - 1])
    ))
    const current = mergeQuarterData(rootData, quarterData, effectiveTarget.year, effectiveTarget.quarter)
    const next = reconcileSupervisorChanges(current, updater(current))

    transaction.set(rootRef, rootPayloadAfterQuarterUpdate(rootData, next, effectiveTarget))
    quarterRefs.forEach((ref, index) => {
      const quarter = QUARTERS[quarterNumbers[index] - 1]
      const payload = quarterPayloadAfterUpdate(next, effectiveTarget.year, quarter)
      // Cross-quarter KPI edits must preserve each quarter's own settings.
      if (quarter !== effectiveTarget.quarter) {
        payload.scorePartSettings = quarterData[index].scorePartSettings
        payload.competencyConfig = quarterData[index].competencyConfig
      }
      transaction.set(ref, payload)
    })
    return next
  })
}

export async function seedIfEmpty(initialData) {
  if (!db) return
  const ref = getRootRef()
  const snap = await getDoc(ref)
  const existing = parseSnapshot(snap)
  const isEmpty = !existing || !existing.users?.length || !existing.evaluationYears?.length
  if (isEmpty) await writeRoot(initialData)
}

export { hasConfig }
