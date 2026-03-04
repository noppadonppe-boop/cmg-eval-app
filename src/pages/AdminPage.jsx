import { useState } from 'react'
import { Settings, CalendarDays, Users, GitBranch, ShieldOff } from 'lucide-react'
import useRBAC from '../hooks/useRBAC'
import { useApp } from '../context/AppContext'
import YearsTab from '../components/admin/YearsTab'
import UsersTab from '../components/admin/UsersTab'
import HierarchyTab from '../components/admin/HierarchyTab'

const TABS = [
  { id: 'years',     label: 'Evaluation Years', icon: <CalendarDays size={15} /> },
  { id: 'users',     label: 'Users',             icon: <Users size={15} /> },
  { id: 'hierarchy', label: 'Hierarchy',          icon: <GitBranch size={15} /> },
]

export default function AdminPage() {
  const { can } = useRBAC()
  const { selectedYear } = useApp()
  const [activeTab, setActiveTab] = useState('years')

  if (!can('canViewAdmin')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-red-50 p-4 rounded-2xl mb-4">
          <ShieldOff size={32} className="text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Access Restricted</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Only HR and Executive users can access the Admin Management module.
          Switch your user role in the navbar to continue.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-2.5 rounded-xl">
            <Settings size={22} className="text-gray-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage users, evaluation years, and staff hierarchy</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
          <CalendarDays size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-700">Active Year: {selectedYear}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
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
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'years'     && <YearsTab />}
      {activeTab === 'users'     && <UsersTab />}
      {activeTab === 'hierarchy' && <HierarchyTab />}
    </div>
  )
}
