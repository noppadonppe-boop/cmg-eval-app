import { useState } from 'react'
import { useApp } from '../context/AppContext'
import useRBAC, { ROLE_BADGE_CLASSES } from '../hooks/useRBAC'
import Part5Quarterly from '../components/dashboard/Part5Quarterly'
import Part6ExecAnnual from '../components/dashboard/Part6ExecAnnual'
import { BarChart2, Users, ClipboardList, TrendingUp, LayoutDashboard } from 'lucide-react'

function StatCard({ label, value, icon, bg }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={`${bg} p-3 rounded-lg`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { currentUser, selectedYear, data } = useApp()
  const { role, can } = useRBAC()

  const showQuarterly = can('canViewQuarterlyDashboard')
  const showAnnual = can('canViewAnnualTrend')

  // Tabs only shown to HR/MD who can see both
  const tabs = [
    showQuarterly && { id: 'quarterly', label: 'Part 5 — Quarterly', icon: <BarChart2 size={15} /> },
    showAnnual    && { id: 'annual',    label: 'Part 6 — Annual Trend', icon: <TrendingUp size={15} /> },
  ].filter(Boolean)

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'quarterly')

  const configsThisYear = data.staffConfigs.filter((c) => c.year === selectedYear)
  const kpisThisYear    = data.kpis.filter((k) => k.year === selectedYear)
  const evalsThisYear   = data.quarterlyEvaluations.filter((e) => e.year === selectedYear)

  const stats = [
    { label: 'Staff Configured', value: configsThisYear.length, icon: <Users size={20} className="text-indigo-600" />, bg: 'bg-indigo-50' },
    { label: 'KPIs Defined',     value: kpisThisYear.length,    icon: <ClipboardList size={20} className="text-blue-600" />,   bg: 'bg-blue-50' },
    { label: 'KPIs Accepted',    value: kpisThisYear.filter((k) => k.status === 'Accepted').length, icon: <ClipboardList size={20} className="text-green-600" />, bg: 'bg-green-50' },
    { label: 'Evaluations',      value: evalsThisYear.length,   icon: <BarChart2 size={20} className="text-purple-600" />,  bg: 'bg-purple-50' },
    { label: 'Active Years',     value: data.evaluationYears.length, icon: <TrendingUp size={20} className="text-orange-600" />, bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl">
            <LayoutDashboard size={22} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {currentUser.name}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Evaluation year: <span className="font-semibold text-indigo-600">{selectedYear}</span>
            </p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[role]}`}>
          {role}
        </span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Dashboard tabs (exec sees both, others go straight to their view) */}
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'annual' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full ml-0.5">EXEC</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Part 5: Quarterly dashboard — Staff, Supervisor, HR, MD ── */}
      {showQuarterly && (!tabs.length || tabs.length === 1 || activeTab === 'quarterly') && (
        <Part5Quarterly />
      )}

      {/* ── Part 6: Annual Exec dashboard — HR, MD only ── */}
      {showAnnual && (activeTab === 'annual' || tabs.length === 1) && (
        <Part6ExecAnnual />
      )}

      {/* Fallback for roles with no dashboard access */}
      {!showQuarterly && !showAnnual && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <LayoutDashboard size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Dashboard not available for your role.</p>
          <p className="text-xs text-gray-400 mt-1">Navigate to Evaluations or KPIs to get started.</p>
        </div>
      )}
    </div>
  )
}
