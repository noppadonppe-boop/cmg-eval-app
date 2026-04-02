import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG, CAN_BE_STAKEHOLDER_ROLES } from '../../hooks/useRBAC'
import { PlusCircle, Pencil, Trash2, Check, X, AlertCircle, Users, User, Briefcase, ChevronDown } from 'lucide-react'
import { subscribeAllUsers } from '../../services/authService'

const DEFAULT_LEAVE_QUOTA = 15

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

function normalizePositions(user) {
  if (Array.isArray(user?.positions) && user.positions.length > 0) return user.positions
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean)
  const hasStaff = roles.includes('Staff')
  const hasNonStaff = roles.some((r) => r && r !== 'Staff')
  if (hasStaff && hasNonStaff) return ['Staff', 'Supervisor']
  if (hasNonStaff) return ['Supervisor']
  return ['Staff']
}

function normalizeUser(firebaseUser) {
  return {
    ...firebaseUser,
    id: firebaseUser.uid || firebaseUser.id,
    name: getUserDisplayName(firebaseUser),
    role: getUserPrimaryRole(firebaseUser),
    positions: normalizePositions(firebaseUser),
  }
}

function Avatar({ user, size = 'sm' }) {
  if (!user) return null
  const s = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  const displayName = getUserDisplayName(user)
  return (
    <div className={`${s} rounded-full ${ROLE_AVATAR_BG[user.role] || 'bg-gray-400'} flex items-center justify-center text-white font-bold shrink-0`}>
      {displayName.charAt(0)}
    </div>
  )
}

function MultiSelect({ options, selected, onChange, placeholder, maxSelected = null, disabled = false }) {
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedUsers = options.filter((o) => selected.includes(o.id))
  // We should also display users that were selected but might be filtered out from options
  // Just in case, but let's assume they are still passed in options if they are selected.
  const maxReached = typeof maxSelected === 'number' && maxSelected > 0 && selected.length >= maxSelected

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
      return
    }
    if (maxReached) return
    onChange([...selected, id])
  }

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={dropRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-gray-300 bg-white text-xs hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-white"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {selectedUsers.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            selectedUsers.map((u) => (
              <span key={u.id} className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[u.role]}`}>
                {u.name}
              </span>
            ))
          )}
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-[70vh] overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              disabled={maxReached && !selected.includes(o.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                selected.includes(o.id)
                  ? 'bg-indigo-50'
                  : maxReached
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-50'
              }`}
            >
              <span className="flex-1 text-left font-medium text-gray-900">{o.name}</span>
              {selected.includes(o.id) && <Check size={14} className="text-indigo-600 shrink-0" />}
            </button>
          ))}
          {options.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">No users available</p>}
        </div>
      )}
      {typeof maxSelected === 'number' && maxSelected > 0 && (
        <p className="mt-1 text-[11px] text-gray-400">
          เลือกได้สูงสุด {maxSelected} คน · เลือกแล้ว {selected.length}/{maxSelected}
        </p>
      )}
    </div>
  )
}

