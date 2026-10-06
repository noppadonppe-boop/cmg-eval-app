const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

// Exact quarter, then the nearest previous quarter, then legacy annual config.
export function getEffectiveConfig(configs, staffId, year, quarter) {
  const quarterIndex = QUARTERS.indexOf(String(quarter || '').toUpperCase())
  for (let index = quarterIndex; index >= 0; index--) {
    const config = configs.find((item) => item.staffId === staffId && item.year === year && item.quarter === QUARTERS[index])
    if (config) return config
  }
  return configs.find((item) => item.staffId === staffId && item.year === year && !item.quarter) || null
}

// A new supervisor starts a new KPI agreement in every affected quarter.
// Retain the previous agreement and its scores for audit, outside active KPIs.
export function reconcileSupervisorChanges(previous, next) {
  if (!previous || !next || previous.staffConfigs === next.staffConfigs) return next
  const previousConfigs = previous.staffConfigs || []
  const nextConfigs = next.staffConfigs || []
  const staffYears = new Map()
  for (const config of [...previousConfigs, ...nextConfigs]) {
    staffYears.set(JSON.stringify([config.staffId, config.year]), config)
  }
  const scopeKey = (record) => JSON.stringify([record.staffId, record.year, record.quarter || 'Q1'])
  const changedScopes = new Map()
  for (const { staffId, year } of staffYears.values()) {
    for (const quarter of QUARTERS) {
      const previousSupervisorId = getEffectiveConfig(previousConfigs, staffId, year, quarter)?.supervisorId || ''
      const supervisorId = getEffectiveConfig(nextConfigs, staffId, year, quarter)?.supervisorId || ''
      if (previousSupervisorId === supervisorId) continue
      const scope = { staffId, year, quarter, previousSupervisorId, supervisorId }
      changedScopes.set(scopeKey(scope), scope)
    }
  }
  if (changedScopes.size === 0) return next
  const kpis = next.kpis || []
  const evaluations = next.quarterlyEvaluations || []
  const isPart3 = (record) => ['part3_staff', 'part3_sup'].includes(record.part)
  const changedAt = new Date().toISOString()
  const history = []
  for (const [key, scope] of changedScopes) {
    const archivedKpis = kpis.filter((record) => scopeKey(record) === key)
    const archivedEvaluations = evaluations.filter((record) => scopeKey(record) === key && isPart3(record))
    if (!archivedKpis.length && !archivedEvaluations.length) continue
    history.push({
      ...scope,
      id: `kpi_reassignment_${key}_${changedAt}`,
      reason: 'supervisor_changed', changedAt,
      kpis: archivedKpis, quarterlyEvaluations: archivedEvaluations,
    })
  }
  return {
    ...next,
    kpis: kpis.filter((record) => !changedScopes.has(scopeKey(record))),
    quarterlyEvaluations: evaluations.filter((record) => !isPart3(record) || !changedScopes.has(scopeKey(record))),
    kpiReassignments: [...(next.kpiReassignments || []), ...history],
  }
}
