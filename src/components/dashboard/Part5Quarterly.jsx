import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Cell,
} from 'recharts'
import { useApp } from '../../context/AppContext'
import useRBAC, { ROLE_AVATAR_BG, ROLE_BADGE_CLASSES } from '../../hooks/useRBAC'
import { getQuarterScores, QUARTERS, PART_COLORS, PART_LABELS, PART_MAX } from '../../utils/scoreUtils'
import { ChevronDown, BarChart2, Target, CheckCircle2, Clock, XCircle } from 'lucide-react'

const SCORE_COLOR = (val, max) => {
  if (val === null) return 'text-gray-400'
  const pct = val / max
  if (pct >= 0.9) return 'text-indigo-600'
  if (pct >= 0.75) return 'text-green-600'
  if (pct >= 0.5) return 'text-yellow-600'
  if (pct >= 0.3) return 'text-orange-600'
  return 'text-red-600'
}

function ScoreCard({ label, value, max, color }) {
  const pct = value !== null ? Math.round((value / max) * 100) : null
  const barColor = value === null ? 'bg-gray-200'
    : pct >= 90 ? 'bg-indigo-500'
    : pct >= 75 ? 'bg-green-500'
    : pct >= 50 ? 'bg-yellow-400'
    : pct >= 30 ? 'bg-orange-400'
    : 'bg-red-400'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-end justify-between mb-2">
        <span className={`text-2xl font-extrabold ${value !== null ? color : 'text-gray-300'}`}>
          {value !== null ? value : '—'}
        </span>
        <span className="text-xs text-gray-400 font-medium mb-1">/ {max} pts</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: value !== null ? `${pct}%` : '0%' }}
        />
      </div>
      {pct !== null && (
        <p className="text-[10px] text-gray-400 mt-1 text-right">{pct}%</p>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
            <span className="text-gray-600">{p.name}</span>
          </span>
          <span className="font-bold text-gray-900">{p.value !== null ? p.value : '—'}</span>
        </div>
      ))}
    </div>
  )
}

