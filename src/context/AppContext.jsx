import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { subscribeToRoot, seedIfEmpty, persistUpdate, hasConfig } from '../services/firestoreService'
import { useAuth } from './AuthContext'

const INITIAL_DATA = {
  users: [
    { id: 'u1', name: 'Staff A',   role: 'Staff', staffCode: 'EMP001', jdUrl: '' },
    { id: 'u2', name: 'Staff B',   role: 'Staff', staffCode: 'EMP002', jdUrl: '' },
    { id: 'u3', name: 'Staff C',   role: 'Staff', staffCode: 'EMP003', jdUrl: '' },
    { id: 'u4', name: 'HR Admin',  role: 'HR',    staffCode: 'EMP004', jdUrl: '' },
    { id: 'u5', name: 'HRM D',     role: 'HRM',   staffCode: 'EMP005', jdUrl: '' },
    { id: 'u6', name: 'GM E',      role: 'GM',    staffCode: 'EMP006', jdUrl: '' },
    { id: 'u7', name: 'MD F',      role: 'MD',    staffCode: 'EMP007', jdUrl: '' },
  ],
  evaluationYears: [2025, 2026],
  activeYear: 2026,
  activeQuarter: 'Q1',
  staffConfigs: [
    {
      id: 'cfg_1',
      year: 2025,
      staffId: 'u1',
      supervisorId: 'u2',
      stakeholderIds: ['u3'],
      leaveQuota: 10,
    },
  ],
  kpis: [],
  quarterlyEvaluations: [],
}

/** ลำดับความสำคัญของ Role สำหรับเลือก primary role */
const ROLE_PRIORITY = ['MasterAdmin', 'MD', 'GM', 'HRM', 'HR', 'Creator', 'Staff', 'Viewer']

