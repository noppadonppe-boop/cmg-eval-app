import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import useRBAC, { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../hooks/useRBAC'
import { subscribeAllUsers } from '../services/authService'
import Part1Competency, { COMPETENCY_LIST } from '../components/eval/Part1Competency'
import Part2Discipline from '../components/eval/Part2Discipline'
import Part3KpiEval from '../components/eval/Part3KpiEval'
import Part4JobDescription from '../components/eval/Part4JobDescription'
import StaffMiniCard from '../components/eval/StaffMiniCard'
import { ClipboardList, User, Users, Briefcase, Shield, Target, ChevronDown, ShieldOff } from 'lucide-react'
import { getQuarterScores } from '../utils/scoreUtils'

function StaffSelector({ staffList, value, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = staffList.find((s) => s.id === value)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-all text-sm"
      >
        {selected ? (
          <>
            <div className={`w-6 h-6 rounded-full ${ROLE_AVATAR_BG[selected.role] || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-bold`}>
              {selected.name.charAt(0)}
            </div>
            <span className="font-medium text-gray-900">{selected.name}</span>
          </>
        ) : (
          <span className="text-gray-400">Select staff...</span>
        )}
        <ChevronDown size={13} className={`text-gray-400 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1">
          {staffList.map((u) => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${value === u.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <div className={`w-7 h-7 rounded-full ${ROLE_AVATAR_BG[u.role] || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {u.name.charAt(0)}
              </div>
              <span className="font-medium text-gray-900">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function normalizeFirebaseUser(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email || 'User'
  const role = (Array.isArray(u.roles) && u.roles.length > 0) ? u.roles[0] : (u.role || 'Staff')
  return { ...u, id: u.uid || u.id, name, role }
}

// Derive which parts + staffList this user can access.
// "Supervisor" and "Stakeholder" are no longer user roles — they come from staffConfig assignments.
function useEvalAccess() {
  const { data, currentUser, selectedYear } = useApp()
  const { role } = useRBAC()
  const [firebaseUsers, setFirebaseUsers] = useState([])

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      setFirebaseUsers(users.map(normalizeFirebaseUser))
    })
    return unsub
  }, [])

  const allUsers = firebaseUsers.length > 0 ? firebaseUsers : data.users

  const yearConfigs = data.staffConfigs.filter((c) => c.year === selectedYear)

  // Staff this user supervises (assigned as supervisorId)
  const supervisedStaff = yearConfigs
    .filter((c) => c.supervisorId === currentUser.id)
    .map((c) => allUsers.find((u) => u.id === c.staffId))
    .filter(Boolean)

  // Staff this user is a stakeholder for
  const stakeholderStaff = yearConfigs
    .filter((c) => (c.stakeholderIds || []).includes(currentUser.id))
    .map((c) => allUsers.find((u) => u.id === c.staffId))
    .filter(Boolean)

  // Is this user themselves assigned as a staff member to be evaluated?
  const isAssignedAsStaff = yearConfigs.some((c) => c.staffId === currentUser.id)

  const isSupervisor = supervisedStaff.length > 0
  const isStakeholder = stakeholderStaff.length > 0

  let parts = []
  let staffList = []
  // evaluatorRole determines how Part4 saves the record
  let evaluatorRole = 'Staff'

  if (role === 'HR' || role === 'HRM') {
    // HR/HRM: Part 1 Competency + Part 2 Discipline สำหรับ staff ทั้งหมด
    parts = ['part1', 'part2']
    staffList = yearConfigs
      .map((c) => allUsers.find((u) => u.id === c.staffId))
      .filter(Boolean)
    evaluatorRole = 'HR'
  } else if (role === 'MasterAdmin') {
    parts = ['part1']
    staffList = yearConfigs
      .map((c) => allUsers.find((u) => u.id === c.staffId))
      .filter(Boolean)
    evaluatorRole = 'MD'
  } else if (role === 'MD' || role === 'GM') {
    // Exec read-only: part1 overview of all staff
    parts = ['part1']
    staffList = yearConfigs
      .map((c) => allUsers.find((u) => u.id === c.staffId))
      .filter(Boolean)
    evaluatorRole = 'MD'
  } else if (role === 'Staff') {
    // A Staff user may have multiple evaluation contexts:
    // 1) Self-assess (if assigned as staff in a config)
    // 2) Supervisor (if assigned as supervisorId for others)
    // 3) Stakeholder (if listed in stakeholderIds for others)
    // We expose all parts that apply; staffList = union of all relevant staff
    const partSet = new Set()
    const staffMap = new Map()

    partSet.add('part1')
    partSet.add('part2')
    partSet.add('part3')
    partSet.add('part4')
    staffMap.set(currentUser.id, currentUser)
    if (isSupervisor) {
      partSet.add('part1')
      partSet.add('part2')  // Supervisor ดูขาด/ลามาสายของลูกน้องได้แต่แก้ไขไม่ได้
      partSet.add('part3')
      partSet.add('part4')
      supervisedStaff.forEach((u) => staffMap.set(u.id, u))
    }
    if (isStakeholder) {
      partSet.add('part1')
      partSet.add('part4')
      stakeholderStaff.forEach((u) => staffMap.set(u.id, u))
    }
    parts = ['part1', 'part2', 'part3', 'part4'].filter((p) => partSet.has(p))
    staffList = [...staffMap.values()]
    evaluatorRole = 'Staff'
  }

  // Compute evaluatorRole string for a specific staffId context
  // Returns 'Supervisor' | 'Stakeholder' | 'Staff' | 'HR' | 'MD'
  const getEvaluatorRole = (staffId) => {
    if (role === 'MasterAdmin') return 'MD'
    if (role === 'HR' || role === 'HRM') return 'HR'
    if (role === 'MD' || role === 'GM') return 'MD'
    // Check if this user is supervisor for this specific staff
    const cfg = yearConfigs.find((c) => c.staffId === staffId)
    if (cfg?.supervisorId === currentUser.id) return 'Supervisor'
    if ((cfg?.stakeholderIds || []).includes(currentUser.id)) return 'Stakeholder'
    return 'Staff'
  }

  return { parts, staffList, role, evaluatorRole, isSupervisor, isStakeholder, isAssignedAsStaff, supervisedStaff, stakeholderStaff, getEvaluatorRole, allUsers, yearConfigs }
}

const PART_META = {
  part1: { label: 'Part 1 — Competency',       pts: '30 pts', icon: <User size={14} />,     color: 'indigo' },
  part2: { label: 'Part 2 — Discipline',        pts: '20 pts', icon: <Shield size={14} />,   color: 'green' },
  part3: { label: 'Part 3 — KPI',               pts: '30 pts', icon: <Target size={14} />,   color: 'blue' },
  part4: { label: 'Part 4 — Job Description',   pts: '20 pts', icon: <Briefcase size={14} />, color: 'purple' },
}

const PART_TAB_ACTIVE = {
  part1: 'bg-indigo-600 text-white border-indigo-600',
  part2: 'bg-green-600 text-white border-green-600',
  part3: 'bg-blue-600 text-white border-blue-600',
  part4: 'bg-purple-600 text-white border-purple-600',
}

export default function EvalPage() {
  const { selectedYear, activeQuarter, currentUser, data, getEvaluation, getEvaluationForPart } = useApp()
  const { role } = useRBAC()
  const { parts, staffList, isSupervisor, isStakeholder, supervisedStaff, stakeholderStaff, getEvaluatorRole, allUsers, yearConfigs } = useEvalAccess()

  const [activePart, setActivePart] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState('')
  const quarter = activeQuarter || 'Q1'

  const currentPart = activePart && parts.includes(activePart) ? activePart : (parts[0] ?? null)
  const hasScorableKpis = (staffId) =>
    (data.kpis || []).some((k) =>
      k.staffId === staffId && k.year === selectedYear && k.quarter === quarter && k.status === 'Accepted'
    )

  const getSetupReadiness = (staffId) => {
    const competencySet = Array.isArray(COMPETENCY_LIST) && COMPETENCY_LIST.length > 0

    const disciplineSet = !!getEvaluationForPart(selectedYear, quarter, staffId, 'part2')

    const quarterKpis = (data.kpis || []).filter(
      (k) => k.staffId === staffId && k.year === selectedYear && k.quarter === quarter
    )
    const kpiSetAndAcceptedAll3 =
      quarterKpis.length === 3 && quarterKpis.every((k) => k.status === 'Accepted')

    const staff =
      (allUsers || []).find((u) => u.id === staffId) ||
      (data.users || []).find((u) => u.id === staffId) ||
      null
    const jdAttachmentSet = !!staff?.jdUrl?.trim()

    const cfg = (yearConfigs || []).find((c) => c.staffId === staffId) || null
    const knownIds = new Set([...(allUsers || []).map((u) => u.id), ...(data.users || []).map((u) => u.id)])

    const supervisorId = cfg?.supervisorId || ''
    const supervisorSet =
      !!supervisorId &&
      supervisorId !== staffId &&
      knownIds.has(supervisorId)

    const stakeholderIds = Array.isArray(cfg?.stakeholderIds) ? cfg.stakeholderIds.filter(Boolean) : []
    const uniqueStakeholders = [...new Set(stakeholderIds)]
    const stakeholdersSet =
      stakeholderIds.length === 3 &&
      uniqueStakeholders.length === 3 &&
      uniqueStakeholders.every((id) => id && id !== staffId && id !== supervisorId && knownIds.has(id))

    const hasSupervisorAndStakeholdersReady = supervisorSet && stakeholdersSet

    const ready =
      competencySet &&
      disciplineSet &&
      kpiSetAndAcceptedAll3 &&
      jdAttachmentSet &&
      hasSupervisorAndStakeholdersReady

    return {
      ready,
      competencySet,
      disciplineSet,
      kpiSetAndAcceptedAll3,
      jdAttachmentSet,
      supervisorSet,
      stakeholdersSet,
      hasSupervisorAndStakeholdersReady,
    }
  }

  const getMissingSetupLabels = (staffId) => {
    const r = getSetupReadiness(staffId)
    const missing = []
    if (!r.competencySet) missing.push('Competency')
    if (!r.disciplineSet) missing.push('Discipline')
    if (!r.kpiSetAndAcceptedAll3) missing.push('KPI')
    if (!r.jdAttachmentSet) missing.push('Job Description')
    if (!r.hasSupervisorAndStakeholdersReady) missing.push('Sup, Stake')
    return missing
  }

  const canOpenCard = (staffId) => {
    if (role !== 'Staff') return true
    return getSetupReadiness(staffId).ready
  }

  const getCardStatus = (staffId) => {
    const ctxRole = getEvaluatorRole(staffId)
    if (ctxRole === 'MD') {
      const hasAny = (data.quarterlyEvaluations || []).some(
        (e) => e.staffId === staffId && e.year === selectedYear && e.quarter === quarter
      )
      return { label: hasAny ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน', tone: hasAny ? 'done' : 'todo' }
    }

    const needsPart3 = hasScorableKpis(staffId)
    const checks = []
    if (ctxRole === 'HR') {
      checks.push({ part: 'part1', evaluatorId: currentUser.id })
      checks.push({ part: 'part2', evaluatorId: currentUser.id })
    } else if (ctxRole === 'Supervisor') {
      checks.push({ part: 'part1', evaluatorId: currentUser.id })
      if (needsPart3) checks.push({ part: 'part3_sup', evaluatorId: currentUser.id })
      checks.push({ part: 'part4', evaluatorId: currentUser.id })
    } else if (ctxRole === 'Stakeholder') {
      checks.push({ part: 'part1', evaluatorId: currentUser.id })
      checks.push({ part: 'part4', evaluatorId: currentUser.id })
    } else {
      checks.push({ part: 'part1', evaluatorId: currentUser.id })
      if (needsPart3) checks.push({ part: 'part3_staff', evaluatorId: staffId })
      checks.push({ part: 'part4', evaluatorId: currentUser.id })
    }

    const isDone = checks.every((c) => !!getEvaluation(selectedYear, quarter, staffId, c.evaluatorId, c.part))
    return { label: isDone ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน', tone: isDone ? 'done' : 'todo' }
  }
  const selfCardStatus = canOpenCard(currentUser.id)
    ? getCardStatus(currentUser.id)
    : { label: 'ยังไม่พร้อม', detail: `ขาด: ${getMissingSetupLabels(currentUser.id).join(', ')}`, tone: 'notReady' }

  // Access = has at least one part to show
  if (parts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-gray-50 p-4 rounded-2xl mb-4">
          <ShieldOff size={32} className="text-gray-300" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">ไม่มีสิทธิ์เข้าถึงการประเมิน</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          บทบาทปัจจุบันของคุณไม่มีสิทธิ์ใช้งานหน้าประเมินผล หากคุณเป็นพนักงาน กรุณาติดต่อ HR เพื่อกำหนด Supervisor ใน Admin → Hierarchy
        </p>
      </div>
    )
  }

  // Determine effective staffId
  const effectiveStaffId = selectedStaff

  const renderSectionContent = () => {
    if (!effectiveStaffId) {
      return (
        <>
          {/* Quarter Selector - Top Right */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quarter</p>
                <span className="inline-flex px-4 py-1.5 rounded-lg border text-sm font-semibold bg-indigo-600 text-white border-indigo-600">
                  {quarter}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium">Year:</span>
                <span className="font-bold text-indigo-600">{selectedYear}</span>
              </div>
            </div>
          </div>

          {/* Self-Assessment Section */}
          {role === 'Staff' && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100">
                  <User size={16} className="text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">ประเมินตนเอง</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StaffMiniCard
                  user={currentUser}
                  isSelected={false}
                  statusLabel={selfCardStatus.label}
                  statusDetail={selfCardStatus.detail}
                  statusTone={selfCardStatus.tone}
                  onClick={canOpenCard(currentUser.id) ? () => setSelectedStaff(currentUser.id) : null}
                />
              </div>
            </div>
          )}

          {/* Supervised Staff Section */}
          {isSupervisor && supervisedStaff.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100">
                  <Users size={16} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">ประเมินผู้ใต้บังคับบัญชา</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {supervisedStaff.map((u) => {
                  const s = canOpenCard(u.id)
                    ? getCardStatus(u.id)
                    : { label: 'ยังไม่พร้อม', detail: `ขาด: ${getMissingSetupLabels(u.id).join(', ')}`, tone: 'notReady' }
                  return (
                    <StaffMiniCard
                      key={u.id}
                      user={u}
                      isSelected={false}
                      statusLabel={s.label}
                      statusDetail={s.detail}
                      statusTone={s.tone}
                      onClick={canOpenCard(u.id) ? () => setSelectedStaff(u.id) : null}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Stakeholder Staff Section */}
          {isStakeholder && stakeholderStaff.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100">
                  <Briefcase size={16} className="text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">ประเมินผู้ที่มีส่วนร่วมการทำงาน</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {stakeholderStaff.map((u) => {
                  const s = canOpenCard(u.id)
                    ? getCardStatus(u.id)
                    : { label: 'ยังไม่พร้อม', detail: `ขาด: ${getMissingSetupLabels(u.id).join(', ')}`, tone: 'notReady' }
                  return (
                    <StaffMiniCard
                      key={u.id}
                      user={u}
                      isSelected={false}
                      statusLabel={s.label}
                      statusDetail={s.detail}
                      statusTone={s.tone}
                      onClick={canOpenCard(u.id) ? () => setSelectedStaff(u.id) : null}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {role === 'MasterAdmin' && staffList.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                  <Users size={16} className="text-gray-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">พนักงานทั้งหมด</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {staffList.map((u) => {
                  const s = getCardStatus(u.id)
                  return (
                    <StaffMiniCard
                      key={u.id}
                      user={u}
                      isSelected={false}
                      statusLabel={s.label}
                      statusTone={s.tone}
                      onClick={() => setSelectedStaff(u.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </>
      )
    }

    const selectedStaffObj = supervisedStaff.find(s => s.id === effectiveStaffId) ||
      stakeholderStaff.find(s => s.id === effectiveStaffId) ||
      (role === 'Staff' && currentUser.id === effectiveStaffId ? currentUser : null) ||
      (role === 'MasterAdmin' ? staffList.find((s) => s.id === effectiveStaffId) : null)

    return (
      <>
        {/* Back Button & Quarter Selector */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedStaff('')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all"
          >
            ← กลับ
          </button>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quarter</p>
              <span className="inline-flex px-4 py-1.5 rounded-lg border text-sm font-semibold bg-indigo-600 text-white border-indigo-600">
                {quarter}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium">Year:</span>
              <span className="font-bold text-indigo-600">{selectedYear}</span>
            </div>
          </div>
        </div>

        {/* Selected Staff Card */}
        {selectedStaffObj && (
          <div className="mb-6 p-4 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center gap-4">
            {selectedStaffObj?.photoURL ? (
              <img
                src={selectedStaffObj.photoURL}
                alt=""
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow shrink-0"
              />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${ROLE_AVATAR_BG[selectedStaffObj?.role] || 'bg-indigo-500'}`}>
                {(() => {
                  if (selectedStaffObj?.firstName && selectedStaffObj?.lastName)
                    return (selectedStaffObj.firstName[0] + selectedStaffObj.lastName[0]).toUpperCase()
                  const n = selectedStaffObj?.name || ''
                  const parts = n.trim().split(/\s+/)
                  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                  return (n[0] || '?').toUpperCase()
                })()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {[selectedStaffObj?.firstName, selectedStaffObj?.lastName].filter(Boolean).join(' ') || selectedStaffObj?.name || selectedStaffObj?.email || 'User'}
              </p>
              <p className="text-xs text-gray-500">
                {Array.isArray(selectedStaffObj?.positions) && selectedStaffObj.positions.includes('Supervisor') ? 'Supervisor' : 'Staff'}
              </p>
            </div>
          </div>
        )}

        {role === 'MasterAdmin' && selectedStaffObj && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">สรุปคะแนน</p>
                <p className="text-sm font-semibold text-gray-900">{selectedYear} · {quarter}</p>
              </div>
              {(() => {
                const s = getQuarterScores(data, effectiveStaffId, selectedYear, quarter)
                const total = s?.total ?? null
                return (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-2xl font-extrabold text-indigo-600">{total ?? '—'} <span className="text-xs font-semibold text-gray-400">/ 100</span></p>
                  </div>
                )
              })()}
            </div>

            {(() => {
              const s = getQuarterScores(data, effectiveStaffId, selectedYear, quarter)
              const row = (label, val, max, cls) => (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <span className={`text-xs font-bold ${cls}`}>{val ?? '—'}{val != null ? ` / ${max}` : ''}</span>
                </div>
              )
              return (
                <div className="mt-4 divide-y divide-gray-100">
                  {row('Part 1 — Competency', s?.part1 ?? null, 30, 'text-indigo-600')}
                  {row('Part 2 — Discipline', s?.part2 ?? null, 20, 'text-green-600')}
                  {row('Part 3 — KPI', s?.part3 ?? null, 30, 'text-blue-600')}
                  {row('Part 4 — Job Description', s?.part4 ?? null, 20, 'text-purple-600')}
                </div>
              )
            })()}

            {(() => {
              const evals = (data.quarterlyEvaluations || []).filter(
                (e) => e.staffId === effectiveStaffId && e.year === selectedYear && e.quarter === quarter
              )
              if (evals.length === 0) {
                return <p className="mt-4 text-xs text-gray-400">ยังไม่มีข้อมูลการประเมินใน Quarter นี้</p>
              }
              const part1 = evals.filter((e) => e.part === 'part1')
              const part2 = evals.filter((e) => e.part === 'part2')
              const part3 = evals.filter((e) => e.part === 'part3_staff' || e.part === 'part3_sup')
              const part4 = evals.filter((e) => e.part === 'part4')
              const section = (title, items) => (
                <div className="mt-5">
                  <p className="text-xs font-bold text-gray-700 mb-2">{title}</p>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400">—</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((e) => (
                        <div key={e.id || `${e.part}_${e.evaluatorRole}_${e.evaluatorId}`} className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-gray-800">{e.evaluatorRole || '—'}</span>
                            <span className="text-xs font-bold text-gray-700">{e.scaledScore ?? e.rawTotal ?? e.score ?? '—'}</span>
                          </div>
                          {e.comment && <p className="text-xs text-gray-500 mt-1">{e.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
              return (
                <>
                  {section('รายละเอียด Part 1', part1)}
                  {section('รายละเอียด Part 2', part2)}
                  {section('รายละเอียด Part 3', part3)}
                  {section('รายละเอียด Part 4', part4)}
                </>
              )
            })()}
          </div>
        )}

        {role === 'MasterAdmin' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-semibold text-gray-900">ดูรายละเอียดคะแนนได้จากสรุปด้านบน</p>
            <p className="text-xs text-gray-500 mt-1">Role MasterAdmin เป็นโหมดดูคะแนน (read-only) เพื่อหลีกเลี่ยงการบันทึกทับข้อมูลการประเมิน</p>
          </div>
        )}

        {/* Part Tabs */}
        {role !== 'MasterAdmin' && parts.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {parts.map((p) => {
              const meta = PART_META[p]
              const isActive = currentPart === p
              return (
                <button
                  key={p}
                  onClick={() => setActivePart(p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    isActive ? PART_TAB_ACTIVE[p] : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {meta.icon}
                  {meta.label}
                  <span className={`text-xs font-bold ml-1 ${isActive ? 'opacity-80' : 'text-gray-400'}`}>
                    {meta.pts}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Single part label when only one */}
        {role !== 'MasterAdmin' && parts.length === 1 && (
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${PART_TAB_ACTIVE[parts[0]]}`}>
              {PART_META[parts[0]]?.icon}
              {PART_META[parts[0]]?.label}
              <span className="text-xs font-bold opacity-80 ml-1">{PART_META[parts[0]]?.pts}</span>
            </div>
          </div>
        )}

        {/* Part Content */}
        {role !== 'MasterAdmin' && (() => {
          const ctxRole = getEvaluatorRole(effectiveStaffId)
          const isSupervisorForStaff = ctxRole === 'Supervisor'
          const canSeeKpi = isSupervisorForStaff || (ctxRole === 'Staff' && effectiveStaffId === currentUser.id)
          return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              {currentPart === 'part1' && (
                <Part1Competency
                  staffId={effectiveStaffId}
                  quarter={quarter}
                  year={selectedYear}
                  evaluatorRole={ctxRole}
                />
              )}
              {currentPart === 'part2' && (
                <Part2Discipline
                  staffId={effectiveStaffId}
                  quarter={quarter}
                  year={selectedYear}
                />
              )}
              {currentPart === 'part3' && canSeeKpi && (
                <Part3KpiEval
                  staffId={effectiveStaffId}
                  quarter={quarter}
                  year={selectedYear}
                  evaluatorRole={ctxRole}
                  isSupervisor={isSupervisorForStaff}
                />
              )}
              {currentPart === 'part3' && !canSeeKpi && (
                <div className="py-10 text-center">
                  <Target size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 font-medium">Part 3 — KPI: ไม่สามารถเข้าถึงในบริบทนี้</p>
                </div>
              )}
              {currentPart === 'part4' && (
                <Part4JobDescription
                  staffId={effectiveStaffId}
                  quarter={quarter}
                  year={selectedYear}
                  evaluatorRole={ctxRole}
                />
              )}
            </div>
          )
        })()}
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl">
            <ClipboardList size={22} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evaluation Forms</h1>
            <p className="text-gray-500 text-sm mt-0.5">Parts 1, 2, 3 &amp; 4 — Competency, Discipline, KPI, Job Description</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[role]}`}>
          {role}
        </span>
      </div>

      {/* No access message */}
      {parts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-gray-50 p-4 rounded-2xl mb-4">
            <ShieldOff size={32} className="text-gray-300" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">ไม่มีสิทธิ์เข้าถึงการประเมิน</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            บทบาทปัจจุบันของคุณไม่มีสิทธิ์ใช้งานหน้าประเมินผล หากคุณเป็นพนักงาน กรุณาติดต่อ HR เพื่อกำหนด Supervisor ใน Admin → Hierarchy
          </p>
        </div>
      ) : (
        renderSectionContent()
      )}
    </div>
  )
}