export default function HierarchyTab() {
  const { data, selectedYear, addStaffConfig, updateStaffConfig, removeStaffConfig } = useApp()
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [firebaseUsers, setFirebaseUsers] = useState([])
  const [assignedSearch, setAssignedSearch] = useState('')
  const [unassignedSearch, setUnassignedSearch] = useState('')
  const [supSupervisorId, setSupSupervisorId] = useState('')
  const [supStaffIds, setSupStaffIds] = useState([])
  const [stakeStaffId, setStakeStaffId] = useState('')
  const [stakeholderIds, setStakeholderIds] = useState([])
  const [leaveStaffId, setLeaveStaffId] = useState('')
  const [leaveQuota, setLeaveQuota] = useState(DEFAULT_LEAVE_QUOTA)

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      const normalized = users.map(normalizeUser)
      setFirebaseUsers(normalized)
    })
    return unsub
  }, [])

  const yearConfigs = data.staffConfigs.filter((c) => c.year === selectedYear)
  const allUsers = firebaseUsers.length > 0 ? firebaseUsers : data.users.map(normalizeUser)

  // Req 4: Sort A-Z, ก-ฮ, 0-9
  const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '', 'th', { numeric: true })
  
  const evaluatableUsers = allUsers.filter((u) => (u.positions || []).includes('Staff')).sort(sortByName)
  const supervisorCandidates = allUsers.filter((u) => (u.positions || []).includes('Supervisor')).sort(sortByName)
  
  const stakeholderCandidates = allUsers
    .filter((u) => CAN_BE_STAKEHOLDER_ROLES.includes(u.role))
    .sort(sortByName)

  const staffStakeholderCount = (id) => {
    const cfg = yearConfigs.find((c) => c.staffId === id)
    return (cfg?.stakeholderIds || []).length
  }

  const getUserById = (id) => allUsers.find((u) => u.id === id)

  // Find users without Supervisor or Stakeholder assignments
  const unassignedUsers = evaluatableUsers.filter((user) => {
    const cfg = yearConfigs.find((c) => c.staffId === user.id)
    if (!cfg) return true
    const hasNoSupervisor = !cfg.supervisorId
    const hasNoStakeholders = !cfg.stakeholderIds || cfg.stakeholderIds.length === 0
    return hasNoSupervisor && hasNoStakeholders
  })

  const normalizedAssignedSearch = assignedSearch.trim().toLowerCase()
  const normalizedUnassignedSearch = unassignedSearch.trim().toLowerCase()

  const filteredYearConfigs = [...yearConfigs]
    .sort((a, b) => {
      const staffA = getUserById(a.staffId)
      const staffB = getUserById(b.staffId)
      return sortByName(staffA || { name: '' }, staffB || { name: '' })
    })
    .filter((cfg) => {
      if (!normalizedAssignedSearch) return true
      const staff = getUserById(cfg.staffId)
      const supervisor = getUserById(cfg.supervisorId)
      const stakeholders = (cfg.stakeholderIds || []).map(getUserById).filter(Boolean)
      const searchHaystack = [
        staff?.name,
        supervisor?.name,
        staff?.role,
        ...stakeholders.map((s) => s.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return searchHaystack.includes(normalizedAssignedSearch)
    })

  const filteredUnassignedUsers = unassignedUsers.filter((user) => {
    if (!normalizedUnassignedSearch) return true
    const searchHaystack = [user.name, user.role].filter(Boolean).join(' ').toLowerCase()
    return searchHaystack.includes(normalizedUnassignedSearch)
  })

  // Req 5: Cross disable forms
  const isSupActive = supSupervisorId !== '' || supStaffIds.length > 0
  const isStakeActive = stakeStaffId !== '' || stakeholderIds.length > 0

  const upsertStaffConfig = (staffId, updates) => {
    const cfg = yearConfigs.find((c) => c.staffId === staffId)
    if (cfg) {
      updateStaffConfig({ staffId, year: selectedYear }, updates)
      return
    }
    addStaffConfig({
      year: selectedYear,
      staffId,
      supervisorId: '',
      stakeholderIds: [],
      leaveQuota: DEFAULT_LEAVE_QUOTA,
      ...updates,
    })
  }

  const applySupervisorAssignments = () => {
    if (!supSupervisorId) { setError('เลือก Supervisor'); return }
    if (supStaffIds.length === 0) { setError('เลือก Staff อย่างน้อย 1 คน'); return }
    if (supStaffIds.includes(supSupervisorId)) { setError('Supervisor ไม่สามารถเป็น Staff ของตัวเอง'); return }
    supStaffIds.forEach((staffId) => {
      const cfg = yearConfigs.find((c) => c.staffId === staffId)
      upsertStaffConfig(staffId, {
        supervisorId: supSupervisorId,
        stakeholderIds: cfg?.stakeholderIds || [],
        leaveQuota: cfg?.leaveQuota ?? DEFAULT_LEAVE_QUOTA,
      })
    })
    // Req 2: Clear after save
    setSupSupervisorId('')
    setSupStaffIds([])
    setError('')
  }

  const applyStakeholders = () => {
    if (!stakeStaffId) { setError('เลือก Staff'); return }
    if (stakeholderIds.length > 3) { setError('Stakeholders เลือกได้สูงสุด 3 คน'); return }
    if (stakeholderIds.includes(stakeStaffId)) { setError('Staff ไม่สามารถเป็น Stakeholder ของตัวเอง'); return }
    const cfg = yearConfigs.find((c) => c.staffId === stakeStaffId)
    upsertStaffConfig(stakeStaffId, {
      supervisorId: cfg?.supervisorId || '',
      stakeholderIds,
      leaveQuota: cfg?.leaveQuota ?? DEFAULT_LEAVE_QUOTA,
    })
    // Req 2: Clear after save
    setStakeStaffId('')
    setStakeholderIds([])
    setError('')
  }

  const applyLeaveQuota = () => {
    if (!leaveStaffId) { setError('เลือก Staff'); return }
    const q = Number(leaveQuota)
    if (Number.isNaN(q) || q < 0) { setError('โควตาวันลาไม่ถูกต้อง'); return }
    const cfg = yearConfigs.find((c) => c.staffId === leaveStaffId)
    upsertStaffConfig(leaveStaffId, {
      supervisorId: cfg?.supervisorId || '',
      stakeholderIds: cfg?.stakeholderIds || [],
      leaveQuota: q,
    })
    setLeaveStaffId('')
    setLeaveQuota(DEFAULT_LEAVE_QUOTA)
    setError('')
  }

  const quickEdit = (cfg) => {
    setSupSupervisorId(cfg.supervisorId || '')
    setSupStaffIds([cfg.staffId].filter(Boolean))
    setStakeStaffId('')
    setStakeholderIds([])
    setLeaveStaffId(cfg.staffId || '')
    setLeaveQuota(cfg.leaveQuota ?? DEFAULT_LEAVE_QUOTA)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const quickEditStakeholder = (cfg) => {
    setSupSupervisorId('')
    setSupStaffIds([])
    setStakeStaffId(cfg.staffId || '')
    setStakeholderIds(cfg.stakeholderIds || [])
    setLeaveStaffId(cfg.staffId || '')
    setLeaveQuota(cfg.leaveQuota ?? DEFAULT_LEAVE_QUOTA)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-4">
      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">ลบ Assignment</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              ลบ Assignment พนักงานนี้ออกจากปี <strong>{selectedYear}</strong>? KPI และการประเมินที่บันทึกไว้แล้วจะยังคงอยู่
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={() => { removeStaffConfig(confirmDelete); setConfirmDelete(null) }} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Box 1: Assign Supervisor */}
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-opacity ${isStakeActive ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">กำหนด Staff ให้กับ Supervisor</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">ปี {selectedYear} · Supervisor 1 คนเลือก Staff ได้ไม่จำกัด</p>
            </div>
            <div className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-500">
              {supStaffIds.length} คน
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <span className="flex items-center gap-1"><Briefcase size={12} /> Supervisor</span>
              </label>
              <select
                disabled={isStakeActive}
                value={supSupervisorId}
                onChange={(e) => { setSupSupervisorId(e.target.value); setError('') }}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">— เลือก Supervisor —</option>
                {supervisorCandidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <span className="flex items-center gap-1"><User size={12} /> Staff (Multi)</span>
              </label>
              <MultiSelect
                disabled={isStakeActive}
                options={evaluatableUsers.filter((u) => u.id !== supSupervisorId)}
                selected={supStaffIds}
                onChange={(ids) => { setSupStaffIds(ids); setError('') }}
                placeholder="เลือก Staff..."
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              {supStaffIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSupStaffIds([]); setSupSupervisorId('') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <X size={13} /> ล้าง
                </button>
              )}
              <button
                type="button"
                disabled={isStakeActive}
                onClick={applySupervisorAssignments}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <PlusCircle size={14} /> บันทึก
              </button>
            </div>
          </div>
        </div>

        {/* Box 2: Assign Stakeholders */}
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-opacity ${isSupActive ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">กำหนด Stakeholders ให้กับ Staff</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">เลือกได้สูงสุด 3 คน · ซ้ำกับคนอื่นได้</p>
            </div>
            <div className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-500">
              {stakeholderIds.length}/3
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <span className="flex items-center gap-1"><User size={12} /> Staff</span>
              </label>
              <select
                disabled={isSupActive}
                value={stakeStaffId}
                onChange={(e) => {
                  const id = e.target.value
                  setStakeStaffId(id)
                  const cfg = yearConfigs.find((c) => c.staffId === id)
                  setStakeholderIds(cfg?.stakeholderIds || [])
                  setError('')
                }}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">— เลือก Staff —</option>
                {evaluatableUsers.map((u) => {
                  const cnt = staffStakeholderCount(u.id)
                  const isFull = cnt >= 3
                  return (
                    <option key={u.id} value={u.id} disabled={isFull && stakeStaffId !== u.id} className={isFull && stakeStaffId !== u.id ? 'text-gray-400' : ''}>
                      {u.name} ({cnt}/3)
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <span className="flex items-center gap-1"><Users size={12} /> Stakeholders (Multi)</span>
              </label>
              <MultiSelect
                disabled={isSupActive}
                options={stakeholderCandidates.filter((u) => u.id !== stakeStaffId)}
                selected={stakeholderIds}
                onChange={(ids) => { setStakeholderIds(ids); setError('') }}
                placeholder="เลือก Stakeholder..."
                maxSelected={3}
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              {stakeholderIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setStakeholderIds([]); setStakeStaffId('') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <X size={13} /> ล้าง
                </button>
              )}
              <button
                type="button"
                disabled={isSupActive}
                onClick={applyStakeholders}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <PlusCircle size={14} /> บันทึก
              </button>
            </div>
          </div>
        </div>

        {/* Box 3: Assign Leave Quota */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">โควตาวันลาต่อปี</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">ตั้งค่าเป็นรายคน</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                <span className="flex items-center gap-1"><User size={12} /> Staff</span>
              </label>
              <select
                value={leaveStaffId}
                onChange={(e) => {
                  const id = e.target.value
                  setLeaveStaffId(id)
                  const cfg = yearConfigs.find((c) => c.staffId === id)
                  setLeaveQuota(cfg?.leaveQuota ?? DEFAULT_LEAVE_QUOTA)
                  setError('')
                }}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— เลือก Staff —</option>
                {evaluatableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">จำนวนวันลา</label>
              <input
                type="number"
                min="0"
                max="365"
                value={leaveQuota}
                onChange={(e) => { setLeaveQuota(e.target.value); setError('') }}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={applyLeaveQuota}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
              >
                <PlusCircle size={14} /> บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Configs List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">การ Assign พนักงาน — {selectedYear}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{filteredYearConfigs.length} / {yearConfigs.length} รายการ</p>
          </div>
          <div className="w-full max-w-xs">
            <input
              type="text"
              value={assignedSearch}
              onChange={(e) => setAssignedSearch(e.target.value)}
              placeholder="ค้นหารายชื่อ Staff, Supervisor, Stakeholder..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {yearConfigs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">ยังไม่มีการ Assign พนักงานสำหรับปี {selectedYear}</p>
            <p className="text-xs text-gray-400 mt-1">เพิ่ม Assignment ด้านบน หรือสร้างปีใหม่เพื่อโคลนโครงสร้างจากปีก่อนหน้า</p>
          </div>
        ) : filteredYearConfigs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">ไม่พบรายชื่อที่ค้นหา</p>
            <p className="text-xs text-gray-400 mt-1">ลองค้นหาด้วยชื่อ Staff, Supervisor หรือ Stakeholder</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-medium">Staff</th>
                  <th className="px-4 py-2.5 font-medium">Supervisor</th>
                  <th className="px-4 py-2.5 font-medium w-full">Stakeholders</th>
                  <th className="px-4 py-2.5 font-medium text-center">ลาได้ (วัน)</th>
                  <th className="px-4 py-2.5 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredYearConfigs.map((cfg) => {
                  const staff = getUserById(cfg.staffId)
                  const supervisor = getUserById(cfg.supervisorId)
                  const stakeholders = (cfg.stakeholderIds || []).map(getUserById).filter(Boolean)

                  return (
                    <tr key={`${cfg.year}_${cfg.staffId}`} className="hover:bg-indigo-50/40 transition-colors group">
                      {/* Staff */}
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar user={staff} size="sm" />
                          <span className="font-semibold text-gray-900 truncate max-w-[140px] xl:max-w-[180px]" title={staff?.name}>{staff?.name || '—'}</span>
                        </div>
                      </td>

                      {/* Supervisor */}
                      <td className="px-4 py-2 align-middle border-l border-gray-50">
                        <div className="flex items-center gap-2">
                          {supervisor ? (
                            <>
                              <Avatar user={supervisor} size="sm" />
                              <span className="font-medium text-gray-700 truncate max-w-[140px] xl:max-w-[180px]" title={supervisor.name}>{supervisor.name}</span>
                            </>
                          ) : (
                            <span className="text-gray-400 italic px-2">—</span>
                          )}
                        </div>
                      </td>

                      {/* Stakeholders */}
                      <td className="px-4 py-2 align-middle border-l border-gray-50 whitespace-normal">
                        <div className="flex flex-wrap gap-1">
                          {stakeholders.length > 0 ? (
                            stakeholders.map((s) => (
                              <span key={s.id} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-600 whitespace-nowrap">
                                {s.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic px-1">—</span>
                          )}
                        </div>
                      </td>

                      {/* Leave Quota */}
                      <td className="px-4 py-2 align-middle text-center border-l border-gray-50 font-medium text-gray-600">
                        {cfg.leaveQuota ?? DEFAULT_LEAVE_QUOTA}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2 align-middle text-right border-l border-gray-50">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => quickEdit(cfg)}
                            title="แก้ไข Supervisor/Staff"
                            className="p-1.5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Briefcase size={14} />
                          </button>
                          <button
                            onClick={() => quickEditStakeholder(cfg)}
                            title="แก้ไข Stakeholders"
                            className="p-1.5 rounded text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          >
                            <Users size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ staffId: cfg.staffId, year: cfg.year, id: cfg.id })}
                            title="ลบ Assignment"
                            className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unassigned Users Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">User ที่ยังไม่ได้ Assign Supervisor/Stakeholder — {selectedYear}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{filteredUnassignedUsers.length} / {unassignedUsers.length} รายการ</p>
          </div>
          <div className="w-full max-w-xs">
            <input
              type="text"
              value={unassignedSearch}
              onChange={(e) => setUnassignedSearch(e.target.value)}
              placeholder="ค้นหารายชื่อ User หรือ Role..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {unassignedUsers.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Users size={28} className="text-green-200 mx-auto mb-2" />
            <p className="text-sm text-green-600 font-medium">ทุกคนได้รับการ Assign แล้ว</p>
            <p className="text-xs text-gray-400 mt-1">พนักงานทุกคนมี Supervisor หรือ Stakeholder แล้ว</p>
          </div>
        ) : filteredUnassignedUsers.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Users size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-medium">ไม่พบรายชื่อที่ค้นหา</p>
            <p className="text-xs text-gray-400 mt-1">ลองค้นหาด้วยชื่อ User หรือ Role</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-medium">Staff</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredUnassignedUsers.map((user) => {
                  const cfg = yearConfigs.find((c) => c.staffId === user.id)
                  const hasNoSupervisor = !cfg || !cfg.supervisorId
                  const hasNoStakeholders = !cfg || !cfg.stakeholderIds || cfg.stakeholderIds.length === 0

                  return (
                    <tr key={user.id} className="hover:bg-orange-50/40 transition-colors group">
                      {/* Staff */}
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar user={user} size="sm" />
                          <span className="font-semibold text-gray-900 truncate max-w-[180px]" title={user.name}>{user.name}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-2 align-middle border-l border-gray-50">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${ROLE_BADGE_CLASSES[user.role]}`}>
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2 align-middle border-l border-gray-50">
                        <div className="flex flex-wrap gap-1">
                          {hasNoSupervisor && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                              ไม่มี Supervisor
                            </span>
                          )}
                          {hasNoStakeholders && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                              ไม่มี Stakeholder
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
