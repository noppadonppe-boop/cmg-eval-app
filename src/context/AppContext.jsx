import { createContext, useContext, useState } from 'react'

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
  const [data, setData] = useState(INITIAL_DATA)
  const [currentUser, setCurrentUser] = useState(INITIAL_DATA.users[0])
  const [selectedYear, setSelectedYear] = useState(2025)

  const updateData = (updater) => setData((prev) => updater(prev))

  const addYear = (newYear) => {
    setData((prev) => {
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
    setData((prev) => ({
      ...prev,
      staffConfigs: [...prev.staffConfigs, { ...config, id: `cfg_${Date.now()}` }],
    }))
  }

  const updateStaffConfig = (id, updates) => {
    setData((prev) => ({
      ...prev,
      staffConfigs: prev.staffConfigs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
  }

  const removeStaffConfig = (id) => {
    setData((prev) => ({
      ...prev,
      staffConfigs: prev.staffConfigs.filter((c) => c.id !== id),
    }))
  }

  const addUser = (user) => {
    setData((prev) => ({
      ...prev,
      users: [...prev.users, { ...user, id: `u_${Date.now()}` }],
    }))
  }

  const updateUser = (id, updates) => {
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }))
  }

  const removeUser = (id) => {
    setData((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== id),
    }))
  }

  const getConfigForStaff = (staffId, year) =>
    data.staffConfigs.find((c) => c.staffId === staffId && c.year === year) || null

  const getStaffForSupervisor = (supervisorId, year) =>
    data.staffConfigs
      .filter((c) => c.supervisorId === supervisorId && c.year === year)
      .map((c) => data.users.find((u) => u.id === c.staffId))
      .filter(Boolean)

  const getUserById = (id) => data.users.find((u) => u.id === id) || null

  const addKpi = (kpi) => {
    setData((prev) => ({
      ...prev,
      kpis: [
        ...prev.kpis,
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
    setData((prev) => ({
      ...prev,
      kpis: prev.kpis.map((k) => (k.id === id ? { ...k, ...updates } : k)),
    }))
  }

  const removeKpi = (id) => {
    setData((prev) => ({
      ...prev,
      kpis: prev.kpis.filter((k) => k.id !== id),
    }))
  }

  const saveEvaluation = (evalRecord) => {
    setData((prev) => {
      const idx = prev.quarterlyEvaluations.findIndex(
        (e) =>
          e.year === evalRecord.year &&
          e.quarter === evalRecord.quarter &&
          e.staffId === evalRecord.staffId &&
          e.evaluatorId === evalRecord.evaluatorId &&
          e.part === evalRecord.part
      )
      if (idx >= 0) {
        const updated = [...prev.quarterlyEvaluations]
        updated[idx] = { ...updated[idx], ...evalRecord, updatedAt: new Date().toISOString() }
        return { ...prev, quarterlyEvaluations: updated }
      }
      return {
        ...prev,
        quarterlyEvaluations: [
          ...prev.quarterlyEvaluations,
          { id: `eval_${Date.now()}`, createdAt: new Date().toISOString(), ...evalRecord },
        ],
      }
    })
  }

  const getEvaluation = (year, quarter, staffId, evaluatorId, part) =>
    data.quarterlyEvaluations.find(
      (e) =>
        e.year === year &&
        e.quarter === quarter &&
        e.staffId === staffId &&
        e.evaluatorId === evaluatorId &&
        e.part === part
    ) || null

  const respondKpi = (id, response, reason = '') => {
    setData((prev) => ({
      ...prev,
      kpis: prev.kpis.map((k) =>
        k.id === id
          ? { ...k, status: response, rejectReason: reason, respondedAt: new Date().toISOString() }
          : k
      ),
    }))
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
