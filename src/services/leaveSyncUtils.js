const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const LEAVE_TYPE_KEYS = {
  sick: ['sick', 'medical'],
  personal: ['personal', 'business', 'errand'],
  vacation: ['vacation', 'annual', 'holiday'],
}

function normalizeCode(value) {
  return String(value ?? '').trim().toLowerCase()
}

function roundNumber(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function toDateOnly(value) {
  const text = String(value ?? '')
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

function dateToUtc(dateOnly) {
  const date = toDateOnly(dateOnly)
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function daysBetween(startDate, endDate) {
  const start = dateToUtc(startDate)
  const end = dateToUtc(endDate || startDate)
  if (!start || !end || end < start) return []

  const dates = []
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(new Date(cursor))
  }
  return dates
}

function getLeaveType(type) {
  const normalized = normalizeCode(type)
  for (const [key, aliases] of Object.entries(LEAVE_TYPE_KEYS)) {
    if (aliases.some((alias) => normalized.includes(alias))) return key
  }
  return null
}

function isApproved(record) {
  return ['approved', 'approve', 'อนุมัติ', 'อนุมัติแล้ว'].includes(normalizeCode(record.status))
}

function getAllocatedDates(record) {
  const explicitDates = Array.isArray(record.attendanceSyncDates)
    ? [...new Set(record.attendanceSyncDates.map(toDateOnly).filter(Boolean))]
    : []
  const dates = explicitDates.length
    ? explicitDates.map(dateToUtc).filter(Boolean)
    : daysBetween(record.startDate, record.endDate)

  if (!dates.length) {
    const fallback = dateToUtc(record.startDate)
    return fallback ? [fallback] : []
  }

  // total_days is the authoritative amount from the leave system. When the
  // source provides attendance dates, distribute it over those dates. For a
  // legacy record without attendance dates, prefer weekdays for cross-day
  // requests so a weekend does not create extra leave days.
  const candidateDates = explicitDates.length || dates.length === 1
    ? dates
    : (dates.filter((date) => {
      const day = date.getUTCDay()
      return day !== 0 && day !== 6
    }) || dates)
  const usableDates = candidateDates.length ? candidateDates : dates
  const totalDays = Number(record.totalDays) > 0
    ? Number(record.totalDays)
    : (record.isHalfDay ? 0.5 : 1)
  const perDate = totalDays / usableDates.length

  return usableDates.map((date) => ({ date, days: perDate }))
}

function getQuarterAndMonthIndex(date) {
  const month = date.getUTCMonth()
  return {
    quarter: QUARTERS[Math.floor(month / 3)],
    monthIndex: month % 3,
  }
}

function blankMonth() {
  return {
    sick: '',
    personal: '',
    vacation: '',
    absent: '',
    warning: '',
    vacationQuota: 0,
    note: '',
  }
}

function normalizeMonth(month) {
  return { ...blankMonth(), ...(month || {}) }
}

function normalizeEvaluationMonths(months) {
  return {
    M1: normalizeMonth(months?.M1),
    M2: normalizeMonth(months?.M2),
    M3: normalizeMonth(months?.M3),
  }
}

function emptyAggregateMonths() {
  return [
    { sick: 0, personal: 0, vacation: 0, hasData: false },
    { sick: 0, personal: 0, vacation: 0, hasData: false },
    { sick: 0, personal: 0, vacation: 0, hasData: false },
  ]
}

function calculateMonthScore(month) {
  const value = (input) => (input === '' || input === undefined || input === null ? null : Number(input) || 0)
  const sick = value(month.sick)
  const personal = value(month.personal)
  const vacation = value(month.vacation)
  const absent = value(month.absent)
  const warning = value(month.warning)
  if ([sick, personal, vacation, absent, warning].every((entry) => entry === null)) return null

  const sickValue = sick ?? 0
  const personalValue = personal ?? 0
  const vacationValue = vacation ?? 0
  const absentValue = absent ?? 0
  const warningValue = warning ?? 0
  const sickDeduction = sickValue <= 5 ? 0 : sickValue <= 10 ? -1 : sickValue <= 20 ? -2 : -4
  const personalDeduction = personalValue <= 2 ? 0 : personalValue <= 4 ? -1 : personalValue <= 6 ? -2 : -3
  const vacationQuota = Number(month.vacationQuota) || 0
  const vacationOver = vacationValue - vacationQuota
  const vacationDeduction = vacationOver <= 0 ? 0 : vacationOver <= 3 ? -1 : -2
  const absentDeduction = absentValue === 0 ? 0 : absentValue === 1 ? -3 : absentValue === 2 ? -5 : -8
  const warningDeduction = warningValue === 0 ? 0 : warningValue === 1 ? -2 : -3
  return Math.max(0, 20 + sickDeduction + personalDeduction + vacationDeduction + absentDeduction + warningDeduction)
}

function calculateQuarterScore(months) {
  const scores = ['M1', 'M2', 'M3'].map((key) => calculateMonthScore(months[key])).filter((score) => score !== null)
  if (!scores.length) return null
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
}

function makeUserMap(users) {
  const map = new Map()
  for (const user of Array.isArray(users) ? users : []) {
    const code = normalizeCode(user.staffCode)
    if (code && (user.uid || user.id) && !map.has(code)) map.set(code, user)
  }
  return map
}

function sourceKey(record) {
  return record.sourceKey || `${record.sourceCollection}::${record.sourceDocId}`
}

/** Merge source documents into the app's local sync ledger without duplicates. */
export function mergeLeaveSyncRecords(existingRecords, incomingRecords, options = {}) {
  const now = options.now || new Date().toISOString()
  const fullSync = Boolean(options.fullSync)
  const usersByCode = makeUserMap(options.users)
  const incomingKeys = new Set()
  const byKey = new Map(
    (Array.isArray(existingRecords) ? existingRecords : []).map((record) => [sourceKey(record), record])
  )
  const stats = {
    fetched: Array.isArray(incomingRecords) ? incomingRecords.length : 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    unmatched: 0,
    missing: 0,
  }

  for (const incoming of Array.isArray(incomingRecords) ? incomingRecords : []) {
    const key = sourceKey(incoming)
    incomingKeys.add(key)
    const existing = byKey.get(key)
    const matched = usersByCode.has(normalizeCode(incoming.employeeCode))
    const syncStatus = matched ? 'synced' : 'unmatched'
    const unchanged = existing?.fingerprint === incoming.fingerprint && existing?.syncStatus === syncStatus

    if (unchanged) {
      stats.unchanged += 1
      if (!matched) stats.unmatched += 1
      continue
    }

    if (existing) stats.updated += 1
    else stats.added += 1
    if (!matched) stats.unmatched += 1
    byKey.set(key, {
      ...incoming,
      syncStatus,
      syncedAt: now,
    })
  }

  if (fullSync) {
    for (const [key, existing] of byKey.entries()) {
      const sameYear = existing.year === options.year
      const sameCollection = existing.sourceCollection === options.sourceCollection
      if (!sameYear || !sameCollection || incomingKeys.has(key) || existing.syncStatus === 'missing') continue
      byKey.set(key, { ...existing, syncStatus: 'missing', syncedAt: now })
      stats.missing += 1
    }
  } else if (!incomingKeys.size) {
    stats.unchanged = (Array.isArray(existingRecords) ? existingRecords : [])
      .filter((record) => record.year === options.year && record.sourceCollection === options.sourceCollection)
      .length
  }

  return { records: [...byKey.values()], stats }
}

function aggregateLeaveRecords(records, users, year, sourceCollection) {
  const usersByCode = makeUserMap(users)
  const grouped = new Map()
  const affectedStaffIds = new Set()

  for (const record of Array.isArray(records) ? records : []) {
    if (
      record.year !== year ||
      record.sourceCollection !== sourceCollection ||
      record.syncStatus === 'missing' ||
      !isApproved(record)
    ) continue

    const user = usersByCode.get(normalizeCode(record.employeeCode))
    const staffId = user?.uid || user?.id
    const leaveType = getLeaveType(record.type)
    if (!staffId || !leaveType) continue
    affectedStaffIds.add(staffId)

    for (const allocation of getAllocatedDates(record)) {
      if (allocation.date.getUTCFullYear() !== Number(year)) continue
      const { quarter, monthIndex } = getQuarterAndMonthIndex(allocation.date)
      const key = `${staffId}::${quarter}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          staffId,
          quarter,
          months: [
            { sick: 0, personal: 0, vacation: 0, hasData: false },
            { sick: 0, personal: 0, vacation: 0, hasData: false },
            { sick: 0, personal: 0, vacation: 0, hasData: false },
          ],
        })
      }
      const month = grouped.get(key).months[monthIndex]
      month[leaveType] = roundNumber(month[leaveType] + allocation.days)
      month.hasData = true
    }
  }

  return { grouped, affectedStaffIds }
}

function applyImportedMonths(existingMonths, aggregateMonths, fillEmptyWithZero = false) {
  const months = normalizeEvaluationMonths(existingMonths)
  for (let index = 0; index < 3; index += 1) {
    const key = `M${index + 1}`
    const aggregate = aggregateMonths[index]
    // Empty string means no imported leave in that month. This keeps the
    // existing scoring behavior for incremental syncs. A complete sync uses
    // zero for the three imported leave fields so a person with no leave data
    // receives the full 20 points for that month.
    months[key] = {
      ...months[key],
      sick: aggregate.hasData ? aggregate.sick : (fillEmptyWithZero ? 0 : ''),
      personal: aggregate.hasData ? aggregate.personal : (fillEmptyWithZero ? 0 : ''),
      vacation: aggregate.hasData ? aggregate.vacation : (fillEmptyWithZero ? 0 : ''),
      leaveSyncManaged: true,
    }
  }
  return months
}

function updateEvaluationRecord(record, quarter, aggregateMonths, now, sourceCollection, sourceCount, fillEmptyWithZero = false) {
  const months = applyImportedMonths(record?.months, aggregateMonths, fillEmptyWithZero)
  const score = calculateQuarterScore(months)
  return {
    ...(record || {}),
    year: record?.year,
    quarter,
    part: 'part2',
    months,
    leaveSyncManaged: true,
    leaveSync: {
      status: 'synced',
      sourceCollection,
      sourceCount,
      lastSyncedAt: now,
    },
    scaledScore: score,
    rawTotal: score,
    updatedAt: now,
  }
}

/** Apply the source ledger to the existing Part 2 quarterly evaluations. */
export function applyLeaveSyncToEvaluations({
  evaluations,
  records,
  users,
  year,
  sourceCollection,
  currentUserId,
  now = new Date().toISOString(),
  fullSync = false,
}) {
  const next = Array.isArray(evaluations) ? evaluations.map((record) => ({ ...record })) : []
  const { grouped, affectedStaffIds } = aggregateLeaveRecords(records, users, year, sourceCollection)
  const usersByCode = makeUserMap(users)

  // On a full sync, recalculate all known staff so a removed/cancelled source
  // document can clear values previously imported by this integration.
  if (fullSync) {
    for (const user of Array.isArray(users) ? users : []) {
      const staffId = user.uid || user.id
      if (staffId) affectedStaffIds.add(staffId)
    }
  }

  const sourceCountByStaff = new Map()
  for (const record of records) {
    if (record.year !== year || record.sourceCollection !== sourceCollection || record.syncStatus === 'missing') continue
    const user = usersByCode.get(normalizeCode(record.employeeCode))
    const staffId = user?.uid || user?.id
    if (staffId) sourceCountByStaff.set(staffId, (sourceCountByStaff.get(staffId) || 0) + 1)
  }

  // Update existing sync-managed evaluations, including quarters that now have
  // no leave data so stale imported values are cleared.
  for (let index = 0; index < next.length; index += 1) {
    const record = next[index]
    if (
      record.year !== year ||
      record.part !== 'part2' ||
      !record.leaveSyncManaged ||
      !affectedStaffIds.has(record.staffId) ||
      fullSync
    ) continue

    const aggregate = grouped.get(`${record.staffId}::${record.quarter}`)
    next[index] = updateEvaluationRecord(
      record,
      record.quarter,
      aggregate?.months || emptyAggregateMonths(),
      now,
      sourceCollection,
      sourceCountByStaff.get(record.staffId) || 0,
    )
  }

  // A complete yearly sync establishes a baseline for every mapped employee.
  // Employees without approved leave still get zero leave values and therefore
  // a full score, while manually maintained absent/warning fields are kept.
  if (fullSync) {
    const syncableUsers = (Array.isArray(users) ? users : [])
      .filter((user) => normalizeCode(user.staffCode) && (user.uid || user.id))

    for (const user of syncableUsers) {
      const staffId = user.uid || user.id
      for (const quarter of QUARTERS) {
        const aggregate = grouped.get(`${staffId}::${quarter}`)
        const existingIndex = next.findIndex(
          (record) => record.year === year && record.quarter === quarter && record.staffId === staffId && record.part === 'part2'
        )
        const sourceCount = sourceCountByStaff.get(staffId) || 0
        const updatedRecord = existingIndex >= 0
          ? updateEvaluationRecord(
            next[existingIndex],
            quarter,
            aggregate?.months || emptyAggregateMonths(),
            now,
            sourceCollection,
            sourceCount,
            true,
          )
          : updateEvaluationRecord({
            id: `eval_${Date.now()}_${staffId}_${quarter}`,
            createdAt: now,
            year,
            quarter,
            staffId,
            evaluatorId: currentUserId || 'leave-sync',
            evaluatorRole: 'HR',
            hrmApproved: false,
            hrmRemark: '',
          }, quarter, aggregate?.months || emptyAggregateMonths(), now, sourceCollection, sourceCount, true)

        if (existingIndex >= 0) next[existingIndex] = updatedRecord
        else next.push(updatedRecord)
      }
    }
  }

  for (const aggregate of grouped.values()) {
    const existingIndex = next.findIndex(
      (record) => record.year === year && record.quarter === aggregate.quarter && record.staffId === aggregate.staffId && record.part === 'part2'
    )
    const sourceCount = sourceCountByStaff.get(aggregate.staffId) || 0

    if (existingIndex >= 0) {
      next[existingIndex] = updateEvaluationRecord(
        next[existingIndex],
        aggregate.quarter,
        aggregate.months,
        now,
        sourceCollection,
        sourceCount,
        fullSync,
      )
      continue
    }

    next.push(updateEvaluationRecord({
      id: `eval_${Date.now()}_${aggregate.staffId}_${aggregate.quarter}`,
      createdAt: now,
      year,
      quarter: aggregate.quarter,
      staffId: aggregate.staffId,
      evaluatorId: currentUserId || 'leave-sync',
      evaluatorRole: 'HR',
      hrmApproved: false,
      hrmRemark: '',
    }, aggregate.quarter, aggregate.months, now, sourceCollection, sourceCount))
  }

  return { evaluations: next, affectedStaffIds, grouped }
}

export { calculateQuarterScore, getLeaveType }
