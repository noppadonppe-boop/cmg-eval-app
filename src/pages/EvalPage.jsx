import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import useRBAC, { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../hooks/useRBAC'
import { subscribeAllUsers } from '../services/authService'
import Part1Competency, { COMPETENCY_LIST } from '../components/eval/Part1Competency'
import Part2Acknowledgment from '../components/eval/Part2Acknowledgment'
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

  const supervisedStaff = yearConfigs
    .filter((c) => c.supervisorId === currentUser.id)
    .map((c) => allUsers.find((u) => u.id === c.staffId))
    .filter(Boolean)

  const stakeholderStaff = yearConfigs
    .filter((c) => (c.stakeholderIds || []).includes(currentUser.id))
    .map((c) => allUsers.find((u) => u.id === c.staffId))
    .filter(Boolean)

  const isAssignedAsStaff = yearConfigs.some((c) => c.staffId === currentUser.id)
  const isSupervisor = supervisedStaff.length > 0
  const isStakeholder = stakeholderStaff.length > 0
  const hasAllStaffAccess = ['MasterAdmin', 'HR', 'HRM', 'MD', 'GM'].includes(role)

  const allStaffList = hasAllStaffAccess
    ? yearConfigs.map((c) => allUsers.find((u) => u.id === c.staffId)).filter(Boolean)
    : []

  const partSet = new Set()
  if (isAssignedAsStaff) {
    partSet.add('part1'); partSet.add('part2'); partSet.add('part3'); partSet.add('part4')
  }
  if (isSupervisor) {
    partSet.add('part1'); partSet.add('part2'); partSet.add('part3'); partSet.add('part4')
  }
  if (isStakeholder) {
    partSet.add('part1'); partSet.add('part4')
  }
  if (hasAllStaffAccess) {
    partSet.add('part1');
    if (['HR', 'HRM'].includes(role)) partSet.add('part2')
  }

  const parts = ['part1', 'part2', 'part3', 'part4'].filter((p) => partSet.has(p))

  const getEvaluatorRole = (staffId) => {
    const cfg = yearConfigs.find((c) => c.staffId === staffId)
    // Always check contextual relationship first!
    if (cfg?.supervisorId === currentUser.id) return 'Supervisor'
    if ((cfg?.stakeholderIds || []).includes(currentUser.id)) return 'Stakeholder'
    if (staffId === currentUser.id) return 'Staff'
    
    // If no direct relationship, fallback to global role
    if (role === 'MasterAdmin') return 'MD'
    if (role === 'HR' || role === 'HRM') return 'HR'
    if (role === 'MD' || role === 'GM') return 'MD'
    
    return 'Staff'
  }

  return { parts, role, isSupervisor, isStakeholder, isAssignedAsStaff, supervisedStaff, stakeholderStaff, allStaffList, hasAllStaffAccess, getEvaluatorRole, allUsers, yearConfigs }
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
  const { role: rawRole } = useRBAC() // not used directly for rendering rules anymore to prevent overriding contextual mode
  const { parts, role, isSupervisor, isStakeholder, isAssignedAsStaff, supervisedStaff, stakeholderStaff, allStaffList, hasAllStaffAccess, getEvaluatorRole, allUsers, yearConfigs } = useEvalAccess()

  const [activePart, setActivePart] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [viewMode, setViewMode] = useState('evaluate') // 'evaluate' | 'summary'
  const [evaluatorContext, setEvaluatorContext] = useState(null)
  const quarter = activeQuarter || 'Q1'

  const currentPart = activePart && parts.includes(activePart) ? activePart : (parts[0] ?? null)
  
  // Filter parts based on evaluator context
  const availableParts = evaluatorContext === 'stakeholder' 
    ? parts.filter(p => p === 'part1' || p === 'part4')  // Stakeholder only sees Part 1 and Part 4
    : parts
  
  const currentFilteredPart = activePart && availableParts.includes(activePart) ? activePart : (availableParts[0] ?? null)
  
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
    const kpiSetAndAcceptedAll3 = quarterKpis.length === 3 && quarterKpis.every((k) => k.status === 'Accepted')

    const staff = (allUsers || []).find((u) => u.id === staffId) || (data.users || []).find((u) => u.id === staffId) || null
    const jdAttachmentSet = !!staff?.jdUrl?.trim()

    const cfg = (yearConfigs || []).find((c) => c.staffId === staffId) || null
    const knownIds = new Set([...(allUsers || []).map((u) => u.id), ...(data.users || []).map((u) => u.id)])

    const supervisorId = cfg?.supervisorId || ''
    const supervisorSet = !!supervisorId && supervisorId !== staffId && knownIds.has(supervisorId)

    const stakeholderIds = Array.isArray(cfg?.stakeholderIds) ? cfg.stakeholderIds.filter(Boolean) : []
    const uniqueStakeholders = [...new Set(stakeholderIds)]
    const stakeholdersSet = stakeholderIds.length === 3 && uniqueStakeholders.length === 3 && uniqueStakeholders.every((id) => id && id !== staffId && knownIds.has(id))

    const hasSupervisorAndStakeholdersReady = supervisorSet && stakeholdersSet

    const ready = competencySet && disciplineSet && kpiSetAndAcceptedAll3 && jdAttachmentSet && hasSupervisorAndStakeholdersReady

    return { ready, competencySet, disciplineSet, kpiSetAndAcceptedAll3, jdAttachmentSet, supervisorSet, stakeholdersSet, hasSupervisorAndStakeholdersReady }
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

  const canOpenCard = (staffId) => getSetupReadiness(staffId).ready

  const hasPartEvaluation = (staffId, part, evaluatorId = null, evaluatorRole = null) => {
    const rows = (data.quarterlyEvaluations || []).filter(
      (e) => e.staffId === staffId && e.year === selectedYear && e.quarter === quarter && e.part === part
    )
    if (evaluatorId != null) {
      return rows.some((e) => e.evaluatorId === evaluatorId && (evaluatorRole ? e.evaluatorRole === evaluatorRole : true))
    }
    return rows.length > 0
  }

  const getCardStatus = (staffId, contextMode, evaluatorContext = null) => {
    const isSummaryContext = contextMode === 'summary'
    
    // For summary or all-staff access, check if all 4 parts have evaluations
    if (isSummaryContext || (hasAllStaffAccess && !isSupervisor && !isStakeholder && !isAssignedAsStaff)) {
      const part1Done = (data.quarterlyEvaluations || []).some(
        (e) => e.staffId === staffId && e.year === selectedYear && e.quarter === quarter && e.part === 'part1'
      )
      const part2Done = (data.quarterlyEvaluations || []).some(
        (e) => e.staffId === staffId && e.year === selectedYear && e.quarter === quarter && e.part === 'part2'
      )
      const part3Done = (data.quarterlyEvaluations || []).some(
        (e) => e.staffId === staffId && e.year === selectedYear && e.quarter === quarter && (e.part === 'part3_staff' || e.part === 'part3_sup')
      )
      const part4Done = (data.quarterlyEvaluations || []).some(
        (e) => e.staffId === staffId && e.year === selectedYear && e.quarter === quarter && e.part === 'part4'
      )
      const allDone = part1Done && part2Done && part3Done && part4Done
      return { label: allDone ? 'ประเมินครบแล้ว (4/4)' : 'ยังไม่ประเมินครบ', tone: allDone ? 'done' : 'todo' }
    }

    const ctxRole = evaluatorContext === 'stakeholder'
      ? 'Stakeholder'
      : evaluatorContext === 'supervisor'
        ? 'Supervisor'
        : getEvaluatorRole(staffId)

    const part1Done = hasPartEvaluation(staffId, 'part1', currentUser.id, ctxRole)
    const part2Done = hasPartEvaluation(staffId, 'part2')
    const part3Done = evaluatorContext === 'stakeholder'
      ? true
      : (ctxRole === 'Staff'
        ? hasPartEvaluation(staffId, 'part3_staff', staffId, 'Staff')
        : hasPartEvaluation(staffId, 'part3_sup', currentUser.id, 'Supervisor'))
    const part4Done = hasPartEvaluation(staffId, 'part4', currentUser.id, ctxRole)

    const completedChecks = [part1Done, part2Done, part3Done, part4Done].filter(Boolean).length
    const totalChecks = 4
    const isDone = completedChecks >= totalChecks
    
    return { 
      label: isDone ? 'ประเมินครบแล้ว' : `ประเมินแล้ว (${completedChecks}/${totalChecks})`, 
      tone: isDone ? 'done' : 'todo' 
    }
  }

  const handleCardClick = (staffId, mode, context = null) => {
    if (mode === 'evaluate' && !canOpenCard(staffId)) return
    setSelectedStaff(staffId)
    setViewMode(mode)
    setEvaluatorContext(context) // Store evaluator context
  }

  if (parts.length === 0 && !hasAllStaffAccess) {
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

  const effectiveStaffId = selectedStaff

  const renderSectionContent = () => {
    if (!effectiveStaffId) {
      return (
        <>
          <div className="flex items-center justify-between mb-4 sm:mb-8">
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

          <div className="flex flex-col xl:flex-row gap-4 sm:gap-8 mb-8 sm:mb-12">
            {isAssignedAsStaff && (
              <div className="w-full xl:w-56 shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100">
                    <User size={16} className="text-indigo-600" />
                  </div>
                  <h2 className="text-base sm:text-xl font-bold text-gray-900">ประเมินตนเอง</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-1 gap-3">
                  {(() => {
                    const s = canOpenCard(currentUser.id)
                      ? getCardStatus(currentUser.id, 'evaluate')
                      : { label: 'ยังไม่พร้อม', detail: `ขาด: ${getMissingSetupLabels(currentUser.id).join(', ')}`, tone: 'notReady' }
                    return (
                      <StaffMiniCard
                        key={currentUser.id}
                        user={currentUser}
                        isSelected={false}
                        statusLabel={s.label}
                        statusDetail={s.detail}
                        statusTone={s.tone}
                        onClick={canOpenCard(currentUser.id) ? () => handleCardClick(currentUser.id, 'evaluate') : null}
                      />
                    )
                  })()}
                </div>
              </div>
            )}

            {isAssignedAsStaff && isSupervisor && supervisedStaff.length > 0 && (
              <div className="hidden xl:block w-px self-stretch bg-gray-200"></div>
            )}

            {isSupervisor && supervisedStaff.length > 0 && (
              <div className="flex-1 w-full min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100">
                    <Users size={16} className="text-green-600" />
                  </div>
                  <h2 className="text-base sm:text-xl font-bold text-gray-900">ประเมินผู้ใต้บังคับบัญชา</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
                  {supervisedStaff.map((u) => {
                    const s = canOpenCard(u.id)
                      ? getCardStatus(u.id, 'evaluate', 'supervisor')
                      : { label: 'ยังไม่พร้อม', detail: `ขาด: ${getMissingSetupLabels(u.id).join(', ')}`, tone: 'notReady' }
                    return (
                      <StaffMiniCard
                        key={u.id}
                        user={u}
                        isSelected={false}
                        statusLabel={s.label}
                        statusDetail={s.detail}
                        statusTone={s.tone}
                        contextRole="ลูกน้อง"
                        onClick={canOpenCard(u.id) ? () => handleCardClick(u.id, 'evaluate', 'supervisor') : null}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {isStakeholder && stakeholderStaff.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100">
                  <Briefcase size={16} className="text-purple-600" />
                </div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900">ประเมินผู้ที่มีส่วนร่วมการทำงาน</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {stakeholderStaff.map((u) => {
                  const s = canOpenCard(u.id)
                    ? getCardStatus(u.id, 'evaluate', 'stakeholder')
                    : { label: 'ยังไม่พร้อม', detail: `ขาด: ${getMissingSetupLabels(u.id).join(', ')}`, tone: 'notReady' }
                  return (
                    <StaffMiniCard
                      key={u.id}
                      user={u}
                      isSelected={false}
                      statusLabel={s.label}
                      statusDetail={s.detail}
                      statusTone={s.tone}
                      contextRole="Stakeholder"
                      onClick={canOpenCard(u.id) ? () => handleCardClick(u.id, 'evaluate', 'stakeholder') : null}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {hasAllStaffAccess && allStaffList.length > 0 && (
            <div className="mb-12 border-t pt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                  <Users size={16} className="text-gray-700" />
                </div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                  พนักงานทั้งหมด 
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] sm:text-xs font-semibold">สรุปคะแนน</span>
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {(() => {
                  const listWithScores = allStaffList.map((u) => {
                    const s = getCardStatus(u.id, 'summary')
                    const scores = getQuarterScores(data, u.id, selectedYear, quarter)
                    return { u, s, total: scores?.total ?? null }
                  })

                  listWithScores.sort((a, b) => {
                    const scoreA = a.total ?? -1
                    const scoreB = b.total ?? -1
                    return scoreB - scoreA
                  })

                  return listWithScores.map(({ u, s, total }) => (
                    <StaffMiniCard
                      key={u.id}
                      user={u}
                      isSelected={false}
                      statusLabel={s.label}
                      statusTone={s.tone}
                      isSummaryCard={true}
                      summaryScore={total}
                      onClick={() => handleCardClick(u.id, 'summary')}
                    />
                  ))
                })()}
              </div>
            </div>
          )}
        </>
      )
    }

    const selectedStaffObj = allUsers.find(s => s.id === effectiveStaffId)

    return (
      <>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={() => setSelectedStaff('')}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs sm:text-sm font-medium text-gray-700 transition-all"
          >
            ← กลับ
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
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

        {selectedStaffObj && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-indigo-50 border border-indigo-200 flex flex-wrap items-center gap-3 sm:gap-4">
            {selectedStaffObj?.photoURL ? (
              <img
                src={selectedStaffObj.photoURL}
                alt=""
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-white shadow shrink-0"
              />
            ) : (
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0 ${ROLE_AVATAR_BG[selectedStaffObj?.role] || 'bg-indigo-500'}`}>
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
            {viewMode === 'summary' && (
              <div className="ml-auto px-2 sm:px-3 py-1 bg-white border border-gray-200 text-gray-700 text-[10px] sm:text-xs rounded-full font-bold shadow-sm">
                โหมดดูสรุปคะแนน
              </div>
            )}
            {viewMode === 'evaluate' && (
              <div className="ml-auto px-2 sm:px-3 py-1 bg-indigo-600 text-white text-[10px] sm:text-xs rounded-full font-bold shadow-sm">
                โหมดการประเมิน
              </div>
            )}
          </div>
        )}

        {viewMode === 'summary' ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">สรุปคะแนนรอบการประเมินนี้</p>
                <p className="text-sm font-semibold text-gray-900">{selectedYear} · {quarter}</p>
              </div>
              {(() => {
                const s = getQuarterScores(data, effectiveStaffId, selectedYear, quarter)
                const total = s?.total ?? null
                return (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Total Score</p>
                    <p className="text-2xl font-extrabold text-indigo-600">{total ?? '—'} <span className="text-xs font-semibold text-gray-400">/ 100</span></p>
                  </div>
                )
              })()}
            </div>

            {(() => {
              const s = getQuarterScores(data, effectiveStaffId, selectedYear, quarter)
              const row = (label, val, max, cls) => (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <span className={`text-sm font-bold ${cls}`}>{val ?? '—'}{val != null ? ` / ${max}` : ''}</span>
                </div>
              )
              return (
                <div className="mt-4 divide-y divide-gray-100 bg-gray-50 p-4 rounded-xl border border-gray-100">
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
                return <p className="mt-6 text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">ยังไม่มีข้อมูลการประเมินแบบแยกส่วนใน Quarter นี้</p>
              }
              const part1 = evals.filter((e) => e.part === 'part1')
              const part2 = evals.filter((e) => e.part === 'part2')
              const part3 = evals.filter((e) => e.part === 'part3_staff' || e.part === 'part3_sup')
              const part4 = evals.filter((e) => e.part === 'part4')
              const section = (title, items) => (
                <div className="mt-6">
                  <p className="text-sm font-bold text-gray-800 mb-3">{title}</p>
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">ยังไม่มีใครประเมินส่วนนี้</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map((e) => (
                        <div key={e.id || `${e.part}_${e.evaluatorRole}_${e.evaluatorId}`} className="px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">ผู้ประเมิน: {e.evaluatorRole || '—'}</span>
                            <span className="text-sm font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{e.scaledScore ?? e.rawTotal ?? e.score ?? '—'}</span>
                          </div>
                          {e.comment && <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded-lg mt-2 font-medium">"{e.comment}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
              return (
                <div className="mt-8 border-t pt-2">
                  <h3 className="text-base font-bold text-gray-900 mb-2">รายละเอียดคะแนนแต่ละคน</h3>
                  {section('Part 1 — ความสามารถ (Competency)', part1)}
                  {section('Part 2 — วินัยการทำงาน (Discipline)', part2)}
                  {section('Part 3 — ผลงาน (KPI)', part3)}
                  {section('Part 4 — ลักษณะงาน (Job Description)', part4)}
                </div>
              )
            })()}
          </div>
        ) : (
          <>
            {availableParts.length > 1 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {availableParts.map((p) => {
                  const meta = PART_META[p]
                  const isActive = currentFilteredPart === p
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
            
            {availableParts.length === 1 && (
              <div className="flex items-center gap-2 mb-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${PART_TAB_ACTIVE[availableParts[0]]}`}>
                  {PART_META[availableParts[0]]?.icon}
                  {PART_META[availableParts[0]]?.label}
                  <span className="text-xs font-bold opacity-80 ml-1">{PART_META[availableParts[0]]?.pts}</span>
                </div>
              </div>
            )}

            {(() => {
              // Use evaluatorContext if available, otherwise fallback to getEvaluatorRole
              const ctxRole = evaluatorContext === 'stakeholder' ? 'Stakeholder' : 
                             evaluatorContext === 'supervisor' ? 'Supervisor' : 
                             getEvaluatorRole(effectiveStaffId)
              const isSupervisorForStaff = ctxRole === 'Supervisor'
              // HR shouldn't edit KPI directly unless they are the supervisor.
              const canSeeKpi = isSupervisorForStaff || (ctxRole === 'Staff' && effectiveStaffId === currentUser.id)
              
              // Navigation callbacks for auto-flow
              const goToPart2 = () => {
                if (evaluatorContext === 'stakeholder') {
                  setActivePart('part4') // Skip to Part 4 for Stakeholder
                } else {
                  setActivePart('part2')
                }
              }
              const goToPart3 = () => setActivePart('part3')
              const goToPart4 = () => setActivePart('part4')
              const finishEvaluation = () => {
                setSelectedStaff('')
                setActivePart(null)
                setEvaluatorContext(null) // Clear context when finishing
              }
              
              return (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  {currentFilteredPart === 'part1' && (
                    <Part1Competency
                      key={`part1-${effectiveStaffId}-${quarter}-${selectedYear}-${ctxRole}`}
                      staffId={effectiveStaffId}
                      quarter={quarter}
                      year={selectedYear}
                      evaluatorRole={ctxRole}
                      evaluatorContext={evaluatorContext}
                      onComplete={goToPart2}
                    />
                  )}
                  {currentFilteredPart === 'part2' && (
                    <Part2Acknowledgment
                      key={`part2-${effectiveStaffId}-${quarter}-${selectedYear}-${ctxRole}`}
                      staffId={effectiveStaffId}
                      quarter={quarter}
                      year={selectedYear}
                      evaluatorRole={ctxRole}
                      onComplete={goToPart3}
                    />
                  )}
                  {currentFilteredPart === 'part3' && canSeeKpi && (
                    <Part3KpiEval
                      key={`part3-${effectiveStaffId}-${quarter}-${selectedYear}-${isSupervisorForStaff ? 'sup' : 'staff'}`}
                      staffId={effectiveStaffId}
                      quarter={quarter}
                      year={selectedYear}
                      evaluatorRole={ctxRole}
                      isSupervisor={isSupervisorForStaff}
                      onComplete={goToPart4}
                    />
                  )}
                  {currentFilteredPart === 'part3' && !canSeeKpi && (
                    <div className="py-10 text-center">
                      <Target size={32} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 font-medium">Part 3 — KPI: ไม่สามารถเข้าถึงในบริบทนี้</p>
                    </div>
                  )}
                  {currentFilteredPart === 'part4' && (
                    <Part4JobDescription
                      key={`part4-${effectiveStaffId}-${quarter}-${selectedYear}-${ctxRole}`}
                      staffId={effectiveStaffId}
                      staff={selectedStaffObj}
                      quarter={quarter}
                      year={selectedYear}
                      evaluatorRole={ctxRole}
                      evaluatorContext={evaluatorContext}
                      onComplete={finishEvaluation}
                    />
                  )}
                </div>
              )
            })()}
          </>
        )}
      </>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl">
            <ClipboardList size={22} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Evaluation Forms</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 hidden sm:block">Parts 1, 2, 3 &amp; 4 — Competency, Discipline, KPI, Job Description</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[role]}`}>
          {role}
        </span>
      </div>

      {parts.length === 0 && !hasAllStaffAccess ? (
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
