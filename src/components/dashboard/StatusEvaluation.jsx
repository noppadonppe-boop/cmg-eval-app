import { useApp } from '../../context/AppContext'
import { CheckCircle2, XCircle, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { subscribeAllUsers } from '../../services/authService'
import { getYearScorePartUsage } from '../../utils/scoreUtils'

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

function PartEvidence({ parts, requiredParts }) {
  if (!requiredParts?.length) return null
  const doneParts = new Set(parts || [])
  return (
    <span className="inline-flex items-center gap-1">
      {requiredParts.map((part) => {
        const done = doneParts.has(part)
        return (
          <span key={part} className={`text-[10px] font-bold ${done ? 'text-green-600' : 'text-red-500'}`}>
            {part}
          </span>
        )
      })}
    </span>
  )
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
  const hasScore = (e) =>
    e && (e.rawTotal != null || e.scaledScore != null || e.score != null)

  const includedParts = getYearScorePartUsage(data, selectedYear)

  const getEvaluatorScoreRows = (staffId, evaluatorId, checks) =>
    (data.quarterlyEvaluations || []).filter((e) =>
      e.year === selectedYear &&
      e.quarter === currentQuarter &&
      e.staffId === staffId &&
      e.evaluatorId === evaluatorId &&
      checks.some((check) => check.included && check.part === e.part && check.role === e.evaluatorRole) &&
      hasScore(e)
    )

  const buildEvaluatorStatus = (staffId, evaluatorId, checks) => {
    const rows = getEvaluatorScoreRows(staffId, evaluatorId, checks)
    const requiredChecks = checks.filter((check) => check.included)
    const partLabels = checks
      .filter((check) => rows.some((row) => row.part === check.part && row.evaluatorRole === check.role))
      .map((check) => check.label)
    return {
      done: requiredChecks.length > 0 && requiredChecks.every((check) =>
        rows.some((row) => row.part === check.part && row.evaluatorRole === check.role)
      ),
      requiredPartLabels: requiredChecks.map((check) => check.label),
      partLabels,
    }
  }

  const isSelfDone = (staffId) => {
    return buildEvaluatorStatus(staffId, staffId, [
      { included: includedParts.part1, part: 'part1', role: 'Staff', label: 'P1' },
      { included: includedParts.part3, part: 'part3_staff', role: 'Staff', label: 'P3' },
      { included: includedParts.part4, part: 'part4', role: 'Staff', label: 'P4' },
    ])
  }

  const isSupervisorDone = (staffId, supervisorId) => {
    if (!supervisorId) return { done: false, partLabels: [] }
    return buildEvaluatorStatus(staffId, supervisorId, [
      { included: includedParts.part1, part: 'part1', role: 'Supervisor', label: 'P1' },
      { included: includedParts.part3, part: 'part3_sup', role: 'Supervisor', label: 'P3' },
      { included: includedParts.part4, part: 'part4', role: 'Supervisor', label: 'P4' },
    ])
  }

  const isStakeholderDone = (staffId, stakeholderId) => {
    if (!stakeholderId) return { done: false, partLabels: [] }
    return buildEvaluatorStatus(staffId, stakeholderId, [
      { included: includedParts.part1, part: 'part1', role: 'Stakeholder', label: 'P1' },
      { included: includedParts.part4, part: 'part4', role: 'Stakeholder', label: 'P4' },
    ])
  }

  // Build evaluation matrix: for each user, show who they need to evaluate
  const evaluationMatrix = allUsers.map((user) => {
    const userConfig = configsThisYear.find((c) => c.staffId === user.id)
    
    // Find who this user supervises
    const supervisedStaff = configsThisYear
      .filter((c) => c.supervisorId === user.id)
      .map((c) => {
        const staff = allUsers.find((u) => u.id === c.staffId)
        const status = isSupervisorDone(c.staffId, user.id)
        return staff ? {
          staff,
          done: status.done,
          partLabels: status.partLabels,
          requiredPartLabels: status.requiredPartLabels,
        } : null
      })
      .filter(Boolean)

    // Find who this user is a stakeholder for
    const stakeholderFor = configsThisYear
      .filter((c) => (c.stakeholderIds || []).includes(user.id))
      .map((c) => {
        const staff = allUsers.find((u) => u.id === c.staffId)
        const status = isStakeholderDone(c.staffId, user.id)
        return staff ? {
          staff,
          done: status.done,
          partLabels: status.partLabels,
          requiredPartLabels: status.requiredPartLabels,
        } : null
      })
      .filter(Boolean)

    // Check if user needs to do self-evaluation
    const hasSelfEval = !!userConfig
    const selfStatus = hasSelfEval ? isSelfDone(user.id) : { done: null, partLabels: [] }
    const selfDone = selfStatus.done

    return {
      user,
      selfDone,
      selfPartLabels: selfStatus.partLabels,
      selfRequiredPartLabels: selfStatus.requiredPartLabels,
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
                          <PartEvidence parts={item.selfPartLabels} requiredParts={item.selfRequiredPartLabels} />
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
                              <PartEvidence parts={s.partLabels} requiredParts={s.requiredPartLabels} />
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
                              <PartEvidence parts={s.partLabels} requiredParts={s.requiredPartLabels} />
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
