import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { subscribeToRoot, writeRoot, seedIfEmpty, persistUpdate, hasConfig } from '../services/firestoreService'

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

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(INITIAL_DATA.users[0])
  const [selectedYear, setSelectedYear] = useState(2025)
  const initialCurrentUserSet = useRef(false)

  // Optimistic update + Transaction: อัปเดต UI ทันที แล้วเขียนแบบ merge กับข้อมูลล่าสุดใน Firestore
  // ไม่ให้การบันทึกของคนหนึ่งเขียนทับข้อมูลที่อีกคนกำลังกรอก/บันทึก
  const setDataAndPersist = (updater) => {
    setData((prev) => updater(prev))
    if (hasConfig) {
      persistUpdate(updater).catch((e) => console.error('Firestore write error:', e))
    }
  }

  const updateData = (updater) => setDataAndPersist(updater)

  useEffect(() => {
    if (!hasConfig) {
      setData(INITIAL_DATA)
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
      done = true
      setData(remote)
      if (!initialCurrentUserSet.current && remote.users?.length) {
        initialCurrentUserSet.current = true
        const first = remote.users[0]
        setCurrentUser((prev) => remote.users.find((u) => u.id === prev?.id) || first)
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
      if (!prev) return prev
      if (prev.evaluationYears.includes(newYear)) return prev
      const lastYear = Math.max(...prev.evaluationYears)
      const clonedConfigs = prev.staffConfigs
        .filter((c) => c.year === lastYear)
        .map((c) => ({
          ...c,
          id: `cfg_${Date.now()}_${c.staffId}`,
          year: newYear,
        }))
      return {
        ...prev,
        evaluationYears: [...prev.evaluationYears, newYear].sort((a, b) => a - b),
        staffConfigs: [...prev.staffConfigs, ...clonedConfigs],
      }
    })
  }

  const addStaffConfig = (config) => {
    setDataAndPersist((prev) => ({
      ...prev,
      staffConfigs: [...(prev?.staffConfigs ?? []), { ...config, id: `cfg_${Date.now()}` }],
    }))
  }

  const updateStaffConfig = (id, updates) => {
    setDataAndPersist((prev) => ({
      ...prev,
      staffConfigs: (prev?.staffConfigs ?? []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
  }

  const removeStaffConfig = (id) => {
    setDataAndPersist((prev) => ({
      ...prev,
      staffConfigs: (prev?.staffConfigs ?? []).filter((c) => c.id !== id),
    }))
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
    setDataAndPersist((prev) => ({
      ...prev,
      kpis: [
        ...(prev?.kpis ?? []),
        {
          id: `kpi_${Date.now()}`,
          status: 'Pending',
          rejectReason: '',
          createdAt: new Date().toISOString(),
          ...kpi,
        },
      ],
    }))
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

  /** สำหรับ Part 2 (วินัย): หา record ตาม staff/quarter/part เท่านั้น (ไม่สน evaluatorId) เพื่อให้ Supervisor/Staff ดูข้อมูลที่ HR กรอกได้ */
  const getEvaluationForPart = (year, quarter, staffId, part) =>
    (data?.quarterlyEvaluations ?? []).find(
      (e) =>
        e.year === year &&
        e.quarter === quarter &&
        e.staffId === staffId &&
        e.part === part
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

  if (loading || data === null) {
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
