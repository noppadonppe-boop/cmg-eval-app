import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import useRBAC, { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../hooks/useRBAC'
import Part1Competency from '../components/eval/Part1Competency'
import Part2Discipline from '../components/eval/Part2Discipline'
import Part3KpiEval from '../components/eval/Part3KpiEval'
import Part4JobDescription from '../components/eval/Part4JobDescription'
import { ClipboardList, User, Users, Briefcase, Shield, Target, ChevronDown, ShieldOff } from 'lucide-react'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

function QuarterSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {QUARTERS.map((q) => (
        <button
          key={q}
          onClick={() => onChange(q)}
          className={`px-4 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
            value === q
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
          }`}
        >
          {q}
        </button>
      ))}
    </div>
  )
}

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

// Derive which parts + staffList this user can access.
// "Supervisor" and "Stakeholder" are no longer user roles — they come from staffConfig assignments.
function useEvalAccess() {
  const { data, currentUser, selectedYear } = useApp()
  const { role } = useRBAC()

  const yearConfigs = data.staffConfigs.filter((c) => c.year === selectedYear)

  // Staff this user supervises (assigned as supervisorId)
  const supervisedStaff = yearConfigs
    .filter((c) => c.supervisorId === currentUser.id)
    .map((c) => data.users.find((u) => u.id === c.staffId))
    .filter(Boolean)

  // Staff this user is a stakeholder for
  const stakeholderStaff = yearConfigs
    .filter((c) => (c.stakeholderIds || []).includes(currentUser.id))
    .map((c) => data.users.find((u) => u.id === c.staffId))
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
      .map((c) => data.users.find((u) => u.id === c.staffId))
      .filter(Boolean)
    evaluatorRole = 'HR'
  } else if (role === 'MD' || role === 'GM') {
    // Exec read-only: part1 overview of all staff
    parts = ['part1']
    staffList = yearConfigs
      .map((c) => data.users.find((u) => u.id === c.staffId))
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

    if (isAssignedAsStaff) {
      partSet.add('part1')
      partSet.add('part2')  // Staff ดูขาด/ลามาสาย (ที่ HR กรอก) ได้แต่แก้ไขไม่ได้
      partSet.add('part3')
      partSet.add('part4')
      staffMap.set(currentUser.id, currentUser)
    }
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
    if (role === 'HR' || role === 'HRM') return 'HR'
    if (role === 'MD' || role === 'GM') return 'MD'
    // Check if this user is supervisor for this specific staff
    const cfg = yearConfigs.find((c) => c.staffId === staffId)
    if (cfg?.supervisorId === currentUser.id) return 'Supervisor'
    if ((cfg?.stakeholderIds || []).includes(currentUser.id)) return 'Stakeholder'
    return 'Staff'
  }

  return { parts, staffList, role, evaluatorRole, isSupervisor, isStakeholder, isAssignedAsStaff, supervisedStaff, stakeholderStaff, getEvaluatorRole }
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
  const { selectedYear } = useApp()
  const { role } = useRBAC()
  const { parts, staffList, evaluatorRole, isSupervisor, isStakeholder, isAssignedAsStaff, getEvaluatorRole } = useEvalAccess()

  const [activePart, setActivePart] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [quarter, setQuarter] = useState('Q1')

  // Reset activePart when the role changes (parts array changes)
  const partsKey = parts.join(',')
  useEffect(() => { setActivePart(null) }, [partsKey])

  // Set default activePart once parts are known
  const currentPart = activePart && parts.includes(activePart) ? activePart : (parts[0] ?? null)

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
  const effectiveStaffId = selectedStaff || (staffList[0]?.id ?? '')

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

      {/* Controls: Quarter + Staff selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quarter</p>
            <QuarterSelector value={quarter} onChange={setQuarter} />
          </div>
          {staffList.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Staff Member</p>
              <StaffSelector
                staffList={staffList}
                value={effectiveStaffId}
                onChange={setSelectedStaff}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">Year:</span>
            <span className="font-bold text-indigo-600">{selectedYear}</span>
          </div>
        </div>
      </div>

      {/* No staff message */}
      {staffList.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <Users size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">ไม่มีพนักงานที่ Assign สำหรับปี {selectedYear}</p>
          <p className="text-xs text-gray-400 mt-1">กรุณาติดต่อ HR เพื่อกำหนดโครงสร้างใน Admin → Hierarchy</p>
        </div>
      )}

      {staffList.length > 0 && effectiveStaffId && (
        <>
          {/* Part Tabs */}
          {parts.length > 1 && (
            <div className="flex gap-2 flex-wrap">
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
          {parts.length === 1 && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${PART_TAB_ACTIVE[parts[0]]}`}>
                {PART_META[parts[0]]?.icon}
                {PART_META[parts[0]]?.label}
                <span className="text-xs font-bold opacity-80 ml-1">{PART_META[parts[0]]?.pts}</span>
              </div>
            </div>
          )}

          {/* Part Content */}
          {(() => {
            const ctxRole = getEvaluatorRole(effectiveStaffId)
            const isSupervisorForStaff = ctxRole === 'Supervisor'
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
                {currentPart === 'part3' && (
                  <Part3KpiEval
                    staffId={effectiveStaffId}
                    quarter={quarter}
                    year={selectedYear}
                    evaluatorRole={ctxRole}
                    isSupervisor={isSupervisorForStaff}
                  />
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
      )}
    </div>
  )
}
