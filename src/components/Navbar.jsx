import { useApp } from '../context/AppContext'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Settings, ChevronDown, CalendarDays, UserCircle2, Target, ClipboardList } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import useRBAC, { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../hooks/useRBAC'

export default function Navbar() {
  const { data, currentUser, setCurrentUser, selectedYear, setSelectedYear } = useApp()
  const { can } = useRBAC()
  const location = useLocation()
  const [userOpen, setUserOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const userRef = useRef(null)
  const yearRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
      if (yearRef.current && !yearRef.current.contains(e.target)) setYearOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const navLinks = [
    { to: '/',      label: 'Dashboard',   icon: <LayoutDashboard size={16} />, show: true },
    { to: '/eval',  label: 'Evaluations', icon: <ClipboardList size={16} />,   show: can('canSelfAssessCompetency') || can('canEvaluateOthersCompetency') || can('canInputDiscipline') || can('canEvaluateJD') },
    { to: '/kpi',   label: 'KPIs',        icon: <Target size={16} />,          show: can('canAssignKPI') || can('canRespondKPI') || can('canViewAllEvaluations') },
    { to: '/manual', label: 'Manual',     icon: <BookOpen size={16} />,        show: true },
    { to: '/admin', label: 'Admin',       icon: <Settings size={16} />,        show: can('canViewAdmin') },
  ].filter((l) => l.show)

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">CMG</span>
              </div>
              <span className="font-semibold text-gray-900 text-sm hidden sm:block">
                Performance Evaluation
              </span>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">

            {/* Year Selector */}
            <div className="relative" ref={yearRef}>
              <button
                onClick={() => { setYearOpen((v) => !v); setUserOpen(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <CalendarDays size={14} className="text-indigo-500" />
                <span className="text-indigo-600 font-semibold">{selectedYear}</span>
                <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${yearOpen ? 'rotate-180' : ''}`} />
              </button>
              {yearOpen && (
                <div className="absolute right-0 mt-1.5 w-32 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  <p className="px-3 pt-1.5 pb-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Year</p>
                  {data.evaluationYears.map((yr) => (
                    <button
                      key={yr}
                      onClick={() => { setSelectedYear(yr); setYearOpen(false) }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                        yr === selectedYear
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {yr}
                      {yr === selectedYear && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Switcher */}
            <div className="relative" ref={userRef}>
              <button
                onClick={() => { setUserOpen((v) => !v); setYearOpen(false) }}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <div className={`w-7 h-7 rounded-full ${ROLE_AVATAR_BG[currentUser.role] || 'bg-indigo-500'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none">
                  <span className="text-xs font-semibold text-gray-900">{currentUser.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 mt-0.5 ${ROLE_BADGE_CLASSES[currentUser.role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                    {currentUser.role}
                  </span>
                </div>
                <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${userOpen ? 'rotate-180' : ''}`} />
              </button>

              {userOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
                    <UserCircle2 size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Switch User</span>
                  </div>
                  <div className="py-1">
                    {data.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => { setCurrentUser(user); setUserOpen(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          user.id === currentUser.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full ${ROLE_AVATAR_BG[user.role] || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {user.name.charAt(0)}
                        </div>
                        <div className="flex flex-col items-start leading-none gap-1 min-w-0">
                          <span className={`text-sm font-semibold truncate ${user.id === currentUser.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                            {user.name}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${ROLE_BADGE_CLASSES[user.role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                            {user.role}
                          </span>
                        </div>
                        {user.id === currentUser.id && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
