import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { subscribeAllUsers, updateUserProfile, ALL_ROLES } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import {
  UserPlus, Pencil, Trash2, Check, X, AlertCircle, ExternalLink,
  IdCard, Mail, Link2, Loader, Search, Users, ChevronDown,
  CheckCircle2, Clock, XCircle, RefreshCw, Save, Edit3, BadgeCheck,
} from 'lucide-react'

// ── Legacy Evaluation System Users (data.users) ────────────────────────────────
const ROLES = ['Staff', 'HR', 'HRM', 'GM', 'MD']
const BLANK_FORM = { name: '', role: 'Staff', staffCode: '', jdUrl: '' }

// ── Role badge for Firebase users ──────────────────────────────────────────────
const ROLE_BADGE = {
  MasterAdmin: 'bg-purple-100 text-purple-800 ring-purple-200',
  HR:          'bg-green-100 text-green-800 ring-green-200',
  HRM:         'bg-teal-100 text-teal-800 ring-teal-200',
  GM:          'bg-orange-100 text-orange-800 ring-orange-200',
  MD:          'bg-red-100 text-red-800 ring-red-200',
  Staff:       'bg-blue-100 text-blue-800 ring-blue-200',
  Viewer:      'bg-gray-100 text-gray-700 ring-gray-200',
  Creator:     'bg-pink-100 text-pink-800 ring-pink-200',
}

const STATUS_BADGE = {
  approved: 'bg-green-100 text-green-700 ring-green-200',
  pending:  'bg-yellow-100 text-yellow-700 ring-yellow-200',
  rejected: 'bg-red-100 text-red-700 ring-red-200',
}
const STATUS_LABEL  = { approved: 'อนุมัติแล้ว', pending: 'รออนุมัติ', rejected: 'ปฏิเสธ' }
const STATUS_ICON   = {
  approved: <CheckCircle2 size={10} />,
  pending:  <Clock size={10} />,
  rejected: <XCircle size={10} />,
}

// ── Firebase User Avatar ───────────────────────────────────────────────────────
function FBAvatar({ user }) {
  if (user?.photoURL) {
    return (
      <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
    )
  }
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
      {initials}
    </div>
  )
}

