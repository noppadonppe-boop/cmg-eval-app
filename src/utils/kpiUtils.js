export const KPI_MAX_PER_QUARTER = 3
export const KPI_TOTAL_SCORE = 30

/**
 * A skipped KPI still occupies one of the three required KPI slots, but is
 * excluded from Staff/Supervisor scoring.
 */
export function isKpiSkipped(kpi) {
  return kpi?.isSkipped === true || kpi?.status === 'Skipped'
}

export function isKpiScorable(kpi) {
  return !isKpiSkipped(kpi) && kpi?.status === 'Accepted'
}

export function getScorableKpis(kpis = []) {
  return kpis.filter(isKpiScorable)
}

export function getKpiMaxPerItem(count) {
  return count > 0 ? KPI_TOTAL_SCORE / count : KPI_TOTAL_SCORE
}

export function isKpiSetupReady(kpis = []) {
  return kpis.length === KPI_MAX_PER_QUARTER && kpis.every(
    (kpi) => isKpiSkipped(kpi) || kpi.status === 'Accepted'
  )
}
