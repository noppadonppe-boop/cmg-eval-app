import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import useRBAC, { ROLE_BADGE_CLASSES } from '../hooks/useRBAC'
import Part5Quarterly from '../components/dashboard/Part5Quarterly'
import Part6ExecAnnual from '../components/dashboard/Part6ExecAnnual'
import { BarChart2, Users, ClipboardList, TrendingUp, LayoutDashboard, CheckCircle2, XCircle } from 'lucide-react'
import { subscribeAllUsers } from '../services/authService'

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

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

function getUserDisplayName(user) {
  if (!user) return ''
  if (user.name) return user.name
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`
  if (user.firstName) return user.firstName
  return user.email || 'User'
}

function getUserPrimaryRole(user) {
  if (!user) return 'Staff'
  if (user.role) return user.role
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const rolePriority = ['MasterAdmin', 'MD', 'GM', 'HRM', 'HR', 'Creator', 'Staff', 'Viewer']
    for (const r of rolePriority) {
      if (user.roles.includes(r)) return r
    }
    return user.roles[0]
  }
  return 'Staff'
}

function normalizeAnyUser(u) {
  if (!u) return null
  return {
    ...u,
    id: u.id || u.uid,
    name: getUserDisplayName(u),
    role: getUserPrimaryRole(u),
  }
}

function EvalStatusCard({ title, user, done, subtitle, extraCount = 0, accent = 'indigo' }) {
  const accentMap = {
    indigo: {
      wrap: 'from-indigo-50 to-blue-50',
      avatar: 'bg-indigo-100 text-indigo-700',
      title: 'text-indigo-700',
    },
    violet: {
      wrap: 'from-violet-50 to-fuchsia-50',
      avatar: 'bg-violet-100 text-violet-700',
      title: 'text-violet-700',
    },
  }
  const tone = accentMap[accent] || accentMap.indigo

  return (
    <button
      type="button"
      className={`w-full text-left bg-gradient-to-br ${tone.wrap} rounded-xl p-3 flex items-center gap-2.5 min-h-[84px] border border-transparent shadow-none hover:bg-opacity-80 transition-all`}
    >
      <div className="relative shrink-0">
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user?.name || title} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow" />
        ) : (
          <div className={`w-10 h-10 rounded-full ${tone.avatar} flex items-center justify-center font-bold text-sm`}>
            {getInitials(user?.name || title)}
          </div>
        )}
        {extraCount > 0 && (
          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-gray-800 text-white text-[10px] font-bold">
            +{extraCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold ${tone.title}`}>{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
        done ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200'
      }`}>
        {done ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
        {done ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน'}
      </div>
    </button>
  )
}

function EvalActorRow({ user, done, fallbackLabel }) {
  return (
    <button
      type="button"
      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent bg-white/70 hover:bg-white/90 transition-colors"
    >
      {user?.photoURL ? (
        <img src={user.photoURL} alt={user?.name || fallbackLabel} className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
          {getInitials(user?.name || fallbackLabel)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-900 truncate">{user?.name || fallbackLabel}</p>
      </div>
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 shrink-0 ${
        done ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200'
      }`}>
        {done ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        {done ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน'}
      </div>
    </button>
  )
}

