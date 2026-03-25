import { useApp } from '../context/AppContext'

/**
 * User roles in the system:
 *   Staff        — regular employee
 *   HR           — HR Admin: manages system, inputs discipline, assigns hierarchy
 *   HRM          — HR Manager: same admin rights as HR
 *   GM           — General Manager: admin rights + full read-only dashboard
 *   MD           — Managing Director: read-only exec dashboard
 *   MasterAdmin  — Full access to everything including user management
 *   Viewer       — Read-only access to dashboards
 *   Creator      — Can create evaluations and KPIs
 *
 * NOTE: "Supervisor" and "Stakeholder" are assignment roles (stored in staffConfig), not user roles.
 * A user with any role can be assigned as Supervisor/Stakeholder for another staff member.
 */

const ROLE_PERMISSIONS = {
  Staff: {
    canViewAdmin: false,
    canManageUsers: false,
    canManageYears: false,
    canAssignHierarchy: false,
    canInputDiscipline: false,
    canAssignKPI: false,
    canRespondKPI: true,
    canSelfAssessCompetency: true,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: false,
    canViewOwnEvaluation: true,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: false,
    canEvaluateJD: true,
  },
  HR: {
    canViewAdmin: true,
    canManageUsers: true,
    canManageYears: true,
    canAssignHierarchy: true,
    canInputDiscipline: true,
    canAssignKPI: false,
    canRespondKPI: false,
    canSelfAssessCompetency: false,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: true,
    canViewOwnEvaluation: false,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: true,
    canEvaluateJD: false,
  },
  HRM: {
    canViewAdmin: true,
    canManageUsers: true,
    canManageYears: true,
    canAssignHierarchy: true,
    canInputDiscipline: true,
    canAssignKPI: false,
    canRespondKPI: false,
    canSelfAssessCompetency: false,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: true,
    canViewOwnEvaluation: false,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: true,
    canEvaluateJD: false,
  },
  GM: {
    canViewAdmin: true,
    canManageUsers: true,
    canManageYears: true,
    canAssignHierarchy: true,
    canInputDiscipline: false,
    canAssignKPI: false,
    canRespondKPI: false,
    canSelfAssessCompetency: false,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: true,
    canViewOwnEvaluation: false,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: true,
    canEvaluateJD: false,
  },
  MD: {
    canViewAdmin: true,
    canManageUsers: false,
    canManageYears: false,
    canAssignHierarchy: false,
    canInputDiscipline: false,
    canAssignKPI: false,
    canRespondKPI: false,
    canSelfAssessCompetency: false,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: true,
    canViewOwnEvaluation: false,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: true,
    canEvaluateJD: false,
  },
  MasterAdmin: {
    canViewAdmin: true,
    canManageUsers: true,
    canManageYears: true,
    canAssignHierarchy: true,
    canInputDiscipline: true,
    canAssignKPI: true,
    canRespondKPI: true,
    canSelfAssessCompetency: true,
    canEvaluateOthersCompetency: true,
    canViewAllEvaluations: true,
    canViewOwnEvaluation: true,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: true,
    canEvaluateJD: true,
  },
  Viewer: {
    canViewAdmin: false,
    canManageUsers: false,
    canManageYears: false,
    canAssignHierarchy: false,
    canInputDiscipline: false,
    canAssignKPI: false,
    canRespondKPI: false,
    canSelfAssessCompetency: false,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: true,
    canViewOwnEvaluation: true,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: false,
    canEvaluateJD: false,
  },
  Creator: {
    canViewAdmin: false,
    canManageUsers: false,
    canManageYears: false,
    canAssignHierarchy: false,
    canInputDiscipline: false,
    canAssignKPI: true,
    canRespondKPI: true,
    canSelfAssessCompetency: true,
    canEvaluateOthersCompetency: false,
    canViewAllEvaluations: false,
    canViewOwnEvaluation: true,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: false,
    canEvaluateJD: true,
  },
}

export const ROLE_META = {
  Staff:       { color: 'blue',   label: 'Staff',       tabKey: 'staff' },
  HR:          { color: 'green',  label: 'HR Admin',    tabKey: 'hr' },
  HRM:         { color: 'teal',   label: 'HRM',         tabKey: 'hrm' },
  GM:          { color: 'orange', label: 'GM',          tabKey: 'gm' },
  MD:          { color: 'red',    label: 'MD',          tabKey: 'md' },
  MasterAdmin: { color: 'purple', label: 'MasterAdmin', tabKey: 'masteradmin' },
  Viewer:      { color: 'gray',   label: 'Viewer',      tabKey: 'viewer' },
  Creator:     { color: 'pink',   label: 'Creator',     tabKey: 'creator' },
}

export const ROLE_BADGE_CLASSES = {
  Staff:       'bg-blue-100 text-blue-800 ring-blue-200',
  HR:          'bg-green-100 text-green-800 ring-green-200',
  HRM:         'bg-teal-100 text-teal-800 ring-teal-200',
  GM:          'bg-orange-100 text-orange-800 ring-orange-200',
  MD:          'bg-red-100 text-red-800 ring-red-200',
  MasterAdmin: 'bg-purple-100 text-purple-800 ring-purple-200',
  Viewer:      'bg-gray-100 text-gray-600 ring-gray-200',
  Creator:     'bg-pink-100 text-pink-800 ring-pink-200',
}

export const ROLE_AVATAR_BG = {
  Staff:       'bg-blue-500',
  HR:          'bg-green-600',
  HRM:         'bg-teal-600',
  GM:          'bg-orange-500',
  MD:          'bg-red-600',
  MasterAdmin: 'bg-purple-600',
  Viewer:      'bg-gray-400',
  Creator:     'bg-pink-600',
}

export const EXEC_ROLES = ['HR', 'HRM', 'GM', 'MD', 'MasterAdmin']
export const CAN_BE_SUPERVISOR_ROLES = ['Staff', 'HR', 'HRM', 'GM', 'MasterAdmin', 'Creator']
export const CAN_BE_STAKEHOLDER_ROLES = ['Staff', 'HR', 'HRM', 'GM', 'MasterAdmin', 'Creator']

export default function useRBAC() {
  const { currentUser } = useApp()

  // Support multi-role: merge permissions from ALL roles
  const roles = Array.isArray(currentUser?.roles)
    ? currentUser.roles
    : [currentUser?.role || 'Staff']

  const perms = roles.reduce((acc, r) => {
    const p = ROLE_PERMISSIONS[r]
    if (!p) return acc
    Object.keys(p).forEach((k) => { if (p[k]) acc[k] = true })
    return acc
  }, {})

  const role = roles[0] || 'Staff'

  const can = (permission) => !!perms[permission]
  const isRole = (...checkRoles) => roles.some((r) => checkRoles.includes(r))
  const isExec = () => roles.some((r) => EXEC_ROLES.includes(r))

  return { role, roles, can, isRole, isExec, perms }
}
