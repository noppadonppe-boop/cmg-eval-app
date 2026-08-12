export const ALL_POSITIONS = ['Staff', 'Supervisor', 'Developer']

export function normalizePositions(user) {
  if (Array.isArray(user?.positions) && user.positions.length > 0) {
    return user.positions
  }

  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean)
  const hasStaff = roles.includes('Staff')
  const hasNonStaff = roles.some((role) => role && role !== 'Staff')

  if (hasStaff && hasNonStaff) return ['Staff', 'Supervisor']
  if (hasNonStaff) return ['Supervisor']
  return ['Staff']
}

export function isDeveloperUser(user) {
  const positions = normalizePositions(user)
  return positions.includes('Developer') || user?.position === 'Developer'
}

export function filterVisibleUsers(users = []) {
  return users.filter((user) => !isDeveloperUser(user))
}