export default function Part5Quarterly() {
  const { data, selectedYear, currentUser } = useApp()
  const { role } = useRBAC()
  const [selectedQuarter, setSelectedQuarter] = useState('Q1')
  const [selectedStaffId, setSelectedStaffId] = useState(null)

  // Determine which staff to show based on staffConfig assignments (not role)
  const yearConfigs = data.staffConfigs.filter((c) => c.year === selectedYear)
  const isExecOrHR = ['HR', 'HRM', 'GM', 'MD'].includes(role)
  let staffList = []
  if (isExecOrHR) {
    // Show all assigned staff
    staffList = yearConfigs
      .map((c) => data.users.find((u) => u.id === c.staffId))
      .filter(Boolean)
  } else {
    // Staff role: show themselves + any staff they supervise
    const staffMap = new Map()
    const selfConfig = yearConfigs.find((c) => c.staffId === currentUser.id)
    if (selfConfig) staffMap.set(currentUser.id, currentUser)
    yearConfigs
      .filter((c) => c.supervisorId === currentUser.id)
      .forEach((c) => {
        const u = data.users.find((u) => u.id === c.staffId)
        if (u) staffMap.set(u.id, u)
      })
    staffList = [...staffMap.values()]
    if (staffList.length === 0) {
      // Fallback: show self even if no config found
      staffList = [currentUser]
    }
  }

  const activeStaffId = selectedStaffId || staffList[0]?.id || null
  const activeStaff = data.users.find((u) => u.id === activeStaffId)

  // Scores for the selected staff/quarter
  const scores = activeStaffId
    ? getQuarterScores(data, activeStaffId, selectedYear, selectedQuarter)
    : { part1: null, part2: null, part3: null, part4: null, total: null }

  // Build bar chart data across all 4 quarters
  const quarterChartData = QUARTERS.map((q) => {
    const s = activeStaffId ? getQuarterScores(data, activeStaffId, selectedYear, q) : {}
    return {
      quarter: q,
      Competency: s.part1,
      Discipline: s.part2,
      KPI: s.part3,
      'Job Desc': s.part4,
    }
  })

  // Radar data for selected quarter
  const radarData = [
    { subject: 'Competency', value: scores.part1, max: 30 },
    { subject: 'Discipline', value: scores.part2, max: 20 },
    { subject: 'KPI', value: scores.part3, max: 30 },
    { subject: 'Job Desc', value: scores.part4, max: 20 },
  ].map((d) => ({
    ...d,
    fullMark: d.max,
    value: d.value !== null ? d.value : 0,
  }))

  // KPI stats for this staff/year/quarter
  const myKpis = data.kpis.filter(
    (k) => k.staffId === activeStaffId && k.year === selectedYear && k.quarter === selectedQuarter
  )
  const kpiAccepted = myKpis.filter((k) => k.status === 'Accepted').length
  const kpiPending = myKpis.filter((k) => k.status === 'Pending').length
  const kpiRejected = myKpis.filter((k) => k.status === 'Rejected').length

  const hasAnyData = Object.values(scores).some((v) => v !== null)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Staff selector (non-staff roles) */}
          {role !== 'Staff' && staffList.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Staff</p>
              <div className="relative">
                <select
                  value={activeStaffId || ''}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="pl-3 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  {staffList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Quarter selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quarter</p>
            <div className="flex gap-2">
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
                    selectedQuarter === q
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Staff badge */}
          {activeStaff && (
            <div className="ml-auto flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full ${ROLE_AVATAR_BG[activeStaff.role] || 'bg-gray-400'} flex items-center justify-center text-white text-sm font-bold`}>
                {activeStaff.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-none">{activeStaff.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedYear} · {selectedQuarter}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!hasAnyData && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <BarChart2 size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">No evaluation data for {selectedQuarter} {selectedYear}</p>
          <p className="text-xs text-gray-400 mt-1">Complete evaluation forms to see scores here.</p>
        </div>
      )}

      {hasAnyData && (
        <>
          {/* Score Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <ScoreCard label="Competency" value={scores.part1} max={30} color={SCORE_COLOR(scores.part1, 30)} />
            <ScoreCard label="Discipline"  value={scores.part2} max={20} color={SCORE_COLOR(scores.part2, 20)} />
            <ScoreCard label="KPI"         value={scores.part3} max={30} color={SCORE_COLOR(scores.part3, 30)} />
            <ScoreCard label="Job Desc"    value={scores.part4} max={20} color={SCORE_COLOR(scores.part4, 20)} />
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 text-white col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-2">Total Score</p>
              <p className="text-3xl font-extrabold">{scores.total ?? '—'}</p>
              <p className="text-xs opacity-70 mt-1">/ 100 pts</p>
              {scores.total !== null && (
                <div className="mt-2 w-full bg-white/20 rounded-full h-1.5">
                  <div className="bg-white h-1.5 rounded-full" style={{ width: `${scores.total}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* KPI summary */}
          {myKpis.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'KPI Accepted', val: kpiAccepted, icon: <CheckCircle2 size={15} />, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
                { label: 'KPI Pending',  val: kpiPending,  icon: <Clock size={15} />,        color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                { label: 'KPI Rejected', val: kpiRejected, icon: <XCircle size={15} />,      color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200' },
              ].map((s) => (
                <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.bg} ${s.border}`}>
                  <span className={s.color}>{s.icon}</span>
                  <div>
                    <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar chart — all quarters */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1">Quarterly Score Breakdown — {selectedYear}</p>
              <p className="text-xs text-gray-400 mb-4">All 4 quarters, 4 evaluation parts</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={quarterChartData} barCategoryGap="25%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 30]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Competency" fill={PART_COLORS.part1} radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="Discipline"  fill={PART_COLORS.part2} radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="KPI"         fill={PART_COLORS.part3} radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="Job Desc"    fill={PART_COLORS.part4} radius={[3, 3, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar — selected quarter */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1">Competency Radar</p>
              <p className="text-xs text-gray-400 mb-2">{selectedQuarter} · {selectedYear}</p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Radar
                    name={activeStaff?.name}
                    dataKey="value"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip formatter={(v, n, p) => [`${v} / ${p.payload.fullMark}`, n]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
