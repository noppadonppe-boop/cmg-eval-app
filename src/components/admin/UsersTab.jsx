import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import { UserPlus, Pencil, Trash2, Check, X, AlertCircle, ExternalLink, IdCard } from 'lucide-react'

const ROLES = ['Staff', 'HR', 'HRM', 'GM', 'MD']

const BLANK_FORM = { name: '', role: 'Staff', staffCode: '', jdUrl: '' }

function UserRow({ user, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR_BG[user.role] || 'bg-gray-400'} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
          {user.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{user.id}</span>
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

export default function UsersTab() {
  const { data, addUser, updateUser, removeUser } = useApp()
  const [form, setForm] = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Name is required.'); return }
    const payload = {
      name: form.name.trim(),
      role: form.role,
      staffCode: form.staffCode.trim(),
      jdUrl: form.jdUrl.trim(),
    }
    if (editingId) {
      updateUser(editingId, payload)
    } else {
      addUser(payload)
    }
    setForm(BLANK_FORM)
    setEditingId(null)
    setError('')
  }

  const handleEdit = (user) => {
    setForm({ name: user.name, role: user.role, staffCode: user.staffCode ?? '', jdUrl: user.jdUrl ?? '' })
    setEditingId(user.id)
    setError('')
  }

  const handleCancel = () => {
    setForm(BLANK_FORM)
    setEditingId(null)
    setError('')
  }

  const handleDelete = (id) => setConfirmDelete(id)

  const confirmDeleteUser = () => {
    removeUser(confirmDelete)
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Delete User</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will permanently remove <strong>{data.users.find(u => u.id === confirmDelete)?.name}</strong> and all their associated configurations. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmDeleteUser} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {editingId ? 'Edit User' : 'Add New User'}
        </h3>
        {error && (
          <div className="flex items-center gap-2 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Staff ID</label>
            <input
              type="text"
              value={form.staffCode}
              onChange={(e) => setForm({ ...form, staffCode: e.target.value })}
              placeholder="e.g. EMP001"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">JD Attachment URL</label>
            <input
              type="url"
              value={form.jdUrl}
              onChange={(e) => setForm({ ...form, jdUrl: e.target.value })}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {editingId ? <><Check size={14} /> Save</> : <><UserPlus size={14} /> Add User</>}
              </button>
              {editingId && (
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
                  <X size={14} /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">All Users</h3>
            <p className="text-xs text-gray-500 mt-0.5">{data.users.length} user(s) registered</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => {
              const count = data.users.filter(u => u.role === r).length
              if (!count) return null
              return (
                <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[r]}`}>
                  {count} {r}
                </span>
              )
            })}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {data.users.map((user) => (
            <UserRow key={user.id} user={user} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  )
}
