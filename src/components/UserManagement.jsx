import { useState, useEffect, useRef } from 'react'
import { subscribeAllUsers, updateUserProfile, deleteUser, ALL_ROLES } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import {
  Users, CheckCircle2, XCircle, Clock, Edit3, Save, X, ChevronDown,
  User, Loader, AlertCircle, Search, Filter, Mail, Briefcase,
  KeyRound, RefreshCw, BadgeCheck, Trash2,
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  approved: 'bg-green-100 text-green-700 ring-green-200',
  pending:  'bg-yellow-100 text-yellow-700 ring-yellow-200',
  rejected: 'bg-red-100 text-red-700 ring-red-200',
}
const STATUS_LABEL = { approved: 'อนุมัติแล้ว', pending: 'รอการอนุมัติ', rejected: 'ปฏิเสธ' }
const STATUS_ICON  = { approved: <CheckCircle2 size={10} />, pending: <Clock size={10} />, rejected: <XCircle size={10} /> }

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

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 10 }) {
  const cls = `w-${size} h-${size} rounded-full shrink-0`
  if (user?.photoURL) {
    return (
      <img src={user.photoURL} alt="" className={`${cls} object-cover border-2 border-white shadow-sm`} />
    )
  }
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return (
    <div className={`${cls} bg-indigo-500 flex items-center justify-center text-white text-sm font-bold`}>
      {initials}
    </div>
  )
}

