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
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
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
              <Avatar user={o} />
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
  
  // Req 3: Hide stakeholders assigned >= 3 times unless already selected here
  const stakeholderUsageCount = (id) => yearConfigs.filter(cfg => (cfg.stakeholderIds || []).includes(id)).length
  const stakeholderCandidates = allUsers
    .filter((u) => CAN_BE_STAKEHOLDER_ROLES.includes(u.role))
    .filter((u) => stakeholderUsageCount(u.id) < 3 || stakeholderIds.includes(u.id))
    .sort(sortByName)

  const getUserById = (id) => allUsers.find((u) => u.id === id)

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
                {evaluatableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">การ Assign พนักงาน — {selectedYear}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{yearConfigs.length} รายการ</p>
          </div>
        </div>

        {yearConfigs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">ยังไม่มีการ Assign พนักงานสำหรับปี {selectedYear}</p>
            <p className="text-xs text-gray-400 mt-1">เพิ่ม Assignment ด้านบน หรือสร้างปีใหม่เพื่อโคลนโครงสร้างจากปีก่อนหน้า</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {yearConfigs.map((cfg) => {
              const staff = getUserById(cfg.staffId)
              const supervisor = getUserById(cfg.supervisorId)
              const stakeholders = (cfg.stakeholderIds || []).map(getUserById).filter(Boolean)

              return (
                <div key={`${cfg.year}_${cfg.staffId}`} className="px-4 py-3 transition-colors hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Staff */}
                      <div className="flex items-center gap-2.5">
                        <div className="bg-blue-50 p-1.5 rounded-lg shrink-0">
                          <User size={13} className="text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 font-medium">Staff</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Avatar user={staff} />
                            <p className="text-sm font-semibold text-gray-900 truncate">{staff?.name || '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Supervisor */}
                      <div className="flex items-center gap-2.5">
                        <div className="bg-purple-50 p-1.5 rounded-lg shrink-0">
                          <Briefcase size={13} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 font-medium">Supervisor</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Avatar user={supervisor} />
                            <p className="text-sm font-semibold text-gray-900 truncate">{supervisor?.name || '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stakeholders + Leave */}
                      <div className="flex items-start gap-2.5">
                        <div className="bg-yellow-50 p-1.5 rounded-lg shrink-0 mt-0.5">
                          <Users size={13} className="text-yellow-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 font-medium">Stakeholders · {cfg.leaveQuota}d leave</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {stakeholders.length > 0
                              ? stakeholders.map((s) => (
                                  <span key={s.id} className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">
                                    <Avatar user={s} size="xs" />
                                    {s.name}
                                  </span>
                                ))
                              : <span className="text-xs text-gray-400">None</span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => quickEdit(cfg)}
                        title="แก้ไข Supervisor/Staff"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      >
                        <Briefcase size={14} />
                      </button>
                      <button
                        onClick={() => quickEditStakeholder(cfg)}
                        title="แก้ไข Stakeholders"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                      >
                        <Users size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ staffId: cfg.staffId, year: cfg.year, id: cfg.id })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
