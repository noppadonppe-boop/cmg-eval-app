/**
 * Part 1 weighted formula:
 * [ Staff_raw×0.20 + Supervisor_raw×0.50 + Stakeholder_raw×0.30 ] / PART1_MAX_RAW × 30
 * PART1_MAX_RAW = 14 items × 20 = 280
 */
const PART1_MAX_RAW = 14 * 20
const PART1_WEIGHTS = { Staff: 0.20, Supervisor: 0.50, Stakeholder: 0.30 }

/**
 * Part 4 weighted formula (same weights as Part 1, scaled to 20 pts):
 * [ Staff_score×0.20 + Supervisor_score×0.50 + Stakeholder_score×0.30 ] / 20 × 20
 * i.e. weighted average of each evaluator's 0-20 score.
 */
const PART4_WEIGHTS = { Staff: 0.20, Supervisor: 0.50, Stakeholder: 0.30 }

/**
 * Derive aggregated scores for a staff member for a specific year+quarter.
 * Returns { part1, part2, part3, part4, total } — all out of their respective max pts.
 */
export function getQuarterScores(data, staffId, year, quarter) {
  const evals = data.quarterlyEvaluations.filter(
    (e) => e.staffId === staffId && e.year === year && e.quarter === quarter
  )

  // Part 1 — Competency (30 pts): weighted average by evaluator role
  const p1Evals = evals.filter((e) => e.part === 'part1')
  let part1 = null
  if (p1Evals.length > 0) {
    let weightedSum = 0
    let totalWeight = 0
    p1Evals.forEach((e) => {
      const w = PART1_WEIGHTS[e.evaluatorRole] ?? 0
      if (w > 0 && e.rawTotal != null) {
        weightedSum += e.rawTotal * w
        totalWeight += w
      }
    })
    if (totalWeight > 0) {
      part1 = Math.round((weightedSum / PART1_MAX_RAW) * 30 * 100) / 100
    }
  }

  // Part 2 — Discipline (20 pts): single HR entry
  const p2 = evals.find((e) => e.part === 'part2')
  const part2 = p2 ? (p2.scaledScore ?? null) : null

  // Part 3 — KPI (30 pts): Staff×0.40 + Supervisor×0.60
  // Scores are stored in part3_staff (by staffId) and part3_sup (by supervisorId)
  const p3Staff = evals.find((e) => e.part === 'part3_staff' && e.evaluatorRole === 'Staff')
  const p3Sup   = evals.find((e) => e.part === 'part3_sup'   && e.evaluatorRole === 'Supervisor')
  let part3 = null
  if (p3Staff != null || p3Sup != null) {
    const staffRaw = p3Staff?.rawTotal ?? null
    const supRaw   = p3Sup?.rawTotal   ?? null
    if (staffRaw !== null && supRaw !== null) {
      part3 = Math.round((staffRaw * 0.40 + supRaw * 0.60) * 100) / 100
    } else if (staffRaw !== null) {
      part3 = Math.round(staffRaw * 0.40 * 100) / 100
    } else if (supRaw !== null) {
      part3 = Math.round(supRaw * 0.60 * 100) / 100
    }
  }

  // Part 4 — JD (20 pts): weighted average Staff×20% + Supervisor×50% + Stakeholder×30%
  const p4Evals = evals.filter((e) => e.part === 'part4')
  let part4 = null
  if (p4Evals.length > 0) {
    let weightedSum = 0
    let totalWeight = 0
    p4Evals.forEach((e) => {
      const w = PART4_WEIGHTS[e.evaluatorRole] ?? 0
      if (w > 0 && e.scaledScore != null) {
        weightedSum += e.scaledScore * w
        totalWeight += w
      }
    })
    if (totalWeight > 0) {
      part4 = Math.round((weightedSum / totalWeight) * 100) / 100
    }
  }

  const scores = [part1, part2, part3, part4]
  const filled = scores.filter((s) => s !== null)
  const total =
    filled.length > 0
      ? Math.round(filled.reduce((s, v) => s + v, 0) * 10) / 10
      : null

  return { part1, part2, part3, part4, total }
}

/**
 * Get annual score for a staff member in a given year (average across all quarters that have data).
 */
export function getAnnualScores(data, staffId, year) {
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterData = QUARTERS.map((q) => ({
    quarter: q,
    ...getQuarterScores(data, staffId, year, q),
  })).filter((q) => q.total !== null)

  if (quarterData.length === 0) return null

  const avg = (key) => {
    const vals = quarterData.map((q) => q[key]).filter((v) => v !== null)
    return vals.length > 0
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
      : null
  }

  return {
    year,
    part1: avg('part1'),
    part2: avg('part2'),
    part3: avg('part3'),
    part4: avg('part4'),
    total: avg('total'),
    quartersWithData: quarterData.length,
  }
}

/**
 * Get multi-year annual totals for a staff member across all evaluation years.
 */
export function getMultiYearTrend(data, staffId) {
  return data.evaluationYears
    .map((year) => getAnnualScores(data, staffId, year))
    .filter(Boolean)
}

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
export const PART_COLORS = {
  part1: '#6366f1',
  part2: '#22c55e',
  part3: '#3b82f6',
  part4: '#a855f7',
  total: '#f59e0b',
}
export const PART_LABELS = {
  part1: 'Competency',
  part2: 'Discipline',
  part3: 'KPI',
  part4: 'Job Description',
  total: 'Total',
}
export const PART_MAX = { part1: 30, part2: 20, part3: 30, part4: 20 }
