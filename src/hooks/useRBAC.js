import { useApp } from '../context/AppContext'

// User roles in the system:
//   Staff  — regular employee (can be evaluated; self-assesses, responds to KPIs)
//   HR     — HR Admin: manages system, inputs discipline, assigns hierarchy
//   HRM    — HR Manager: same admin rights as HR
//   GM     — General Manager: admin rights + full read-only dashboard
//   MD     — Managing Director: read-only exec dashboard
// NOTE: "Supervisor" and "Stakeholder" are NOT user roles.
//       They are *assignment roles* stored per-staff in staffConfig.
//       A Staff/HR/HRM/GM user can be assigned as Supervisor or Stakeholder for another staff member.

const ROLE_PERMISSIONS = {
  Staff: {
    canViewAdmin: false,
    canManageUsers: false,
    canManageYears: false,
    canAssignHierarchy: false,
    canInputDiscipline: false,
    canAssignKPI: false,        // set dynamically in EvalPage if user is a supervisor
    canRespondKPI: true,
    canSelfAssessCompetency: true,
    canEvaluateOthersCompetency: false, // set dynamically if user is supervisor/stakeholder
    canViewAllEvaluations: false,
    canViewOwnEvaluation: true,
    canViewQuarterlyDashboard: true,
    canViewAnnualTrend: false,
    canEvaluateJD: true,        // self + as supervisor/stakeholder (dynamic)
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
}

export const ROLE_META = {
  Staff: { color: 'blue',   label: 'Staff',    tabKey: 'staff' },
  HR:    { color: 'green',  label: 'HR Admin', tabKey: 'hr' },
  HRM:   { color: 'teal',   label: 'HRM',      tabKey: 'hrm' },
  GM:    { color: 'orange', label: 'GM',       tabKey: 'gm' },
  MD:    { color: 'red',    label: 'MD',       tabKey: 'md' },
}

export const ROLE_BADGE_CLASSES = {
  Staff: 'bg-blue-100 text-blue-800 ring-blue-200',
  HR:    'bg-green-100 text-green-800 ring-green-200',
  HRM:   'bg-teal-100 text-teal-800 ring-teal-200',
  GM:    'bg-orange-100 text-orange-800 ring-orange-200',
  MD:    'bg-red-100 text-red-800 ring-red-200',
}

export const ROLE_AVATAR_BG = {
  Staff: 'bg-blue-500',
  HR:    'bg-green-600',
  HRM:   'bg-teal-600',
  GM:    'bg-orange-500',
  MD:    'bg-red-600',
}

// Roles that are exec/admin (read-only dashboards, no self-eval)
export const EXEC_ROLES = ['HR', 'HRM', 'GM', 'MD']

// A user can be assigned as Supervisor or Stakeholder for a staff member regardless of their role
// (as long as they are not MD — MD is view-only exec)
export const CAN_BE_SUPERVISOR_ROLES = ['Staff', 'HR', 'HRM', 'GM']
export const CAN_BE_STAKEHOLDER_ROLES = ['Staff', 'HR', 'HRM', 'GM']

export default function useRBAC() {
  const { currentUser } = useApp()
  const role = currentUser?.role || 'Staff'
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Staff']

  const can = (permission) => !!perms[permission]

  const isRole = (...roles) => roles.includes(role)

  const isExec = () => EXEC_ROLES.includes(role)

  return { role, can, isRole, isExec, perms }
}