// ── Role Multi-Select Dropdown ────────────────────────────────────────────────
function RoleMultiSelect({ selected = [], onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, width: 0, top: 0, bottom: null, maxHeight: 256 })
  const anchorRef = useRef(null)
  const toggle = (r) => onChange(selected.includes(r) ? selected.filter(x => x !== r) : [...selected, r])

  useEffect(() => {
    if (!open) return

    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const margin = 6
      const viewportH = window.innerHeight || 0
      const belowSpace = Math.max(0, viewportH - rect.bottom - margin)
      const aboveSpace = Math.max(0, rect.top - margin)
      const openUp = belowSpace < 220 && aboveSpace > belowSpace
      const available = openUp ? aboveSpace : belowSpace
      const maxHeight = Math.max(140, Math.min(320, available))

      if (openUp) {
        setPos({
          left: rect.left,
          width: rect.width,
          top: 0,
          bottom: viewportH - rect.top + margin,
          maxHeight,
        })
      } else {
        setPos({
          left: rect.left,
          width: rect.width,
          top: rect.bottom + margin,
          bottom: null,
          maxHeight,
        })
      }
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  return (
    <div className="relative" ref={anchorRef}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-left hover:border-gray-400 transition-colors">
        <div className="flex-1 flex flex-wrap gap-1 min-h-[1.25rem]">
          {selected.length ? selected.map(r => (
            <span key={r} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${ROLE_BADGE[r] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
              {r}
            </span>
          )) : <span className="text-gray-400 text-xs">เลือก Role...</span>}
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 overflow-y-auto"
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.bottom == null ? pos.top : undefined,
              bottom: pos.bottom == null ? undefined : pos.bottom,
              maxHeight: pos.maxHeight,
            }}
          >
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(r)} onChange={() => toggle(r)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${ROLE_BADGE[r] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{r}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── User Row ───────────────────────────────────────────────────────────────────
function UserRow({ user, isSelf, isMasterAdmin }) {
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName:  user.lastName || '',
    position:  user.position || '',
    staffCode: user.staffCode || '',
    roles:     user.roles || ['Staff'],
    status:    user.status || 'pending',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync form when user data changes externally (real-time)
  useEffect(() => {
    if (!editing) {
      setForm({
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
        position:  user.position  || '',
        staffCode: user.staffCode || '',
        roles:     user.roles     || ['Staff'],
        status:    user.status    || 'pending',
      })
    }
  }, [user.firstName, user.lastName, user.position, user.staffCode, user.roles?.join(), user.status, editing])

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleApprove = async () => {
    setSaving(true)
    await updateUserProfile(user.uid, { status: 'approved' }).catch(() => {})
    setSaving(false)
  }
  const handleReject = async () => {
    setSaving(true)
    await updateUserProfile(user.uid, { status: 'rejected' }).catch(() => {})
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteUser(user.uid).catch(() => {})
    setDeleting(false)
    setShowDeleteConfirm(false)
  }

  const handleSave = async () => {
    if (!form.roles.length) return
    setSaving(true)
    await updateUserProfile(user.uid, {
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      position:  form.position.trim(),
      staffCode: form.staffCode.trim(),
      roles:     form.roles,
      status:    form.status,
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setEditing(false)
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.uid
  const statusStyle = STATUS_BADGE[user.status] || STATUS_BADGE.pending

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      editing ? 'border-indigo-300 shadow-sm' : saved ? 'border-green-300' : 'border-gray-200 hover:border-gray-300'
    } bg-white`}>

      {/* ── Row summary ── */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Avatar */}
        <Avatar user={user} size={10} />

        {/* Name / email / position */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            {isSelf && (
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">คุณ</span>
            )}
            {saved && (
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                <CheckCircle2 size={9} /> บันทึกแล้ว
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Mail size={10} />{user.email}
            {user.staffCode && <span className="ml-2 text-indigo-400 font-mono"># {user.staffCode}</span>}
          </p>
          {user.position && <p className="text-xs text-gray-500 mt-0.5">{user.position}</p>}
        </div>

        {/* Roles + Status */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-xs">
          <div className="flex gap-1 flex-wrap justify-end">
            {(user.roles || ['Staff']).map((r) => (
              <span key={r} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ${ROLE_BADGE[r] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                {r}
              </span>
            ))}
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${statusStyle}`}>
            {STATUS_ICON[user.status]}{STATUS_LABEL[user.status] || user.status}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {user.status === 'pending' && !editing && (
            <>
              <button onClick={handleApprove} disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                อนุมัติ
              </button>
              <button onClick={handleReject} disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                <XCircle size={11} /> ปฏิเสธ
              </button>
            </>
          )}
          
          {/* Delete button for MasterAdmin (not for self) */}
          {isMasterAdmin && !isSelf && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="ลบผู้ใช้"
              className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          
          <button
            onClick={() => setEditing(v => !v)}
            title={editing ? 'ยกเลิก' : 'แก้ไข'}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              editing
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                : 'border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
            }`}>
            {editing ? <X size={14} /> : <Edit3 size={14} />}
          </button>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">ยืนยันการลบผู้ใช้</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              คุณต้องการลบผู้ใช้ <strong className="text-gray-900">{displayName}</strong> ออกจากระบบ?
            </p>
            <p className="text-xs text-red-600 mb-4">
              การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลผู้ใช้จะถูกลบออกจากระบบถาวร
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader size={14} className="animate-spin mx-auto" /> : 'ลบผู้ใช้'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Edit Form ── */}
      {editing && (
        <div className="border-t border-indigo-100 bg-indigo-50/40 px-4 py-4 space-y-4">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">แก้ไขข้อมูลผู้ใช้</p>

          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">ชื่อ</label>
              <input type="text" value={form.firstName} onChange={set('firstName')}
                placeholder="ชื่อ"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">นามสกุล</label>
              <input type="text" value={form.lastName} onChange={set('lastName')}
                placeholder="นามสกุล"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
          </div>

          {/* Position + StaffCode row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Briefcase size={11} /> ตำแหน่ง
              </label>
              <input type="text" value={form.position} onChange={set('position')}
                placeholder="เช่น Software Engineer"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <KeyRound size={11} /> รหัสพนักงาน (Staff Code)
              </label>
              <input type="text" value={form.staffCode} onChange={set('staffCode')}
                placeholder="เช่น EMP001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono" />
              <p className="text-[10px] text-gray-400 mt-1">ใช้เชื่อมกับระบบ Evaluation (Hierarchy)</p>
            </div>
          </div>

          {/* Roles + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Role <span className="font-normal text-gray-400">(เลือกได้หลาย Role)</span>
              </label>
              <RoleMultiSelect selected={form.roles} onChange={(r) => setForm(p => ({ ...p, roles: r }))} />
              {!form.roles.length && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> กรุณาเลือก Role อย่างน้อย 1 อย่าง
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">สถานะบัญชี</label>
              <select value={form.status} onChange={set('status')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="approved">✅ อนุมัติแล้ว</option>
                <option value="pending">⏳ รอการอนุมัติ</option>
                <option value="rejected">❌ ปฏิเสธ</option>
              </select>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <Mail size={11} /> อีเมล <span className="font-normal">(ไม่สามารถแก้ไขได้)</span>
            </label>
            <input value={user.email || ''} disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.roles.length}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              บันทึกการเปลี่ยนแปลง
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main UserManagement Panel ──────────────────────────────────────────────────
export default function UserManagement() {
  const { userProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeAllUsers((list) => {
      setUsers(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      setLoading(false)
    })
    return unsub
  }, [])

  const pending  = users.filter(u => u.status === 'pending')
  const approved = users.filter(u => u.status === 'approved')
  const rejected = users.filter(u => u.status === 'rejected')

  const baseList = tab === 'pending' ? pending
    : tab === 'approved' ? approved
    : tab === 'rejected' ? rejected
    : users

  const displayed = search.trim()
    ? baseList.filter(u => {
        const q = search.toLowerCase()
        const name = [u.firstName, u.lastName].join(' ').toLowerCase()
        return name.includes(q) || (u.email || '').toLowerCase().includes(q) || (u.staffCode || '').toLowerCase().includes(q)
      })
    : baseList

  const TABS = [
    { id: 'all',      label: 'ผู้ใช้ทั้งหมด', count: users.length,    color: 'indigo' },
    { id: 'pending',  label: 'รออนุมัติ',      count: pending.length,  color: 'yellow' },
    { id: 'approved', label: 'อนุมัติแล้ว',    count: approved.length, color: 'green'  },
    { id: 'rejected', label: 'ปฏิเสธ',         count: rejected.length, color: 'red'    },
  ]

  const tabCountColor = {
    indigo: 'bg-indigo-100 text-indigo-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl">
            <Users size={22} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              ผู้ใช้ที่ลงทะเบียนในระบบ Firebase <strong className="text-indigo-600">{users.length}</strong> คน
              {pending.length > 0 && <> · <span className="text-yellow-600 font-semibold">รออนุมัติ {pending.length} คน</span></>}
            </p>
          </div>
        </div>
        {/* Reload hint */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <RefreshCw size={12} />
          <span>อัปเดตอัตโนมัติ (Real-time)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ${tabCountColor[t.color]}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ, อีเมล, รหัสพนักงาน..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
        <BadgeCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          ข้อมูลในส่วนนี้มาจาก <strong>Firebase Authentication</strong> — ผู้ใช้ที่สมัครหรือเข้าสู่ระบบผ่าน Google/Email
          · กำหนด <strong>Role</strong> และ <strong>รหัสพนักงาน</strong> เพื่อเชื่อมกับระบบ Evaluation
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader size={26} className="animate-spin text-indigo-500" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <User size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {search ? `ไม่พบผู้ใช้ที่ตรงกับ "${search}"` : 'ไม่มีผู้ใช้งานในหมวดนี้'}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-2 text-xs text-indigo-500 hover:underline">
              ล้างการค้นหา
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayed.map((user) => (
            <UserRow
              key={user.uid}
              user={user}
              isSelf={user.uid === userProfile?.uid}
              isMasterAdmin={userProfile?.roles?.includes('MasterAdmin')}
            />
          ))}
          <p className="text-xs text-gray-400 text-center pt-1">
            แสดง {displayed.length} จาก {baseList.length} รายการ
          </p>
        </div>
      )}
    </div>
  )
}
