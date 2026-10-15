export const DISCIPLINE_RULE_CATEGORIES = [
  { key: 'sick', label: 'ลาป่วย', unit: 'วัน', valueMode: 'total' },
  { key: 'personal', label: 'ลากิจ', unit: 'วัน', valueMode: 'total' },
  { key: 'vacation', label: 'ลาพักร้อน', unit: 'วัน', valueMode: 'overQuota' },
  { key: 'absent', label: 'ขาดงาน (ไม่ลา)', unit: 'ครั้ง', valueMode: 'total' },
  { key: 'warning', label: 'ใบเตือน', unit: 'ฉบับ', valueMode: 'total' },
]

// A rule means: when the measured value is greater than `threshold`, apply
// this deduction. The rule with the greatest matching threshold wins for each
// category; deductions from different categories are then added together.
export const DEFAULT_DISCIPLINE_RULES = [
  { id: 'sick-5', category: 'sick', threshold: 5, deduction: -1 },
  { id: 'sick-10', category: 'sick', threshold: 10, deduction: -2 },
  { id: 'sick-20', category: 'sick', threshold: 20, deduction: -4 },
  { id: 'personal-2', category: 'personal', threshold: 2, deduction: -1 },
  { id: 'personal-4', category: 'personal', threshold: 4, deduction: -2 },
  { id: 'personal-6', category: 'personal', threshold: 6, deduction: -3 },
  { id: 'vacation-0-over-quota', category: 'vacation', threshold: 0, deduction: -1 },
  { id: 'vacation-3-over-quota', category: 'vacation', threshold: 3, deduction: -2 },
  { id: 'absent-0', category: 'absent', threshold: 0, deduction: -3 },
  { id: 'absent-1', category: 'absent', threshold: 1, deduction: -5 },
  { id: 'absent-2', category: 'absent', threshold: 2, deduction: -8 },
  { id: 'warning-0', category: 'warning', threshold: 0, deduction: -2 },
  { id: 'warning-1', category: 'warning', threshold: 1, deduction: -3 },
]

function cloneDefaultRules() {
  return DEFAULT_DISCIPLINE_RULES.map((rule) => ({ ...rule }))
}

export function normalizeDisciplineRules(rules) {
  if (!Array.isArray(rules)) return cloneDefaultRules()

  return rules
    .map((rule, index) => {
      const category = DISCIPLINE_RULE_CATEGORIES.some((item) => item.key === rule?.category)
        ? rule.category
        : null
      const threshold = Number(rule?.threshold)
      const deduction = Number(rule?.deduction)
      if (!category || !Number.isFinite(threshold) || threshold < 0 || !Number.isFinite(deduction)) return null
      return {
        id: String(rule.id || `discipline-rule-${index}`),
        category,
        threshold,
        deduction: Math.min(0, deduction),
      }
    })
    .filter(Boolean)
}

export function getDisciplineRulesForYear(data, year) {
  const configured = data?.disciplineRulesByYear?.[String(year)]
  return Array.isArray(configured) ? normalizeDisciplineRules(configured) : cloneDefaultRules()
}

export function getCategoryMeta(category) {
  return DISCIPLINE_RULE_CATEGORIES.find((item) => item.key === category) || DISCIPLINE_RULE_CATEGORIES[0]
}

export function getRulesForCategory(rules, category) {
  return normalizeDisciplineRules(rules)
    .filter((rule) => rule.category === category)
    .sort((a, b) => a.threshold - b.threshold)
}

export function getDisciplineDeduction(category, value, quota, rules) {
  const measuredValue = category === 'vacation'
    ? Number(value) - (Number(quota) || 0)
    : Number(value) || 0
  const matching = getRulesForCategory(rules, category)
    .filter((rule) => measuredValue > rule.threshold)
  return matching.length ? matching[matching.length - 1].deduction : 0
}

export function calculateMonthScore(month, rules) {
  const values = ['sick', 'personal', 'vacation', 'absent', 'warning']
    .map((key) => month?.[key])
  const hasInput = values.some((value) => value !== '' && value !== undefined && value !== null)
  // An untouched month means the employee has no recorded absence, leave, or
  // warning. Treat it as a normal month so the Discipline score is full marks
  // without requiring HR to type zero into every field.
  if (!hasInput) return 20

  const quota = Number(month?.vacationQuota) || 0
  const deduction = DISCIPLINE_RULE_CATEGORIES.reduce(
    (sum, category) => sum + getDisciplineDeduction(category.key, month?.[category.key], quota, rules),
    0,
  )
  return Math.max(0, 20 + deduction)
}

export function calculateQuarterScore(months, rules) {
  const scores = ['M1', 'M2', 'M3']
    .map((key) => calculateMonthScore(months?.[key], rules))
    .filter((score) => score !== null)
  if (!scores.length) return null
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
}

export function getDisciplineBreakdown(month, rules) {
  const quota = Number(month?.vacationQuota) || 0
  return DISCIPLINE_RULE_CATEGORIES.map((category) => ({
    label: category.label,
    val: Number(month?.[category.key]) || 0,
    ded: getDisciplineDeduction(category.key, month?.[category.key], quota, rules),
  }))
}

export function formatRuleRange(rule) {
  const meta = getCategoryMeta(rule.category)
  const unit = meta.unit

  if (meta.valueMode === 'overQuota') {
    return `เกินโควต้า > ${rule.threshold} ${unit}`
  }

  return `> ${rule.threshold} ${unit}`
}
