import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG, CAN_BE_SUPERVISOR_ROLES, CAN_BE_STAKEHOLDER_ROLES } from '../../hooks/useRBAC'
import { PlusCircle, Pencil, Trash2, Check, X, AlertCircle, Users, User, Briefcase, ChevronDown } from 'lucide-react'
import { subscribeAllUsers } from '../../services/authService'

const BLANK_FORM = { staffId: '', supervisorId: '', stakeholderIds: [], leaveQuota: 15 }

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

function normalizeUser(firebaseUser) {
  return {
    ...firebaseUser,
    id: firebaseUser.uid || firebaseUser.id,
    name: getUserDisplayName(firebaseUser),
    role: getUserPrimaryRole(firebaseUser),
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

function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const selectedUsers = options.filter((o) => selected.includes(o.id))

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
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
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${selected.includes(o.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <Avatar user={o} />
              <span className="flex-1 text-left font-medium text-gray-900">{o.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[o.role]}`}>{o.role}</span>
              {selected.includes(o.id) && <Check size={14} className="text-indigo-600 shrink-0" />}
            </button>
          ))}
          {options.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">No users available</p>}
        </div>
      )}
    </div>
  )
}

export default function HierarchyTab() {
  const { data, selectedYear, addStaffConfig, updateStaffConfig, removeStaffConfig } = useApp()
  const [form, setForm] = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [firebaseUsers, setFirebaseUsers] = useState([])

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      const normalized = users.map(normalizeUser)
      setFirebaseUsers(normalized)
    })
    return unsub
  }, [])

  const yearConfigs = data.staffConfigs.filter((c) => c.year === selectedYear)

  const allUsers = firebaseUsers.length > 0 ? firebaseUsers : data.users.map(normalizeUser)

  const evaluatableUsers = allUsers.filter((u) => u.role === 'Staff')
  const supervisorCandidates = allUsers.filter((u) => u.role !== 'Staff')
  const stakeholderCandidates = allUsers.filter((u) => u.role !== 'Staff')

  const assignedStaffIds = yearConfigs
    .filter((c) => c.id !== editingId)
    .map((c) => c.staffId)
  const availableStaff = evaluatableUsers.filter((u) => !assignedStaffIds.includes(u.id))

  const getUserById = (id) => allUsers.find((u) => u.id === id)

  const handleSubmit = () => {
    if (!form.staffId) { setError('Select a staff member.'); return }
    if (!form.supervisorId) { setError('Select a supervisor.'); return }
    if (form.leaveQuota < 0) { setError('Leave quota cannot be negative.'); return }

    if (editingId) {
      updateStaffConfig(editingId, {
        staffId: form.staffId,
        supervisorId: form.supervisorId,
        stakeholderIds: form.stakeholderIds,
        leaveQuota: Number(form.leaveQuota),
      })
    } else {
      addStaffConfig({
        year: selectedYear,
        staffId: form.staffId,
        supervisorId: form.supervisorId,
        stakeholderIds: form.stakeholderIds,
        leaveQuota: Number(form.leaveQuota),
      })
    }
    setForm(BLANK_FORM)
    setEditingId(null)
    setError('')
  }

  const handleEdit = (cfg) => {
    setForm({
      staffId: cfg.staffId,
      supervisorId: cfg.supervisorId,
      stakeholderIds: cfg.stakeholderIds || [],
      leaveQuota: cfg.leaveQuota,
    })
    setEditingId(cfg.id)
    setError('')
  }

  const handleCancel = () => {
    setForm(BLANK_FORM)
    setEditingId(null)
    setError('')
  }

  return (
    <div className="space-y-6">
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

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{editingId ? 'แก้ไข Assignment' : 'กำหนด Supervisor / Stakeholder ให้พนักงาน'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              ปี: <strong className="text-indigo-600">{selectedYear}</strong> | 
              Staff: <strong className="text-indigo-600">{evaluatableUsers.length} คน</strong> |
              Supervisor/Stakeholder: <strong className="text-indigo-600">{supervisorCandidates.length} คน</strong>
            </p>
          </div>
          {editingId && (
            <button onClick={handleCancel} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
              <X size={13} /> ยกเลิก
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Staff */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <span className="flex items-center gap-1"><User size={12} /> Staff Member (Role: Staff) *</span>
            </label>
            <select
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— เลือกพนักงาน —</option>
              {(editingId
                ? evaluatableUsers.filter(u => u.id === form.staffId || !assignedStaffIds.includes(u.id))
                : availableStaff
              ).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            {availableStaff.length === 0 && !editingId && (
              <p className="text-xs text-amber-600 mt-1">Staff Member ทั้งหมด ({evaluatableUsers.length} คน) ถูก Assign แล้วสำหรับปี {selectedYear}</p>
            )}
          </div>

          {/* Supervisor */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <span className="flex items-center gap-1"><Briefcase size={12} /> Supervisor *</span>
            </label>
            <select
              value={form.supervisorId}
              onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— เลือก Supervisor —</option>
              {supervisorCandidates
                .filter((u) => u.id !== form.staffId)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
            </select>
          </div>

          {/* Stakeholders */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <span className="flex items-center gap-1"><Users size={12} /> Stakeholders</span>
            </label>
            <MultiSelect
              options={stakeholderCandidates.filter((u) => u.id !== form.staffId && u.id !== form.supervisorId)}
              selected={form.stakeholderIds}
              onChange={(ids) => setForm({ ...form, stakeholderIds: ids })}
              placeholder="เลือก Stakeholder(s)..."
            />
          </div>

          {/* Leave Quota */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">โควตาวันลาต่อปี (วัน)</label>
            <input
              type="number"
              min="0"
              max="365"
              value={form.leaveQuota}
              onChange={(e) => setForm({ ...form, leaveQuota: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {editingId ? <><Check size={14} /> บันทึก</> : <><PlusCircle size={14} /> เพิ่ม Assignment</>}
          </button>
        </div>
      </div>

      {/* Configs List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">การ Assign พนักงาน — {selectedYear}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{yearConfigs.length} รายการ</p>
          </div>
        </div>

        {yearConfigs.length === 0 ? (
          <div className="px-6 py-12 text-center">
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
              const isEditing = editingId === cfg.id

              return (
                <div key={cfg.id} className={`px-6 py-4 transition-colors ${isEditing ? 'bg-indigo-50 border-l-4 border-l-indigo-400' : 'hover:bg-gray-50'}`}>
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
                        onClick={() => handleEdit(cfg)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(cfg.id)}
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
