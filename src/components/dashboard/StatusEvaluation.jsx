import { useApp } from '../../context/AppContext'
import { CheckCircle2, XCircle, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { subscribeAllUsers } from '../../services/authService'

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

function getUserDisplayName(user) {
  if (!user) return ''
  if (user.name) return user.name
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`
  if (user.firstName) return user.firstName
  return user.email || 'User'
}

function getUserPrimaryRole(user) {
  if (!user) return 'Staff'
  if (user.role) return user.role
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const rolePriority = ['MasterAdmin', 'MD', 'GM', 'HRM', 'HR', 'Creator', 'Staff', 'Viewer']
    for (const r of rolePriority) {
      if (user.roles.includes(r)) return r
    }
    return user.roles[0]
  }
  return 'Staff'
}

function normalizeAnyUser(u) {
  if (!u) return null
  return {
    ...u,
    id: u.id || u.uid,
    name: getUserDisplayName(u),
    role: getUserPrimaryRole(u),
  }
}

export default function StatusEvaluation() {
  const { data, selectedYear, activeQuarter } = useApp()
  const [firebaseUsers, setFirebaseUsers] = useState([])
  const currentQuarter = activeQuarter || 'Q1'

  useEffect(() => {
    const unsub = subscribeAllUsers((users) => {
      setFirebaseUsers(users.map(normalizeAnyUser).filter(Boolean))
    })
    return unsub
  }, [])

  const allUsers = firebaseUsers.length > 0
    ? firebaseUsers
    : (data.users || []).map(normalizeAnyUser).filter(Boolean)

  const configsThisYear = data.staffConfigs.filter((c) => c.year === selectedYear)

  // Helper functions to check evaluation completion
  const findEval = (staffId, evaluatorId, part, evaluatorRole = null) =>
    (data.quarterlyEvaluations || []).find(
      (e) =>
        e.year === selectedYear &&
        e.quarter === currentQuarter &&
        e.staffId === staffId &&
        e.evaluatorId === evaluatorId &&
        e.part === part &&
        (evaluatorRole ? e.evaluatorRole === evaluatorRole : true)
    )

  const part2Exists = (staffId) =>
    (data.quarterlyEvaluations || []).some(
      (e) => e.year === selectedYear && e.quarter === currentQuarter && e.staffId === staffId && e.part === 'part2'
    )

  const isSelfDone = (staffId) => {
    return !!(
      part2Exists(staffId) &&
      findEval(staffId, staffId, 'part1', 'Staff') &&
      findEval(staffId, staffId, 'part3_staff', 'Staff') &&
      findEval(staffId, staffId, 'part4', 'Staff')
    )
  }

  const isSupervisorDone = (staffId, supervisorId) => {
    if (!supervisorId) return false
    return !!(
      part2Exists(staffId) &&
      findEval(staffId, supervisorId, 'part1', 'Supervisor') &&
      findEval(staffId, supervisorId, 'part3_sup', 'Supervisor') &&
      findEval(staffId, supervisorId, 'part4', 'Supervisor')
    )
  }

  const isStakeholderDone = (staffId, stakeholderId) => {
    if (!stakeholderId) return false
    return !!(
      part2Exists(staffId) &&
      findEval(staffId, stakeholderId, 'part1', 'Stakeholder') &&
      findEval(staffId, stakeholderId, 'part4', 'Stakeholder')
    )
  }

  // Build evaluation matrix: for each user, show who they need to evaluate
  const evaluationMatrix = allUsers.map((user) => {
    const userConfig = configsThisYear.find((c) => c.staffId === user.id)
    
    // Find who this user supervises
    const supervisedStaff = configsThisYear
      .filter((c) => c.supervisorId === user.id)
      .map((c) => {
        const staff = allUsers.find((u) => u.id === c.staffId)
        return staff ? {
          staff,
          done: isSupervisorDone(c.staffId, user.id)
        } : null
      })
      .filter(Boolean)

    // Find who this user is a stakeholder for
    const stakeholderFor = configsThisYear
      .filter((c) => (c.stakeholderIds || []).includes(user.id))
      .map((c) => {
        const staff = allUsers.find((u) => u.id === c.staffId)
        return staff ? {
          staff,
          done: isStakeholderDone(c.staffId, user.id)
        } : null
      })
      .filter(Boolean)

    // Check if user needs to do self-evaluation
    const hasSelfEval = !!userConfig
    const selfDone = hasSelfEval ? isSelfDone(user.id) : null

    return {
      user,
      selfDone,
      supervisedStaff,
      stakeholderFor,
      hasSelfEval,
      totalEvaluations: (hasSelfEval ? 1 : 0) + supervisedStaff.length + stakeholderFor.length,
      completedEvaluations: 
        (selfDone ? 1 : 0) + 
        supervisedStaff.filter(s => s.done).length + 
        stakeholderFor.filter(s => s.done).length
    }
  })

  // Show all users who have evaluations to do OR who need to be evaluated (have staffConfig)
  const activeEvaluators = evaluationMatrix.filter(e => e.totalEvaluations > 0 || e.hasSelfEval)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Status Evaluation</h2>
            <p className="text-xs text-gray-500 mt-1">
              สถานะการประเมินของทุกคน · {selectedYear} · {currentQuarter}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600">{activeEvaluators.length}</p>
            <p className="text-xs text-gray-500">ผู้ประเมิน</p>
          </div>
        </div>

        {activeEvaluators.length === 0 ? (
          <div className="py-12 text-center">
            <User size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">ไม่มีข้อมูลการประเมิน</p>
            <p className="text-xs text-gray-400 mt-1">กำหนดค่า Staff Config ก่อนเพื่อเริ่มการประเมิน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    ผู้ประเมิน
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    ตนเอง
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    ผู้ใต้บังคับบัญชา
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    ผู้มีส่วนร่วมการทำงาน
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    สรุป
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeEvaluators.map((item) => (
                  <tr key={item.user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.user.photoURL ? (
                          <img 
                            src={item.user.photoURL} 
                            alt={item.user.name} 
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                            {getInitials(item.user.name)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.user.name}</p>
                          <p className="text-xs text-gray-500">{item.user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.hasSelfEval ? (
                        <div className="flex items-center justify-center gap-2">
                          {item.selfDone ? (
                            <CheckCircle2 size={18} className="text-green-600" />
                          ) : (
                            <XCircle size={18} className="text-red-500" />
                          )}
                          <span className={`text-xs font-medium ${item.selfDone ? 'text-green-700' : 'text-red-600'}`}>
                            {item.user.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex justify-center">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.supervisedStaff.length > 0 ? (
                        <div className="space-y-1">
                          {item.supervisedStaff.map((s) => (
                            <div key={s.staff.id} className="flex items-center justify-center gap-2">
                              {s.done ? (
                                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                              ) : (
                                <XCircle size={16} className="text-red-500 shrink-0" />
                              )}
                              <span className={`text-xs font-medium ${s.done ? 'text-green-700' : 'text-red-600'}`}>
                                {s.staff.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex justify-center">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.stakeholderFor.length > 0 ? (
                        <div className="space-y-1">
                          {item.stakeholderFor.map((s) => (
                            <div key={s.staff.id} className="flex items-center justify-center gap-2">
                              {s.done ? (
                                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                              ) : (
                                <XCircle size={16} className="text-red-500 shrink-0" />
                              )}
                              <span className={`text-xs font-medium ${s.done ? 'text-green-700' : 'text-red-600'}`}>
                                {s.staff.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex justify-center">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-indigo-600">
                            {item.completedEvaluations}
                          </span>
                          <span className="text-xs text-gray-400">/</span>
                          <span className="text-sm font-medium text-gray-500">
                            {item.totalEvaluations}
                          </span>
                        </div>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-indigo-600 h-1.5 rounded-full transition-all" 
                            style={{ 
                              width: `${item.totalEvaluations > 0 ? (item.completedEvaluations / item.totalEvaluations) * 100 : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