function getPrimaryRole(roles) {
  if (!Array.isArray(roles) || !roles.length) return 'Staff'
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r
  }
  return roles[0]
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { userProfile, authLoading } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialCurrentUserSet = useRef(false)

  // Derive currentUser from Firebase auth profile, or fall back to mock user
  const buildAuthUser = (profile) => {
    if (!profile) return null
    return {
      id: profile.uid,
      name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'User',
      role: getPrimaryRole(profile.roles),
      roles: profile.roles || ['Staff'],
      staffCode: profile.staffCode || '',
      photoURL: profile.photoURL || '',
      jdUrl: '',
    }
  }

  const [currentUser, setCurrentUser] = useState(
    userProfile ? buildAuthUser(userProfile) : INITIAL_DATA.users[0]
  )

  const getEffectiveActiveYear = (d) => {
    const years = Array.isArray(d?.evaluationYears) ? d.evaluationYears : []
    if (years.length === 0) return null
    const fallback = Math.max(...years)
    const ay = typeof d?.activeYear === 'number' ? d.activeYear : fallback
    return years.includes(ay) ? ay : fallback
  }

  const getEffectiveActiveQuarter = (d) => {
    const q = String(d?.activeQuarter || '').toUpperCase()
    return q === 'Q1' || q === 'Q2' || q === 'Q3' || q === 'Q4' ? q : 'Q1'
  }

  const canManageYears = (user) => {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role || 'Staff']
    return roles.some((r) => r === 'HR' || r === 'HRM' || r === 'GM' || r === 'MasterAdmin')
  }

  const selectedYear = getEffectiveActiveYear(data)
  const activeQuarter = getEffectiveActiveQuarter(data)

  const setSelectedYear = (year) => {
    if (!canManageYears(currentUser)) return
    const yr = typeof year === 'number' ? year : parseInt(String(year), 10)
    if (!yr) return
    setDataAndPersist((prev) => {
      if (!prev) return prev
      if (!Array.isArray(prev.evaluationYears) || !prev.evaluationYears.includes(yr)) return prev
      if (prev.activeYear === yr) return prev
      return { ...prev, activeYear: yr }
    })
  }

  const setActiveQuarter = (q) => {
    if (!canManageYears(currentUser)) return
    const next = String(q || '').toUpperCase()
    if (!(next === 'Q1' || next === 'Q2' || next === 'Q3' || next === 'Q4')) return
    setDataAndPersist((prev) => {
      if (!prev) return prev
      if (prev.activeQuarter === next) return prev
      return { ...prev, activeQuarter: next }
    })
  }

  // Sync currentUser when auth profile changes
  useEffect(() => {
    if (!hasConfig) return
    if (userProfile) {
      setCurrentUser(buildAuthUser(userProfile))
    }
  }, [userProfile?.uid, userProfile?.roles?.join(), userProfile?.firstName, userProfile?.lastName])

  // Persist to Firestore (Transaction-based to prevent overwrites)
  const setDataAndPersist = (updater) => {
    setData((prev) => updater(prev))
    if (hasConfig) {
      persistUpdate(updater).catch((e) => console.error('Firestore write error:', e))
    }
  }

  const updateData = (updater) => setDataAndPersist(updater)

  useEffect(() => {
    if (!hasConfig) {
      setData((prev) => prev ?? INITIAL_DATA)
      setLoading(false)
      return
    }
    let done = false
    const fallbackTimer = setTimeout(() => {
      if (done) return
      setData((prev) => prev ?? INITIAL_DATA)
      setLoading(false)
    }, 8000)
    const unsub = subscribeToRoot((remote) => {
      if (remote === null) {
        seedIfEmpty(INITIAL_DATA).then(() => {})
        return
      }
      const isEmpty = !remote.users?.length && !remote.evaluationYears?.length
      if (isEmpty) {
        seedIfEmpty(INITIAL_DATA).then(() => {})
        return
      }
      const normalizedActiveYear = getEffectiveActiveYear(remote)
      if (normalizedActiveYear !== remote.activeYear) {
        persistUpdate((cur) => {
          const curEffective = getEffectiveActiveYear(cur)
          if (curEffective === cur.activeYear) return cur
          return { ...cur, activeYear: curEffective }
        }).catch(() => {})
      }
      const normalizedActiveQuarter = getEffectiveActiveQuarter(remote)
      if (normalizedActiveQuarter !== remote.activeQuarter) {
        persistUpdate((cur) => {
          const curEffective = getEffectiveActiveQuarter(cur)
          if (curEffective === cur.activeQuarter) return cur
          return { ...cur, activeQuarter: curEffective }
        }).catch(() => {})
      }
      done = true
      setData({ ...remote, activeYear: normalizedActiveYear, activeQuarter: normalizedActiveQuarter })
      if (!initialCurrentUserSet.current && remote.users?.length && !userProfile) {
        initialCurrentUserSet.current = true
        setCurrentUser(remote.users[0])
      }
      setLoading(false)
    })
    return () => {
      done = true
      clearTimeout(fallbackTimer)
      unsub()
    }
  }, [])

  const addYear = (newYear) => {
    setDataAndPersist((prev) => {
      if (!prev || prev.evaluationYears.includes(newYear)) return prev
      const lastYear = Math.max(...prev.evaluationYears)
      const clonedConfigs = prev.staffConfigs
        .filter((c) => c.year === lastYear)
        .map((c) => ({ ...c, id: `cfg_${Date.now()}_${c.staffId}`, year: newYear }))
      return {
        ...prev,
        evaluationYears: [...prev.evaluationYears, newYear].sort((a, b) => a - b),
        staffConfigs: [...prev.staffConfigs, ...clonedConfigs],
      }
    })
  }

  const addStaffConfig = (config) => {
    const id = config?.id || `cfg_${Date.now()}_${Math.random().toString(16).slice(2)}`
    setDataAndPersist((prev) => {
      if (!prev) return prev
      const prevCfgs = prev?.staffConfigs ?? []
      const staffId = config?.staffId
      const year = config?.year
      if (prevCfgs.some((c) => c.id === id)) return prev
      if (!staffId || !year) return prev
      const existingIdx = prevCfgs.findIndex((c) => c.staffId === staffId && c.year === year)
      if (existingIdx >= 0) {
        const updated = [...prevCfgs]
        updated[existingIdx] = { ...updated[existingIdx], ...config, id: updated[existingIdx].id }
        return { ...prev, staffConfigs: updated }
      }
      return {
        ...prev,
        staffConfigs: [...prevCfgs, { ...config, id }],
      }
    })
  }

  const updateStaffConfig = (key, updates) => {
    setDataAndPersist((prev) => {
      if (!prev) return prev
      const cfgs = prev?.staffConfigs ?? []
      if (typeof key === 'string') {
        return {
          ...prev,
          staffConfigs: cfgs.map((c) => (c.id === key ? { ...c, ...updates } : c)),
        }
      }
      const staffId = key?.staffId
      const year = key?.year
      if (!staffId || !year) return prev
      return {
        ...prev,
        staffConfigs: cfgs.map((c) => (
          c.staffId === staffId && c.year === year ? { ...c, ...updates } : c
        )),
      }
    })
  }

  const removeStaffConfig = (key) => {
    setDataAndPersist((prev) => {
      if (!prev) return prev
      const cfgs = prev?.staffConfigs ?? []
      if (typeof key === 'string') {
        return {
          ...prev,
          staffConfigs: cfgs.filter((c) => c.id !== key),
        }
      }
      const staffId = key?.staffId
      const year = key?.year
      if (!staffId || !year) return prev
      return {
        ...prev,
        staffConfigs: cfgs.filter((c) => !(c.staffId === staffId && c.year === year)),
      }
    })
  }

  const addUser = (user) => {
    setDataAndPersist((prev) => ({
      ...prev,
      users: [...(prev?.users ?? []), { ...user, id: `u_${Date.now()}` }],
    }))
  }

  const updateUser = (id, updates) => {
    setDataAndPersist((prev) => ({
      ...prev,
      users: (prev?.users ?? []).map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }))
  }

  const removeUser = (id) => {
    setDataAndPersist((prev) => ({
      ...prev,
      users: (prev?.users ?? []).filter((u) => u.id !== id),
    }))
  }

  const getConfigForStaff = (staffId, year) =>
    (data?.staffConfigs ?? []).find((c) => c.staffId === staffId && c.year === year) || null

  const getStaffForSupervisor = (supervisorId, year) =>
    (data?.staffConfigs ?? [])
      .filter((c) => c.supervisorId === supervisorId && c.year === year)
      .map((c) => (data?.users ?? []).find((u) => u.id === c.staffId))
      .filter(Boolean)

  const getUserById = (id) => (data?.users ?? []).find((u) => u.id === id) || null

  const addKpi = (kpi) => {
    const id = kpi?.id || `kpi_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const createdAt = kpi?.createdAt || new Date().toISOString()
    setDataAndPersist((prev) => {
      if (!prev) return prev
      const prevKpis = prev?.kpis ?? []
      if (prevKpis.some((x) => x.id === id)) return prev
      return {
        ...prev,
        kpis: [
          ...prevKpis,
          { ...kpi, id, status: 'Pending', rejectReason: '', createdAt },
        ],
      }
    })
  }

  const updateKpi = (id, updates) => {
    setDataAndPersist((prev) => ({
      ...prev,
      kpis: (prev?.kpis ?? []).map((k) => (k.id === id ? { ...k, ...updates } : k)),
    }))
  }

  const removeKpi = (id) => {
    setDataAndPersist((prev) => ({
      ...prev,
      kpis: (prev?.kpis ?? []).filter((k) => k.id !== id),
    }))
  }

  const saveEvaluation = (evalRecord) => {
    setDataAndPersist((prev) => {
      const evals = prev?.quarterlyEvaluations ?? []
      const idx = evals.findIndex(
        (e) =>
          e.year === evalRecord.year &&
          e.quarter === evalRecord.quarter &&
          e.staffId === evalRecord.staffId &&
          e.evaluatorId === evalRecord.evaluatorId &&
          e.part === evalRecord.part
      )
      if (idx >= 0) {
        const updated = [...evals]
        updated[idx] = { ...updated[idx], ...evalRecord, updatedAt: new Date().toISOString() }
        return { ...prev, quarterlyEvaluations: updated }
      }
      return {
        ...prev,
        quarterlyEvaluations: [
          ...evals,
          { id: `eval_${Date.now()}`, createdAt: new Date().toISOString(), ...evalRecord },
        ],
      }
    })
  }

  const getEvaluation = (year, quarter, staffId, evaluatorId, part) =>
    (data?.quarterlyEvaluations ?? []).find(
      (e) =>
        e.year === year &&
        e.quarter === quarter &&
        e.staffId === staffId &&
        e.evaluatorId === evaluatorId &&
        e.part === part
    ) || null

  const getEvaluationForPart = (year, quarter, staffId, part) =>
    (data?.quarterlyEvaluations ?? []).find(
      (e) => e.year === year && e.quarter === quarter && e.staffId === staffId && e.part === part
    ) || null

  const respondKpi = (id, response, reason = '') => {
    setDataAndPersist((prev) => ({
      ...prev,
      kpis: (prev?.kpis ?? []).map((k) =>
        k.id === id
          ? { ...k, status: response, rejectReason: reason, respondedAt: new Date().toISOString() }
          : k
      ),
    }))
  }

  const resetEvaluationsForYear = (year) => {
    const yr = typeof year === 'number' ? year : parseInt(String(year), 10)
    if (!yr) return
    setDataAndPersist((prev) => ({
      ...prev,
      kpis: (prev?.kpis ?? []).filter((k) => k.year !== yr),
      quarterlyEvaluations: (prev?.quarterlyEvaluations ?? []).filter((e) => e.year !== yr),
    }))
  }

  // Show loading while Firebase auth or app data is loading
  if (authLoading || loading || data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <AppContext.Provider
      value={{
        data,
        currentUser,
        setCurrentUser,
        selectedYear,
        setSelectedYear,
        activeQuarter,
        setActiveQuarter,
        updateData,
        addYear,
        addStaffConfig,
        updateStaffConfig,
        removeStaffConfig,
        addUser,
        updateUser,
        removeUser,
        getConfigForStaff,
        getStaffForSupervisor,
        getUserById,
        addKpi,
        updateKpi,
        removeKpi,
        respondKpi,
        resetEvaluationsForYear,
        saveEvaluation,
        getEvaluation,
        getEvaluationForPart,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