// ── Firebase User Row with JD URL edit ────────────────────────────────────────
function FirebaseUserRow({ user, isSelf }) {
  const [editing, setEditing]   = useState(false)
  const [jdUrl, setJdUrl]       = useState(user.jdUrl || '')
  const [staffCode, setStaffCode] = useState(user.staffCode || '')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Sync from real-time updates (only when not editing)
  useEffect(() => {
    if (!editing) {
      setJdUrl(user.jdUrl || '')
      setStaffCode(user.staffCode || '')
    }
  }, [user.jdUrl, user.staffCode, editing])

  const handleSave = async () => {
    setSaving(true)
    await updateUserProfile(user.uid, {
      jdUrl:     jdUrl.trim(),
      staffCode: staffCode.trim(),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setEditing(false)
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.uid

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${editing ? 'border-indigo-300' : saved ? 'border-green-300' : 'border-gray-200 hover:border-gray-300'} bg-white`}>
      {/* Row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <FBAvatar user={user} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            {isSelf && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">คุณ</span>}
            {saved && (
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                <CheckCircle2 size={9} /> บันทึกแล้ว
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Mail size={10} />{user.email}
            </span>
            {user.staffCode && (
              <span className="flex items-center gap-1 text-xs text-indigo-600 font-mono font-medium">
                <IdCard size={10} />{user.staffCode}
              </span>
            )}
            {user.jdUrl && (
              <a href={user.jdUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors">
                <ExternalLink size={10} />เปิด JD
              </a>
            )}
          </div>
          {user.position && <p className="text-xs text-gray-500 mt-0.5">{user.position}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div className="flex gap-1 flex-wrap">
            {(user.roles || ['Staff']).map((r) => (
              <span key={r} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${ROLE_BADGE[r] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                {r}
              </span>
            ))}
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${STATUS_BADGE[user.status] || STATUS_BADGE.pending}`}>
            {STATUS_ICON[user.status]}{STATUS_LABEL[user.status] || user.status}
          </span>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          title={editing ? 'ยกเลิก' : 'แก้ไข JD URL'}
          className={`p-2 rounded-lg border text-xs transition-colors shrink-0 ${
            editing ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
          }`}
        >
          {editing ? <X size={14} /> : <Edit3 size={14} />}
        </button>
      </div>

      {/* Inline Edit: JD URL + Staff Code */}
      {editing && (
        <div className="border-t border-indigo-100 bg-indigo-50/40 px-5 py-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">แก้ไข JD & Staff Code</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Link2 size={11} /> JD Attachment URL
              </label>
              <input
                type="url"
                value={jdUrl}
                onChange={(e) => setJdUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
              <p className="text-[10px] text-gray-400 mt-1">Google Drive, SharePoint หรือ URL ใดก็ได้</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <IdCard size={11} /> รหัสพนักงาน (Staff Code)
              </label>
              <input
                type="text"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
                placeholder="เช่น EMP001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1">ใช้เชื่อมกับระบบ Evaluation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              บันทึก
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            {jdUrl && (
              <a href={jdUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
                <ExternalLink size={13} />ทดสอบ URL
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Legacy Evaluation User Row ─────────────────────────────────────────────────
function EvalUserRow({ user, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR_BG[user.role] || 'bg-gray-400'} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
          {user.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 font-mono">{user.id}</span>
            {user.staffCode && (
              <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                <IdCard size={11} />{user.staffCode}
              </span>
            )}
            {user.jdUrl && (
              <a href={user.jdUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
                <ExternalLink size={11} />JD
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${ROLE_BADGE_CLASSES[user.role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
          {user.role}
        </span>
        <button onClick={() => onEdit(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(user.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main UsersTab ──────────────────────────────────────────────────────────────
export default function UsersTab() {
  const { data, addUser, updateUser, removeUser } = useApp()
  const { userProfile } = useAuth()

  // Firebase auth users (real-time)
  const [fbUsers, setFbUsers]   = useState([])
  const [fbLoading, setFbLoading] = useState(true)
  const [search, setSearch]     = useState('')

  // Legacy eval user form
  const [form, setForm]         = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState(null)
  const [error, setError]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showEvalUsers, setShowEvalUsers] = useState(false)

  useEffect(() => {
    const unsub = subscribeAllUsers((list) => {
      setFbUsers(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      setFbLoading(false)
    })
    return unsub
  }, [])

  // Filter Firebase users
  const filteredFbUsers = search.trim()
    ? fbUsers.filter((u) => {
        const q = search.toLowerCase()
        const name = [u.firstName, u.lastName].join(' ').toLowerCase()
        return name.includes(q) || (u.email || '').toLowerCase().includes(q) || (u.staffCode || '').toLowerCase().includes(q)
      })
    : fbUsers

  // Legacy form handlers
  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Name is required.'); return }
    const payload = { name: form.name.trim(), role: form.role, staffCode: form.staffCode.trim(), jdUrl: form.jdUrl.trim() }
    if (editingId) updateUser(editingId, payload)
    else addUser(payload)
    setForm(BLANK_FORM); setEditingId(null); setError('')
  }
  const handleEdit   = (user) => { setForm({ name: user.name, role: user.role, staffCode: user.staffCode ?? '', jdUrl: user.jdUrl ?? '' }); setEditingId(user.id); setError('') }
  const handleCancel = () => { setForm(BLANK_FORM); setEditingId(null); setError('') }
  const handleDelete = (id) => setConfirmDelete(id)
  const confirmDeleteUser = () => { removeUser(confirmDelete); setConfirmDelete(null) }

  return (
    <div className="space-y-6">
      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg"><AlertCircle size={18} className="text-red-600" /></div>
              <h3 className="text-base font-semibold text-gray-900">Delete User</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will permanently remove <strong>{data.users.find(u => u.id === confirmDelete)?.name}</strong> and all associated configurations.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeleteUser} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: Firebase Auth Users — All Users
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <Users size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">All Users</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                ผู้ใช้จาก Firebase Authentication · {fbUsers.length} คน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <RefreshCw size={11} />อัปเดต Real-time
          </div>
        </div>

        {/* Info banner */}
        <div className="mx-5 mt-4 flex items-start gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <BadgeCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            รายชื่อด้านล่างมาจากผู้ใช้ที่ <strong>สมัคร / Login</strong> เข้าระบบผ่าน Firebase
            · กด <strong>Edit</strong> เพื่อกำหนด <strong>JD Attachment URL</strong> และ <strong>Staff Code</strong> ให้กับแต่ละคน
          </p>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, อีเมล, รหัสพนักงาน..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="px-5 pb-5 space-y-2.5">
          {fbLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader size={22} className="animate-spin text-indigo-400" />
            </div>
          ) : filteredFbUsers.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              {search ? `ไม่พบ "${search}"` : 'ยังไม่มีผู้ใช้ที่ลงทะเบียน'}
            </div>
          ) : (
            <>
              {filteredFbUsers.map((user) => (
                <FirebaseUserRow
                  key={user.uid}
                  user={user}
                  isSelf={user.uid === userProfile?.uid}
                />
              ))}
              {search && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  แสดง {filteredFbUsers.length} จาก {fbUsers.length} รายการ
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: Evaluation System Users (data.users) — Collapsible
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowEvalUsers(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-gray-900">ผู้ใช้ระบบ Evaluation (data.users)</h3>
            <p className="text-xs text-gray-500 mt-0.5">{data.users.length} คน · ใช้สำหรับ Hierarchy, KPI และการประเมิน</p>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${showEvalUsers ? 'rotate-180' : ''}`} />
        </button>

        {showEvalUsers && (
          <>
            {/* Add / Edit Form */}
            <div className="border-t border-gray-100 px-5 py-5 bg-gray-50">
              <h4 className="text-xs font-semibold text-gray-700 mb-3">{editingId ? 'Edit User' : 'Add New User'}</h4>
              {error && (
                <div className="flex items-center gap-2 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} />{error}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} placeholder="e.g. John Smith"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Staff ID</label>
                  <input type="text" value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })}
                    placeholder="e.g. EMP001"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">JD Attachment URL</label>
                  <input type="url" value={form.jdUrl} onChange={(e) => setForm({ ...form, jdUrl: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white" />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pb-0.5">
                    <button onClick={handleSubmit}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                      {editingId ? <><Check size={14} /> Save</> : <><UserPlus size={14} /> Add</>}
                    </button>
                    {editingId && (
                      <button onClick={handleCancel}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
                        <X size={14} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* User list */}
            <div className="divide-y divide-gray-100">
              {data.users.map((user) => (
                <EvalUserRow key={user.id} user={user} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
