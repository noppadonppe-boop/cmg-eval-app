import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, Cell,
} from 'recharts'
import { useApp } from '../../context/AppContext'
import { ROLE_AVATAR_BG, ROLE_BADGE_CLASSES } from '../../hooks/useRBAC'
import { getMultiYearTrend, getAnnualScores, PART_COLORS, PART_LABELS } from '../../utils/scoreUtils'
import { TrendingUp, Users, Award, BarChart2 } from 'lucide-react'

const STAFF_PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#0ea5e9', '#f97316', '#14b8a6',
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-sm min-w-[160px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.stroke || p.fill }} />
            <span className="text-gray-600 text-xs">{p.name}</span>
          </span>
          <span className="font-bold text-gray-900">{p.value !== null && p.value !== undefined ? p.value : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function GradeTag({ score }) {
  if (score === null) return <span className="text-xs text-gray-400">—</span>
  const grade =
    score >= 90 ? { label: 'A+', cls: 'bg-indigo-100 text-indigo-700 ring-indigo-200' }
    : score >= 80 ? { label: 'A',  cls: 'bg-green-100 text-green-700 ring-green-200' }
    : score >= 70 ? { label: 'B',  cls: 'bg-yellow-100 text-yellow-700 ring-yellow-200' }
    : score >= 60 ? { label: 'C',  cls: 'bg-orange-100 text-orange-700 ring-orange-200' }
    : { label: 'D',  cls: 'bg-red-100 text-red-700 ring-red-200' }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${grade.cls}`}>{grade.label}</span>
  )
}

export default function Part6ExecAnnual() {
  const { data, selectedYear } = useApp()
  const [focusStaffId, setFocusStaffId] = useState(null)

  // All staff across all configs
  const allStaff = [...new Map(
    data.staffConfigs
      .map((c) => data.users.find((u) => u.id === c.staffId))
      .filter(Boolean)
      .map((u) => [u.id, u])
  ).values()]

  const effectiveFocusId = focusStaffId || allStaff[0]?.id || null
  const focusStaff = data.users.find((u) => u.id === effectiveFocusId)

  // Multi-year trend per staff for total score line chart
  const years = [...data.evaluationYears].sort((a, b) => a - b)

  const trendLineData = years.map((yr) => {
    const row = { year: String(yr) }
    allStaff.forEach((u) => {
      const ann = getAnnualScores(data, u.id, yr)
      row[u.name] = ann?.total ?? null
    })
    return row
  })

  // Annual breakdown for selected staff across years (part breakdown bar chart)
  const staffYearBreakdown = years.map((yr) => {
    const ann = getAnnualScores(data, effectiveFocusId, yr)
    return {
      year: String(yr),
      Competency: ann?.part1 ?? null,
      Discipline: ann?.part2 ?? null,
      KPI: ann?.part3 ?? null,
      'Job Desc': ann?.part4 ?? null,
    }
  })

  // Radar for selected staff in selectedYear
  const annualScores = getAnnualScores(data, effectiveFocusId, selectedYear)
  const radarData = [
    { subject: 'Competency', value: annualScores?.part1 ?? 0, fullMark: 30 },
    { subject: 'Discipline',  value: annualScores?.part2 ?? 0, fullMark: 20 },
    { subject: 'KPI',         value: annualScores?.part3 ?? 0, fullMark: 30 },
    { subject: 'Job Desc',    value: annualScores?.part4 ?? 0, fullMark: 20 },
  ]

  // Leaderboard — all staff annual total for selectedYear
  const leaderboard = allStaff
    .map((u) => ({ user: u, scores: getAnnualScores(data, u.id, selectedYear) }))
    .sort((a, b) => (b.scores?.total ?? -1) - (a.scores?.total ?? -1))

  const hasAnyData = leaderboard.some((l) => l.scores !== null)

  return (
    <div className="space-y-6">
      {/* Exec banner */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white">
        <Award size={20} className="shrink-0" />
        <div>
          <p className="text-sm font-bold">Executive Overview — Part 6</p>
          <p className="text-xs opacity-75">Annual multi-year performance trend &amp; staff rankings</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs opacity-70">Active year</p>
          <p className="text-lg font-extrabold">{selectedYear}</p>
        </div>
      </div>

      {!hasAnyData && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <BarChart2 size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">No annual evaluation data available yet.</p>
          <p className="text-xs text-gray-400 mt-1">Complete quarterly evaluations to populate this dashboard.</p>
        </div>
      )}

      {/* ── Multi-year Total Trend (all staff) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-indigo-500" />
          <p className="text-sm font-semibold text-gray-900">Multi-Year Total Score Trend</p>
        </div>
        <p className="text-xs text-gray-400 mb-4">All staff · Annual average across quarters · out of 100 pts</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendLineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {allStaff.map((u, i) => (
              <Line
                key={u.id}
                type="monotone"
                dataKey={u.name}
                stroke={STAFF_PALETTE[i % STAFF_PALETTE.length]}
                strokeWidth={focusStaffId === u.id ? 3 : 2}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
                strokeDasharray={focusStaffId && focusStaffId !== u.id ? '4 4' : undefined}
                opacity={focusStaffId && focusStaffId !== u.id ? 0.35 : 1}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Staff Focus Selector ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Focus on Staff Member</p>
        <div className="flex flex-wrap gap-2">
          {allStaff.map((u, i) => (
            <button
              key={u.id}
              onClick={() => setFocusStaffId(u.id === focusStaffId ? null : u.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                effectiveFocusId === u.id
                  ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: STAFF_PALETTE[i % STAFF_PALETTE.length] }}
              >
                {u.name.charAt(0)}
              </div>
              {u.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Part Breakdown + Radar for focused staff ── */}
      {effectiveFocusId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Part breakdown bar chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900 mb-0.5">
              Annual Part Breakdown — {focusStaff?.name}
            </p>
            <p className="text-xs text-gray-400 mb-4">Averaged across submitted quarters per year</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={staffYearBreakdown} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 30]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Competency" fill={PART_COLORS.part1} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Discipline"  fill={PART_COLORS.part2} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="KPI"         fill={PART_COLORS.part3} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Job Desc"    fill={PART_COLORS.part4} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar for selected year */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900 mb-0.5">
              Skill Radar — {selectedYear}
            </p>
            <p className="text-xs text-gray-400 mb-2">{focusStaff?.name} · annual avg</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <PolarRadiusAxis angle={90} tick={{ fontSize: 9, fill: '#d1d5db' }} domain={[0, 30]} />
                <Radar
                  name={focusStaff?.name}
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip formatter={(v, n, p) => [`${v} / ${p.payload.fullMark}`, n]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Leaderboard for selectedYear ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-indigo-500" />
          <p className="text-sm font-semibold text-gray-900">Staff Leaderboard — {selectedYear}</p>
          <p className="text-xs text-gray-400 ml-1">(annual average total score)</p>
        </div>
        {leaderboard.every((l) => l.scores === null) ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-400">No evaluation data available for {selectedYear}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {leaderboard.map(({ user, scores }, idx) => (
              <div
                key={user.id}
                className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${
                  effectiveFocusId === user.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Rank */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700'
                  : idx === 1 ? 'bg-gray-100 text-gray-600'
                  : idx === 2 ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-50 text-gray-400'
                }`}>
                  {idx + 1}
                </div>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: STAFF_PALETTE[allStaff.findIndex((u) => u.id === user.id) % STAFF_PALETTE.length] }}
                >
                  {user.name.charAt(0)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  {scores && (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {[
                        { label: 'C', val: scores.part1, max: 30, color: PART_COLORS.part1 },
                        { label: 'D', val: scores.part2, max: 20, color: PART_COLORS.part2 },
                        { label: 'K', val: scores.part3, max: 30, color: PART_COLORS.part3 },
                        { label: 'J', val: scores.part4, max: 20, color: PART_COLORS.part4 },
                      ].map((p) => (
                        <span key={p.label} className="text-[10px] text-gray-400">
                          <span style={{ color: p.color }} className="font-bold">{p.label}</span>:{p.val ?? '—'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total + grade */}
                <div className="flex items-center gap-3 shrink-0">
                  {scores !== null ? (
                    <>
                      <div className="text-right">
                        <p className="text-base font-extrabold text-gray-900">{scores.total ?? '—'}</p>
                        <p className="text-[10px] text-gray-400">/ 100</p>
                      </div>
                      <GradeTag score={scores.total} />
                      {/* Progress bar */}
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500"
                          style={{ width: scores.total ? `${scores.total}%` : '0%' }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">No data</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
