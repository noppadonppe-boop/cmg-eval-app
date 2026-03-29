import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import useRBAC from '../hooks/useRBAC'
import { subscribePendingCount } from '../services/authService'
import UserManagement from './UserManagement'
import {
  LayoutDashboard, ClipboardList, Target, BookOpen, Settings, Users,
  CalendarDays, ChevronDown, LogOut, UserCircle2, Menu, X, Bell,
  Camera, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { updateUserProfile } from '../services/authService'

const NAV_LINKS = [
  { to: '/',       label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/eval',   label: 'Evaluations', icon: ClipboardList   },
  { to: '/kpi',    label: 'KPIs',        icon: Target          },
  { to: '/manual', label: 'Manual',      icon: BookOpen        },
  { to: '/admin',  label: 'Admin',       icon: Settings        },
]

const ROLE_BADGE = {
  MasterAdmin: 'bg-purple-100 text-purple-700',
  HR: 'bg-green-100 text-green-700',
  HRM: 'bg-teal-100 text-teal-700',
  GM: 'bg-orange-100 text-orange-700',
  MD: 'bg-red-100 text-red-700',
  Staff: 'bg-blue-100 text-blue-700',
  Viewer: 'bg-gray-100 text-gray-600',
  Creator: 'bg-pink-100 text-pink-700',
}

function ProfileAvatar({ user, size = 'md' }) {
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm'
  if (user?.photoURL) {
    return <img src={user.photoURL} alt="" className={`${cls} rounded-full object-cover border-2 border-white shadow-sm shrink-0`} />
  }
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase()
    || user?.name?.charAt(0)?.toUpperCase() || '?'
  return (
    <div className={`${cls} rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  )
}

export default function Layout() {
  const { userProfile, logout, firebaseUser, hasConfig } = useAuth()
  const { data, currentUser, selectedYear, setSelectedYear } = useApp()
  const { can, roles } = useRBAC()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showUserMgmt, setShowUserMgmt] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [profileDropOpen, setProfileDropOpen] = useState(false)
  const [yearDropOpen, setYearDropOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const profileDropRef = useRef(null)
  const yearDropRef = useRef(null)

  const isMasterAdmin = roles?.includes('MasterAdmin')
  const canSwitchYear = can('canManageYears')

  // Determine which nav links to show
  const isSupervisor = data?.staffConfigs?.some(c => c.supervisorId === currentUser?.id && c.year === selectedYear)
  const isAssignedStaff = data?.staffConfigs?.some(c => c.staffId === currentUser?.id && c.year === selectedYear)

  const navVisible = {
    '/eval': can('canSelfAssessCompetency') || can('canInputDiscipline') || can('canEvaluateJD') || isSupervisor || isAssignedStaff,
    '/kpi': can('canAssignKPI') || can('canRespondKPI') || can('canViewAllEvaluations') || isSupervisor || isAssignedStaff,
    '/admin': can('canViewAdmin'),
    '/manual': true,
    '/': true,
  }

  const kpiPendingCount = data?.kpis?.filter(
    k => k.staffId === currentUser?.id && k.year === selectedYear && k.status === 'Pending'
  ).length || 0

  // Subscribe to pending count (MasterAdmin only)
  useEffect(() => {
    if (!isMasterAdmin || !hasConfig) return
    return subscribePendingCount(setPendingCount)
  }, [isMasterAdmin, hasConfig])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileDropRef.current && !profileDropRef.current.contains(e.target)) setProfileDropOpen(false)
      if (yearDropRef.current && !yearDropRef.current.contains(e.target)) setYearDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile sidebar on nav
  useEffect(() => {
    setSidebarOpen(false)
    setShowUserMgmt(false)
  }, [location.pathname])

  const displayName = userProfile
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || userProfile.email
    : currentUser?.name || 'User'

  const displayRoles = userProfile?.roles || (currentUser?.roles ? currentUser.roles : [currentUser?.role].filter(Boolean))

  // ── Edit Profile Modal ────────────────────────────────────────────────────
  function EditProfileModal() {
    const [firstName, setFirstName] = useState(userProfile?.firstName || '')
    const [lastName, setLastName] = useState(userProfile?.lastName || '')
    const [position, setPosition] = useState(userProfile?.position || '')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
      if (!userProfile?.uid) return
      setSaving(true)
      await updateUserProfile(userProfile.uid, { firstName, lastName, position }).catch(() => {})
      setSaving(false)
      setEditProfileOpen(false)
    }

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">แก้ไขโปรไฟล์</h3>
            <button onClick={() => setEditProfileOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          {/* Avatar preview */}
          <div className="flex items-center gap-3 mb-4">
            <ProfileAvatar user={userProfile} size="lg" />
            <div className="text-xs text-gray-400">
              {userProfile?.photoURL ? 'รูปโปรไฟล์จาก Google' : 'ไม่มีรูปโปรไฟล์'}
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ชื่อ</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">นามสกุล</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ตำแหน่ง</label>
              <input value={position} onChange={e => setPosition(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">อีเมล</label>
              <input value={userProfile?.email || firebaseUser?.email || ''} disabled
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => setEditProfileOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop Sidebar (expanded / collapsed) ──────────────────────────────
  function DesktopSidebar() {
    const collapsed = sidebarCollapsed

    return (
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center border-b border-gray-100 ${collapsed ? 'justify-center px-2 py-4' : 'gap-2.5 px-5 py-4'}`}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">CMG</span>
            </div>
            {!collapsed && (
              <span className="font-semibold text-gray-900 text-sm whitespace-nowrap overflow-hidden">
                Performance Eval
              </span>
            )}
          </div>

          {/* Profile Card */}
          {collapsed ? (
            <div className="flex justify-center py-4">
              <ProfileAvatar user={userProfile || currentUser} size="md" />
            </div>
          ) : (
            <div className="mx-3 mt-4 mb-2 p-3 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2.5">
                <ProfileAvatar user={userProfile || currentUser} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {displayRoles.slice(0, 2).map((r) => (
                      <span key={r} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[r] || 'bg-gray-100 text-gray-600'}`}>
                        {r}
                      </span>
                    ))}
                    {displayRoles.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{displayRoles.length - 2}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav Links */}
          <nav className={`flex-1 py-2 space-y-0.5 overflow-y-auto sidebar-scroll ${collapsed ? 'px-1.5' : 'px-3'}`}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 mt-1">เมนูหลัก</p>
            )}
            {NAV_LINKS.filter((l) => navVisible[l.to] !== false).map((link) => {
              const Icon = link.icon
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setShowUserMgmt(false)}
                  title={collapsed ? link.label : undefined}
                  className={`group relative flex items-center rounded-xl text-sm font-medium transition-all ${
                    collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive && !showUserMgmt
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
                  }`}
                >
                  <Icon size={18} className={`shrink-0 ${isActive && !showUserMgmt ? 'text-white' : 'text-gray-400'}`} />
                  {!collapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">{link.label}</span>}
                  
                  {/* KPI Pending Badge (Expanded) */}
                  {!collapsed && link.to === '/kpi' && kpiPendingCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center ${
                      isActive && !showUserMgmt ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
                    }`}>
                      {kpiPendingCount > 99 ? '99+' : kpiPendingCount}
                    </span>
                  )}
                  {/* KPI Pending Badge (Collapsed) */}
                  {collapsed && link.to === '/kpi' && kpiPendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                      {kpiPendingCount > 9 ? '9+' : kpiPendingCount}
                    </span>
                  )}

                  {/* Tooltip on collapsed */}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                      {link.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User Management (MasterAdmin only) */}
          {isMasterAdmin && (
            <div className={`border-t border-gray-100 pt-2 pb-3 ${collapsed ? 'px-1.5' : 'px-3'}`}>
              <button
                onClick={() => setShowUserMgmt((v) => !v)}
                title={collapsed ? 'จัดการผู้ใช้งาน' : undefined}
                className={`group relative w-full flex items-center rounded-xl text-sm font-medium transition-all ${
                  collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  showUserMgmt
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Users size={18} className={`shrink-0 ${showUserMgmt ? 'text-white' : 'text-gray-400'}`} />
                {!collapsed && <span className="flex-1 text-left whitespace-nowrap">จัดการผู้ใช้งาน</span>}
                {!collapsed && pendingCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center ${
                    showUserMgmt ? 'bg-white text-indigo-600' : 'bg-yellow-400 text-white'
                  }`}>
                    {pendingCount}
                  </span>
                )}
                {collapsed && pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-yellow-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    จัดการผู้ใช้งาน
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Collapse / Expand Toggle */}
          <div className="border-t border-gray-100 px-3 py-2">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className={`w-full flex items-center rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all ${
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
              }`}
              title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
            >
              {collapsed
                ? <ChevronsRight size={18} className="shrink-0" />
                : <ChevronsLeft size={18} className="shrink-0" />
              }
              {!collapsed && <span className="text-xs whitespace-nowrap">ย่อเมนู</span>}
            </button>
          </div>
        </div>
      </aside>
    )
  }

  // ── Mobile Sidebar Content (always expanded) ────────────────────────────
  function MobileSidebarContent() {
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">CMG</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Performance Eval</span>
        </div>

        {/* Profile Card */}
        <div className="mx-3 mt-4 mb-2 p-3 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100">
          <div className="flex items-center gap-2.5">
            <ProfileAvatar user={userProfile || currentUser} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {displayRoles.slice(0, 2).map((r) => (
                  <span key={r} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[r] || 'bg-gray-100 text-gray-600'}`}>
                    {r}
                  </span>
                ))}
                {displayRoles.length > 2 && (
                  <span className="text-[10px] text-gray-400">+{displayRoles.length - 2}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto sidebar-scroll">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 mt-1">เมนูหลัก</p>
          {NAV_LINKS.filter((l) => navVisible[l.to] !== false).map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => { setSidebarOpen(false); setShowUserMgmt(false) }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive && !showUserMgmt
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
                }`}
              >
                <Icon size={18} className={isActive && !showUserMgmt ? 'text-white' : 'text-gray-400'} />
                <span className="flex-1">{link.label}</span>
                {link.to === '/kpi' && kpiPendingCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center ${
                    isActive && !showUserMgmt ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
                  }`}>
                    {kpiPendingCount > 99 ? '99+' : kpiPendingCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Management (MasterAdmin only) */}
        {isMasterAdmin && (
          <div className="px-3 pb-3 border-t border-gray-100 pt-2">
            <button
              onClick={() => { setShowUserMgmt((v) => !v); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                showUserMgmt
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Users size={16} className={showUserMgmt ? 'text-white' : 'text-gray-400'} />
              <span className="flex-1 text-left">จัดการผู้ใช้งาน</span>
              {pendingCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center ${
                  showUserMgmt ? 'bg-white text-indigo-600' : 'bg-yellow-400 text-white'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
      <DesktopSidebar />

      {/* ── Mobile Sidebar Overlay ───────────────────────────────────────── */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 md:hidden flex flex-col shadow-2xl sidebar-mobile-enter">
            {/* Close button inside sidebar */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 z-10"
            >
              <X size={18} />
            </button>
            <MobileSidebarContent />
          </aside>
        </>
      )}

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <Menu size={20} />
          </button>

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">CMG</span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Year Selector */}
          <div className="relative" ref={yearDropRef}>
            <button
              onClick={() => {
                if (!canSwitchYear) return
                setYearDropOpen((v) => !v)
                setProfileDropOpen(false)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-sm font-medium transition-all ${
                canSwitchYear
                  ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <CalendarDays size={14} className="text-indigo-500" />
              <span className="text-indigo-600 font-semibold">{selectedYear}</span>
              {canSwitchYear && (
                <ChevronDown size={12} className={`text-gray-400 transition-transform ${yearDropOpen ? 'rotate-180' : ''}`} />
              )}
            </button>
            {canSwitchYear && yearDropOpen && (
              <div className="absolute right-0 mt-1.5 w-32 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <p className="px-3 pt-1.5 pb-1 text-xs text-gray-400 font-semibold uppercase tracking-wide">ปี</p>
                {(data?.evaluationYears || []).map((yr) => (
                  <button key={yr} onClick={() => { setSelectedYear(yr); setYearDropOpen(false) }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${yr === selectedYear ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {yr}
                    {yr === selectedYear && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileDropRef}>
            <button
              onClick={() => { setProfileDropOpen(v => !v); setYearDropOpen(false) }}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
            >
              <ProfileAvatar user={userProfile || currentUser} size="sm" />
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-xs font-semibold text-gray-900">{displayName}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{displayRoles[0] || 'Staff'}</span>
              </div>
              <ChevronDown size={12} className={`text-gray-400 transition-transform ${profileDropOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileDropOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
                  <ProfileAvatar user={userProfile || currentUser} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{userProfile?.email || firebaseUser?.email || ''}</p>
                  </div>
                </div>
                <div className="py-1">
                  {hasConfig && (
                    <button onClick={() => { setEditProfileOpen(true); setProfileDropOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <UserCircle2 size={15} className="text-gray-400" />
                      แก้ไขโปรไฟล์
                    </button>
                  )}
                  {hasConfig && (
                    <button onClick={() => { logout(); setProfileDropOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut size={15} className="text-red-400" />
                      ออกจากระบบ
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            {showUserMgmt ? <UserManagement /> : <Outlet />}
          </div>
        </main>
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && <EditProfileModal />}
    </div>
  )
}
