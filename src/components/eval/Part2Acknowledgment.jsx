import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import { CheckCircle2, Info, ChevronRight, Shield, Lock, ChevronDown, ChevronUp } from 'lucide-react'

const EVAL_ROLE_BADGE = {
  Staff:       'bg-blue-100 text-blue-800 ring-blue-200',
  Supervisor:  'bg-purple-100 text-purple-800 ring-purple-200',
  Stakeholder: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  HR:          'bg-green-100 text-green-800 ring-green-200',
  MD:          'bg-red-100 text-red-800 ring-red-200',
}

export default function Part2Acknowledgment({ staffId, quarter, year, evaluatorRole = 'Staff', onComplete }) {
  const { currentUser, getUserById, getEvaluationForPart, saveEvaluation } = useApp()
  
  const existing = getEvaluationForPart(year, quarter, staffId, 'part2')
  const [acknowledged, setAcknowledged] = useState(!!existing?.acknowledged || !!existing)
  const [showDetails, setShowDetails] = useState(true)
  
  const staff = getUserById(staffId)
  
  const ctxRole = evaluatorRole

  const handleAcknowledge = () => {
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole: ctxRole,
      part: 'part2',
      acknowledged: true,
      rawTotal: 0,
      scaledScore: 0,
    })
    setAcknowledged(true)
    // Navigate to Part 3 after acknowledgment
    if (onComplete) onComplete()
  }

  // Calculate quarter score from HR data
  const quarterScore = existing?.scaledScore ?? existing?.rawTotal ?? null
  const months = existing?.months || {}
  
  // Deduction breakdown helper
  const getMonthScore = (m) => {
    if (!m) return null
    const s = (v) => (v === '' || v === undefined ? null : Number(v))
    const sick = s(m.sick)
    const personal = s(m.personal)
    const vacation = s(m.vacation)
    const absent = s(m.absent)
    const warning = s(m.warning)
    const quota = Number(m.vacationQuota) || 0
    if ([sick, personal, vacation, absent, warning].every(v => v === null)) return null
    const ded = 
      (sick <= 5 ? 0 : sick <= 10 ? -1 : sick <= 20 ? -2 : -4) +
      (personal <= 2 ? 0 : personal <= 4 ? -1 : personal <= 6 ? -2 : -3) +
      (vacation - quota <= 0 ? 0 : vacation - quota <= 3 ? -1 : -2) +
      (absent === 0 ? 0 : absent === 1 ? -3 : absent === 2 ? -5 : -8) +
      (warning === 0 ? 0 : warning === 1 ? -2 : -3)
    return Math.max(0, 20 + ded)
  }

  const monthNames = { Q1: ['ม.ค.', 'ก.พ.', 'มี.ค.'], Q2: ['เม.ย.', 'พ.ค.', 'มิ.ย.'], Q3: ['ก.ค.', 'ส.ค.', 'ก.ย.'], Q4: ['ต.ค.', 'พ.ย.', 'ธ.ค.'] }
  const mNames = monthNames[quarter] || ['M1', 'M2', 'M3']
  const scores = ['M1', 'M2', 'M3'].map(k => getMonthScore(months[k])).filter(s => s !== null)
  
  const scoreColor = (s) =>
    s === null ? 'text-gray-400' :
    s >= 18 ? 'text-green-600' :
    s >= 14 ? 'text-yellow-600' :
    s >= 10 ? 'text-orange-500' : 'text-red-600'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR_BG[staff?.role] || 'bg-gray-400'} flex items-center justify-center text-white text-sm font-bold`}>
            {staff?.name?.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{staff?.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ring-1 ${EVAL_ROLE_BADGE[ctxRole] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                {ctxRole}
              </span>
              <p className="text-xs text-gray-500">— Part 2 รับทราบข้อมูลวินัย</p>
            </div>
          </div>
        </div>
        {quarterScore !== null && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] text-gray-400">คะแนนวินัย</p>
              <p className={`text-2xl font-extrabold ${scoreColor(quarterScore)}`}>
                {quarterScore}
                <span className="text-sm font-medium text-gray-400 ml-1">/ 20</span>
              </p>
            </div>
            {existing?.hrmApproved && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                <Lock size={11} /> อนุมัติแล้ว
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">Part 2 — Discipline (20 คะแนน)</p>
          <p>ส่วนนี้เป็นการ<b>รับทราบข้อมูลวินัย</b>ที่ HR เป็นผู้บันทึกข้อมูลขาด/ลา/มาสาย และ HRM อนุมัติแล้ว</p>
          {quarterScore === null && <p className="mt-1 text-amber-600 font-medium">ยังไม่มีข้อมูลวินัยจาก HR — กรุณารอ HR บันทึกข้อมูล</p>}
          {quarterScore !== null && !acknowledged && <p className="mt-1 text-blue-600">กรุณากด "รับทราบ" เพื่อดำเนินการต่อไปยัง Part 3</p>}
        </div>
      </div>

      {/* Discipline Data Summary from HR (Read-only) */}
      {quarterScore !== null && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setShowDetails(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-indigo-500" />
              <span className="text-xs font-semibold text-gray-700">ข้อมูลวินัยจาก HR (ดูได้อย่างเดียว)</span>
            </div>
            {showDetails ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          
          {showDetails && (
            <div className="p-4 space-y-4">
              {/* Month detailed cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {['M1', 'M2', 'M3'].map((mk, idx) => {
                  const m = months[mk]
                  const s = getMonthScore(m)
                  const sick = Number(m?.sick) || 0
                  const personal = Number(m?.personal) || 0
                  const vacation = Number(m?.vacation) || 0
                  const absent = Number(m?.absent) || 0
                  const warning = Number(m?.warning) || 0
                  const quota = Number(m?.vacationQuota) || 0
                  const vacationOver = Math.max(0, vacation - quota)
                  const dedSick = sick <= 5 ? 0 : sick <= 10 ? -1 : sick <= 20 ? -2 : -4
                  const dedPersonal = personal <= 2 ? 0 : personal <= 4 ? -1 : personal <= 6 ? -2 : -3
                  const dedVacation = vacationOver <= 0 ? 0 : vacationOver <= 3 ? -1 : -2
                  const dedAbsent = absent === 0 ? 0 : absent === 1 ? -3 : absent === 2 ? -5 : -8
                  const dedWarning = warning === 0 ? 0 : warning === 1 ? -2 : -3
                  
                  return (
                    <div key={mk} className={`rounded-xl border overflow-hidden ${s === null ? 'border-gray-200 bg-gray-50' : s >= 18 ? 'border-green-200' : s >= 14 ? 'border-yellow-200' : 'border-red-200'}`}>
                      {/* Month header */}
                      <div className={`px-3 py-2 flex items-center justify-between ${s === null ? 'bg-gray-100' : s >= 18 ? 'bg-green-50' : s >= 14 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <p className="text-xs font-bold text-gray-700">{mNames[idx]}</p>
                        <p className={`text-lg font-extrabold ${scoreColor(s)}`}>{s !== null ? s : '—'}<span className="text-xs font-normal text-gray-400 ml-0.5">/20</span></p>
                      </div>
                      
                      {s !== null && (
                        <div className="p-3 space-y-2">
                          {/* All leave types with deductions */}
                          <div className="space-y-1.5 text-xs">
                            {/* ลาป่วย */}
                            <div className="flex items-center justify-between py-1 px-2 rounded bg-white">
                              <span className="text-gray-600">ลาป่วย</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-700">{sick} วัน</span>
                                {dedSick < 0 && <span className="text-red-600 font-bold text-[10px] px-1.5 py-0.5 bg-red-50 rounded">{dedSick}</span>}
                              </div>
                            </div>
                            {/* ลากิจ */}
                            <div className="flex items-center justify-between py-1 px-2 rounded bg-white">
                              <span className="text-gray-600">ลากิจ</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-700">{personal} วัน</span>
                                {dedPersonal < 0 && <span className="text-red-600 font-bold text-[10px] px-1.5 py-0.5 bg-red-50 rounded">{dedPersonal}</span>}
                              </div>
                            </div>
                            {/* ลาพักร้อน */}
                            <div className="flex items-center justify-between py-1 px-2 rounded bg-white">
                              <span className="text-gray-600">ลาพักร้อน</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-700">{vacation} วัน</span>
                                {vacationOver > 0 && <span className="text-amber-600 text-[10px]">(เกิน {vacationOver})</span>}
                                {dedVacation < 0 && <span className="text-red-600 font-bold text-[10px] px-1.5 py-0.5 bg-red-50 rounded">{dedVacation}</span>}
                              </div>
                            </div>
                            {/* ขาดงาน */}
                            <div className={`flex items-center justify-between py-1 px-2 rounded ${absent > 0 ? 'bg-red-50' : 'bg-white'}`}>
                              <span className={absent > 0 ? 'text-red-600' : 'text-gray-600'}>ขาดงาน</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${absent > 0 ? 'text-red-600' : 'text-gray-700'}`}>{absent} ครั้ง</span>
                                {dedAbsent < 0 && <span className="text-red-600 font-bold text-[10px] px-1.5 py-0.5 bg-red-100 rounded">{dedAbsent}</span>}
                              </div>
                            </div>
                            {/* ใบเตือน */}
                            <div className={`flex items-center justify-between py-1 px-2 rounded ${warning > 0 ? 'bg-red-50' : 'bg-white'}`}>
                              <span className={warning > 0 ? 'text-red-600' : 'text-gray-600'}>ใบเตือน</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${warning > 0 ? 'text-red-600' : 'text-gray-700'}`}>{warning} ฉบับ</span>
                                {dedWarning < 0 && <span className="text-red-600 font-bold text-[10px] px-1.5 py-0.5 bg-red-100 rounded">{dedWarning}</span>}
                              </div>
                            </div>
                          </div>
                          
                          {/* Total deduction */}
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500">รวมหักคะแนน</span>
                            <span className="text-sm font-bold text-red-600">{dedSick + dedPersonal + dedVacation + dedAbsent + dedWarning} คะแนน</span>
                          </div>
                        </div>
                      )}
                      
                      {s === null && (
                        <div className="p-3 text-center">
                          <p className="text-xs text-gray-400">ยังไม่มีข้อมูล</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Quarter summary */}
              <div className="bg-indigo-50 rounded-xl border border-indigo-100 px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-indigo-700">คะแนนเฉลี่ย Quarter</p>
                    <p className="text-xs text-indigo-500 mt-0.5">คำนวณจากคะแนน 3 เดือน</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-extrabold ${scoreColor(quarterScore)}`}>{quarterScore}<span className="text-base font-medium text-gray-400 ml-1">/ 20</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">({scores.join(' + ')}) / {scores.length}</p>
                  </div>
                </div>
                {/* Score bar */}
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${quarterScore >= 18 ? 'bg-green-500' : quarterScore >= 14 ? 'bg-yellow-400' : quarterScore >= 10 ? 'bg-orange-400' : 'bg-red-500'}`}
                    style={{ width: `${(quarterScore / 20) * 100}%` }}
                  />
                </div>
              </div>
              
              {/* Lock indicator */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 rounded-lg text-xs text-gray-500">
                <Lock size={12} />
                <span>ข้อมูลนี้บันทึกโดย HR — คุณสามารถรับทราบได้อย่างเดียว</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Already acknowledged */}
      {acknowledged && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 size={15} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-medium">
            รับทราบข้อมูลวินัยแล้ว — ไปยัง Part 3 ต่อได้เลย
          </p>
        </div>
      )}

      {/* Acknowledgment Button */}
      {!acknowledged && quarterScore !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">
            ฉันได้อ่านและรับทราบข้อมูลการประเมินด้านวินัย (Part 2) ของ <strong>{staff?.name}</strong> สำหรับ {quarter} ปี {year}
          </p>
          <button
            onClick={handleAcknowledge}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle2 size={16} />
            รับทราบข้อมูลวินัย
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      
      {/* No data yet */}
      {!acknowledged && quarterScore === null && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
          <Shield size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            ยังไม่มีข้อมูลวินัยจาก HR สำหรับ {quarter} ปี {year}
          </p>
          <p className="text-xs text-gray-400 mt-1">กรุณารอ HR บันทึกข้อมูลก่อน</p>
        </div>
      )}

      {/* Next step hint */}
      {acknowledged && (
        <div className="text-center">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            ไปยัง Part 3 — KPI
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
