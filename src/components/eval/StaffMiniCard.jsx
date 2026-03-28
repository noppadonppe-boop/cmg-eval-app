import { ROLE_AVATAR_BG, ROLE_BADGE_CLASSES } from '../../hooks/useRBAC'

function getUserDisplayName(user) {
  if (!user) return 'User'
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return full || user.name || user.email || 'User'
}

function getInitials(user) {
  if (user?.firstName && user?.lastName) {
    return (user.firstName[0] + user.lastName[0]).toUpperCase()
  }
  const name = user?.name || user?.email || ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] || '?').toUpperCase()
}

function getPrimaryRole(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    const priority = ['MasterAdmin', 'MD', 'GM', 'HRM', 'HR', 'Creator', 'Staff', 'Viewer']
    for (const r of priority) {
      if (user.roles.includes(r)) return r
    }
    return user.roles[0]
  }
  return user?.role || 'Staff'
}

function getPositionLabel(user) {
  const positions = user?.positions
  if (Array.isArray(positions) && positions.length > 0) {
    if (positions.includes('Supervisor')) return 'Supervisor'
    if (positions.includes('Staff')) return 'Staff'
    return positions[0]
  }
  const role = getPrimaryRole(user)
  if (role === 'MD' || role === 'GM' || role === 'HRM' || role === 'HR') return role
  return 'Staff'
}

function UserAvatar({ user, size = 'md' }) {
  const sizeClass =
    size === 'xl' ? 'w-20 h-20 text-2xl' :
    size === 'lg' ? 'w-16 h-16 text-xl' :
    size === 'md' ? 'w-12 h-12 text-base' :
    'w-8 h-8 text-xs'

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={getUserDisplayName(user)}
        className={`${sizeClass} rounded-full object-cover ring-3 ring-white shadow-sm shrink-0`}
      />
    )
  }

  const initials = getInitials(user)
  const role = getPrimaryRole(user)

  return (
    <div
      className={`${sizeClass} rounded-full ${ROLE_AVATAR_BG[role] || 'bg-gray-400'} flex items-center justify-center text-white font-bold ring-3 ring-white shadow-sm shrink-0`}
    >
      {initials}
    </div>
  )
}

export default function StaffMiniCard({ user, isSelected = false, onClick, statusLabel, statusDetail, statusTone = 'todo' }) {
  const displayName = getUserDisplayName(user)
  const role = getPrimaryRole(user)
  const position = getPositionLabel(user)
  const badgeClass = ROLE_BADGE_CLASSES[role] || 'bg-gray-100 text-gray-600 ring-gray-200'

  const isDisabled = typeof onClick !== 'function'

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`group relative flex flex-col items-center gap-2 p-3 pt-4 rounded-xl border transition-all duration-200 w-full text-center shadow-sm hover:shadow-md ${
        isDisabled
          ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed shadow-none'
          : isSelected
            ? 'border-indigo-500 bg-indigo-50 shadow-indigo-100'
            : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
      }`}
    >
      <div className={`relative transition-transform duration-200 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}>
        <UserAvatar user={user} size="md" />
        {isSelected && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center ring-2 ring-white">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>

      <div className="w-full min-w-0 space-y-1">
        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2 px-0.5">
          {displayName}
        </p>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 ${badgeClass}`}>
            {position}
          </span>
          {statusLabel && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 ${
                statusTone === 'done'
                  ? 'bg-green-50 text-green-700 ring-green-200'
                  : statusTone === 'notReady'
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-gray-50 text-gray-600 ring-gray-200'
              }`}
            >
              {statusLabel}
            </span>
          )}
        </div>
        {statusDetail && (
          <p className={`text-[10px] leading-snug line-clamp-2 px-0.5 ${
            statusTone === 'notReady' ? 'text-amber-700' : 'text-gray-400'
          }`}>
            {statusDetail}
          </p>
        )}
      </div>
    </button>
  )
}