function EvalPersonCard({ label, user, done, accent = 'indigo', fallbackLabel }) {
  const accentMap = {
    indigo: { wrap: 'from-indigo-50 to-blue-50', avatar: 'bg-indigo-100 text-indigo-700', label: 'text-indigo-700' },
    violet: { wrap: 'from-violet-50 to-fuchsia-50', avatar: 'bg-violet-100 text-violet-700', label: 'text-violet-700' },
    purple: { wrap: 'from-purple-50 to-pink-50', avatar: 'bg-purple-100 text-purple-700', label: 'text-purple-700' },
  }
  const tone = accentMap[accent] || accentMap.indigo
  const display = user?.name || fallbackLabel || 'User'
  return (
    <button
      type="button"
      className={`shrink-0 w-[300px] text-left bg-gradient-to-br ${tone.wrap} rounded-xl p-3 flex items-center gap-2.5 min-h-[84px] border border-transparent hover:bg-opacity-80 transition-all`}
    >
      {user?.photoURL ? (
        <img src={user.photoURL} alt={display} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow shrink-0" />
      ) : (
        <div className={`w-10 h-10 rounded-full ${tone.avatar} flex items-center justify-center font-bold text-sm shrink-0`}>
          {getInitials(display)}
        </div>
      )}
      <div className="flex-1">
        <p className={`text-xs font-bold ${tone.label} whitespace-nowrap`}>{label}</p>
        <p className="text-xs text-gray-700 whitespace-nowrap">{display}</p>
      </div>
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 shrink-0 ${
        done ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200'
      }`}>
        {done ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        {done ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน'}
      </div>
    </button>
  )
}

export default function DashboardPage() {
  const { currentUser, selectedYear, activeQuarter, data } = useApp()
  const { role, can } = useRBAC()
  const [firebaseUsers, setFirebaseUsers] = useState([])

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      setFirebaseUsers(users.map(normalizeAnyUser).filter(Boolean))
    })
    return unsub
  }, [])

  const showQuarterly = can('canViewQuarterlyDashboard')
  const showAnnual = can('canViewAnnualTrend')
  const showStatsStrip = role !== 'Staff'
  const currentQuarter = activeQuarter || 'Q1'
  const allUsers = firebaseUsers.length > 0
    ? firebaseUsers
    : (data.users || []).map(normalizeAnyUser).filter(Boolean)

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

  const findEval = (staffId, evaluatorId, part, evaluatorRole = null) =>
    (data.quarterlyEvaluations || []).find(
      (e) =>
        e.year === selectedYear &&
        e.quarter === currentQuarter &&
        e.staffId === staffId &&
        e.evaluatorId === evaluatorId &&
        e.part === part &&
        (evaluatorRole ? e.evaluatorRole === evaluatorRole : true)
    )

  const part2Exists = (staffId) =>
    (data.quarterlyEvaluations || []).some(
      (e) => e.year === selectedYear && e.quarter === currentQuarter && e.staffId === staffId && e.part === 'part2'
    )

  const isSupervisorDone = (staffId, supervisorId) => {
    if (!supervisorId) return false
    return !!(
      part2Exists(staffId) &&
      findEval(staffId, supervisorId, 'part1', 'Supervisor') &&
      findEval(staffId, supervisorId, 'part3_sup', 'Supervisor') &&
      findEval(staffId, supervisorId, 'part4', 'Supervisor')
    )
  }

  const isStakeholderDone = (staffId, stakeholderId) => {
    if (!stakeholderId) return false
    // Match EvalPage "ประเมินครบแล้ว" logic for stakeholder context:
    // Part1 + Part4 by stakeholder + Part2 exists (Part3 counts as pre-filled for stakeholder)
    return !!(
      part2Exists(staffId) &&
      findEval(staffId, stakeholderId, 'part1', 'Stakeholder') &&
      findEval(staffId, stakeholderId, 'part4', 'Stakeholder')
    )
  }

  const myConfig = (data.staffConfigs || []).find((c) => c.year === selectedYear && c.staffId === currentUser.id) || null
  const mySupervisor = myConfig?.supervisorId
    ? allUsers.find((u) => u.id === myConfig.supervisorId)
    : null
  const myStakeholders = (myConfig?.stakeholderIds || [])
    .map((id) => allUsers.find((u) => u.id === id))
    .filter(Boolean)

  const selfDone = !!(
    part2Exists(currentUser.id) &&
    findEval(currentUser.id, currentUser.id, 'part1', 'Staff') &&
    findEval(currentUser.id, currentUser.id, 'part3_staff', 'Staff') &&
    findEval(currentUser.id, currentUser.id, 'part4', 'Staff')
  )

  const supervisorDone = isSupervisorDone(currentUser.id, mySupervisor?.id)
  const stakeholderStatuses = myStakeholders.map((u) => ({
    user: u,
    done: isStakeholderDone(currentUser.id, u.id),
  }))
  const statusCards = [
    { key: 'self', label: 'ตนเอง', user: currentUser, done: selfDone, accent: 'indigo', fallbackLabel: 'Self' },
    { key: 'supervisor', label: 'หัวหน้างาน', user: mySupervisor, done: supervisorDone, accent: 'violet', fallbackLabel: 'ยังไม่ได้กำหนดหัวหน้างาน' },
    ...stakeholderStatuses.map((s, idx) => ({
      key: `stakeholder_${s.user.id}`,
      label: `ผู้ที่มีส่วนร่วม ${idx + 1}`,
      user: s.user,
      done: s.done,
      accent: 'purple',
      fallbackLabel: 'Stakeholder',
    })),
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
      {showStatsStrip && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      )}
      {!showStatsStrip && (
        <div className="rounded-2xl bg-transparent p-1 sm:p-2 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              สถานะการประเมิน {selectedYear} · {currentQuarter}
            </p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
              Staff Overview
            </span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-start-1">
                <EvalPersonCard
                  key={statusCards[0].key}
                  label={statusCards[0].label}
                  user={statusCards[0].user}
                  done={statusCards[0].done}
                  accent={statusCards[0].accent}
                  fallbackLabel={statusCards[0].fallbackLabel}
                />
              </div>
              <div className="lg:col-start-2">
                <EvalPersonCard
                  key={statusCards[1].key}
                  label={statusCards[1].label}
                  user={statusCards[1].user}
                  done={statusCards[1].done}
                  accent={statusCards[1].accent}
                  fallbackLabel={statusCards[1].fallbackLabel}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {statusCards.slice(2).map((c) => (
                <EvalPersonCard
                  key={c.key}
                  label={c.label}
                  user={c.user}
                  done={c.done}
                  accent={c.accent}
                  fallbackLabel={c.fallbackLabel}
                />
              ))}
            </div>
          </div>
        </div>
      )}

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
