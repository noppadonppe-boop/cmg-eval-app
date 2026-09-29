import { getEffectiveConfig } from '../context/AppContext'
import { isKpiSetupReady } from './kpiUtils'

/**
 * Evaluation cards must not be counted as pending until all required setup data
 * for the selected quarter is available.
 */
export function isEvaluationReady({ data, staffId, year, quarter, users = [] }) {
  const evaluations = data?.quarterlyEvaluations || []
  const kpis = (data?.kpis || []).filter(
    (k) => k.staffId === staffId && k.year === year && k.quarter === quarter
  )

  const hasDiscipline = evaluations.some(
    (e) => e.staffId === staffId && e.year === year && e.quarter === quarter && e.part === 'part2'
  )
  const hasThreeAcceptedKpis = isKpiSetupReady(kpis)

  const staff = users.find((user) => (user.id || user.uid) === staffId)
  const hasJobDescription = !!staff?.jdUrl?.trim()

  const config = getEffectiveConfig(data?.staffConfigs || [], staffId, year, quarter)
  const knownIds = new Set(users.map((user) => user.id || user.uid).filter(Boolean))
  const supervisorId = config?.supervisorId || ''
  const hasSupervisor = !!supervisorId && supervisorId !== staffId && knownIds.has(supervisorId)

  const stakeholderIds = Array.isArray(config?.stakeholderIds)
    ? config.stakeholderIds.filter(Boolean)
    : []
  const uniqueStakeholderIds = [...new Set(stakeholderIds)]
  const hasThreeStakeholders =
    stakeholderIds.length === 3 &&
    uniqueStakeholderIds.length === 3 &&
    uniqueStakeholderIds.every((id) => id !== staffId && knownIds.has(id))

  return hasDiscipline && hasThreeAcceptedKpis && hasJobDescription && hasSupervisor && hasThreeStakeholders
}
