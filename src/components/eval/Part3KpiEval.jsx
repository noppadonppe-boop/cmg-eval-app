import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import {
  Target, CheckCircle2, XCircle, AlertCircle, Save, Star, Info, Clock,
} from 'lucide-react'

/**
 * Part3KpiEval — embedded in EvalPage
 * Shows KPI assignment status + end-of-quarter scoring for Staff (40%) and Supervisor (60%).
 * Max 3 KPIs × 10 pts each = 30 pts total.
 * Formula: Staff_total × 0.40 + Sup_total × 0.60
 */

const KPI_TOTAL_SCORE = 30
const kpiMaxPerItem = (count) => (count > 0 ? KPI_TOTAL_SCORE / count : KPI_TOTAL_SCORE)

const STATUS_STYLES = {
  Pending:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  ring: 'ring-yellow-200',  icon: <Clock size={12} />,       label: 'รอยืนยัน' },
  Accepted: { bg: 'bg-green-50',   text: 'text-green-700',   ring: 'ring-green-200',   icon: <CheckCircle2 size={12} />, label: 'ยอมรับแล้ว' },
  Rejected: { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     icon: <XCircle size={12} />,      label: 'ปฏิเสธ' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.icon}{s.label}
    </span>
  )
}

function ScoreSlider({ value, onChange, disabled, label, maxScore }) {
  const pct = maxScore > 0 ? (value / maxScore) * 100 : 0
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#84cc16' : pct >= 40 ? '#facc15' : pct >= 20 ? '#f97316' : '#ef4444'
  const textColor = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-lime-600' : pct >= 40 ? 'text-yellow-600' : pct >= 20 ? 'text-orange-500' : 'text-red-600'
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-semibold text-gray-600">{label}</p>}
      <div className="flex items-center gap-3">
        <input
          type="range" min={0} max={maxScore} step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
          style={{ background: `linear-gradient(to right, ${color} ${pct}%, #e5e7eb ${pct}%)` }}
        />
        <span className={`text-xl font-extrabold w-14 text-right ${textColor}`}>
          {value}<span className="text-xs text-gray-400 font-medium ml-0.5">/{maxScore}</span>
        </span>
      </div>
    </div>
  )
}

// ─── Staff self-scoring panel ─────────────────────────────────────────────────

function StaffScoringPanel({ staffId, quarter, year, onComplete }) {
  const { data, saveEvaluation, getEvaluation, respondKpi } = useApp()

  const myKpis = data.kpis.filter(
    (k) => k.staffId === staffId && k.year === year && k.quarter === quarter
  )
  const accepted = myKpis.filter((k) => k.status === 'Accepted')
  const pending  = myKpis.filter((k) => k.status === 'Pending')
  const rejected = myKpis.filter((k) => k.status === 'Rejected')
  const maxPerItem = kpiMaxPerItem(myKpis.length)

  const existingEval = getEvaluation(year, quarter, staffId, staffId, 'part3_staff')

  const [scores, setScores] = useState(() => {
    const init = {}
    accepted.forEach((k) => { init[k.id] = existingEval?.kpiScores?.[k.id] ?? 0 })
    return init
  })
  const [saved, setSaved] = useState(!!existingEval)

  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const getUserById = (id) => data.users.find((u) => u.id === id)

  const handleAccept = (id) => respondKpi(id, 'Accepted')
  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) { setRejectError('กรุณาระบุเหตุผล'); return }
    respondKpi(rejectModal, 'Rejected', rejectReason.trim())
    setRejectModal(null); setRejectReason(''); setRejectError('')
  }

  const handleSave = () => {
    const total = accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0)
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: staffId,
      evaluatorRole: 'Staff',
      part: 'part3_staff',
      kpiScores: { ...scores },
      rawTotal: total,
      scaledScore: total,
    })
    setSaved(true)
    // Auto-navigate to Part 4 after save
    if (onComplete) onComplete()
  }

  if (myKpis.length === 0) {
    return (
      <div className="py-12 text-center">
        <Target size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400 font-medium">ยังไม่มี KPI ที่มอบหมายใน {quarter}</p>
        <p className="text-xs text-gray-400 mt-1">Supervisor จะมอบหมาย KPI ให้คุณตรวจสอบก่อนเริ่ม Quarter</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
        <span><strong>Part 3 — KPI (30 คะแนน):</strong> ยืนยัน KPI ที่ได้รับมอบหมาย แล้วประเมินตนเองในปลาย Quarter · น้ำหนัก Staff <strong>40%</strong>
          {myKpis.length > 0 && <span className="ml-1">· ข้อละ <strong>{maxPerItem} คะแนน</strong> ({myKpis.length} ข้อ)</span>}</span>
      </div>

      {/* Pending KPIs */}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-yellow-800 flex items-center gap-1.5">
            <AlertCircle size={13} /> รอการยืนยัน ({pending.length} รายการ)
          </p>
          {pending.map((kpi, idx) => {
            const sup = getUserById(kpi.supervisorId)
            return (
              <div key={kpi.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <p className="text-sm font-semibold text-gray-900">{kpi.title}</p>
                    </div>
                    <p className="text-xs text-gray-500 pl-7">วิธีประเมิน: <span className="text-gray-700">{kpi.assessmentMethod}</span></p>
                    {kpi.remark && <p className="text-xs text-gray-400 pl-7 mt-0.5">หมายเหตุ: {kpi.remark}</p>}
                    {sup && (
                      <div className="flex items-center gap-1.5 pl-7 mt-1.5">
                        <div className={`w-5 h-5 rounded-full ${ROLE_AVATAR_BG[sup.role] || 'bg-gray-400'} flex items-center justify-center text-white text-[10px] font-bold`}>{sup.name.charAt(0)}</div>
                        <span className="text-xs text-gray-500">มอบหมายโดย <strong>{sup.name}</strong></span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleAccept(kpi.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                      <CheckCircle2 size={12} /> ยอมรับ
                    </button>
                    <button onClick={() => { setRejectModal(kpi.id); setRejectReason(''); setRejectError('') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100">
                      <XCircle size={12} /> ปฏิเสธ
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rejected KPIs */}
      {rejected.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-red-700">KPI ที่ปฏิเสธ ({rejected.length} รายการ) — รอ Supervisor แก้ไขและมอบหมายใหม่</p>
          {rejected.map((kpi) => (
            <div key={kpi.id} className="bg-white rounded-lg border border-red-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-800">{kpi.title}</p>
              {kpi.rejectReason && <p className="text-xs text-red-500 mt-0.5">เหตุผล: {kpi.rejectReason}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Accepted — self scoring */}
      {accepted.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-green-50 border-b border-green-100">
            <p className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
              <Star size={12} /> KPI ที่ยอมรับ ({accepted.length} รายการ) — ประเมินตนเอง (Staff 40%)
            </p>
            {saved && (
              <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> บันทึกแล้ว
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {accepted.map((kpi, idx) => (
              <div key={kpi.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{kpi.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">วิธีประเมิน: {kpi.assessmentMethod}</p>
                    {kpi.remark && <p className="text-xs text-gray-400 mt-0.5">หมายเหตุ: {kpi.remark}</p>}
                  </div>
                </div>
                <ScoreSlider
                  value={scores[kpi.id] ?? 0}
                  onChange={(v) => { setScores((p) => ({ ...p, [kpi.id]: v })); setSaved(false) }}
                  disabled={saved}
                  label="คะแนนประเมินตนเอง"
                  maxScore={maxPerItem}
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                รวม Staff: <strong className="text-blue-600">{accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0)}</strong> / {accepted.length * maxPerItem}
                <span className="text-gray-400 ml-2">(น้ำหนัก 40% → {Math.round(accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0) * 0.40 * 100) / 100} pts)</span>
              </p>
              {!saved && (
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                  <Save size={12} /> บันทึกคะแนน Staff
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Score summary */}
      {existingEval && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          <span>บันทึกคะแนน Staff แล้ว: <strong className="text-blue-600">{existingEval.rawTotal}/{accepted.length * maxPerItem}</strong> · รอ Supervisor ให้คะแนน (60%) เพื่อคำนวณ Part 3 รวม</span>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-red-100 p-2 rounded-lg"><XCircle size={18} className="text-red-600" /></div>
              <h3 className="text-base font-semibold text-gray-900">ปฏิเสธ KPI</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 pl-11">
              <strong>"{data.kpis.find((k) => k.id === rejectModal)?.title}"</strong>
            </p>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              เหตุผลที่ปฏิเสธ <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => { setRejectReason(e.target.value); setRejectError('') }}
              rows={3}
              placeholder="ระบุเหตุผลและรายละเอียดที่ต้องการให้ Supervisor ปรับปรุง..."
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 ${rejectError ? 'border-red-400' : 'border-gray-300'}`}
            />
            {rejectError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{rejectError}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); setRejectError('') }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleRejectSubmit}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">ยืนยันการปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Supervisor scoring panel ─────────────────────────────────────────────────

function SupervisorScoringPanel({ staffId, quarter, year, onComplete }) {
  const { data, currentUser, saveEvaluation, getEvaluation } = useApp()

  const staffKpis = data.kpis.filter(
    (k) => k.staffId === staffId && k.year === year && k.quarter === quarter
  )
  const accepted = staffKpis.filter((k) => k.status === 'Accepted')
  const staff = data.users.find((u) => u.id === staffId)

  const kpiCount = staffKpis.length
  const maxPerItem = kpiMaxPerItem(kpiCount)
  const existingEval = getEvaluation(year, quarter, staffId, currentUser.id, 'part3_sup')
  const staffEval = getEvaluation(year, quarter, staffId, staffId, 'part3_staff')

  const [scores, setScores] = useState(() => {
    const init = {}
    accepted.forEach((k) => { init[k.id] = existingEval?.kpiScores?.[k.id] ?? 0 })
    return init
  })
  const [saved, setSaved] = useState(!!existingEval)

  const handleSave = () => {
    const total = accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0)
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole: 'Supervisor',
      part: 'part3_sup',
      kpiScores: { ...scores },
      rawTotal: total,
      scaledScore: total,
    })
    setSaved(true)
    // Auto-navigate to Part 4 after save
    if (onComplete) onComplete()
  }

  const staffTotal = staffEval?.rawTotal ?? null
  const supTotal = saved
    ? accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0)
    : existingEval?.rawTotal ?? null
  const maxPossible = kpiCount * maxPerItem

  let weightedScore = null
  if (staffTotal !== null && supTotal !== null) {
    weightedScore = Math.round((staffTotal * 0.40 + supTotal * 0.60) * 100) / 100
  }

  if (staffKpis.length === 0) {
    return (
      <div className="py-12 text-center">
        <Target size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400 font-medium">ยังไม่มี KPI ที่มอบหมายให้ {staff?.name} ใน {quarter}</p>
        <p className="text-xs text-gray-400 mt-1">ไปที่หน้า KPI เพื่อมอบหมายงาน</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-700">
        <Info size={14} className="shrink-0 mt-0.5 text-indigo-500" />
        <span>
          <strong>Part 3 — KPI (30 คะแนน):</strong> ให้คะแนนแต่ละ KPI ที่ {staff?.name} ยอมรับ · น้ำหนัก Supervisor <strong>60%</strong>
          · สูตร: Staff×0.40 + Supervisor×0.60
        </span>
      </div>

      {/* KPI Status overview */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'KPI ทั้งหมด', value: staffKpis.length, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
          { label: 'ยอมรับแล้ว', value: accepted.length, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'รอยืนยัน/ปฏิเสธ', value: staffKpis.length - accepted.length, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl px-4 py-3 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {accepted.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-5 text-center">
          <p className="text-sm text-yellow-700 font-medium">ยังไม่มี KPI ที่ Staff ยอมรับ</p>
          <p className="text-xs text-yellow-600 mt-1">Staff ต้องยืนยัน KPI ก่อนจึงจะให้คะแนนได้</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-100">
            <p className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
              <Star size={12} /> ให้คะแนน KPI — {staff?.name} · {quarter} (Supervisor 60%) · ข้อละ {maxPerItem} คะแนน
            </p>
            {saved && (
              <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> บันทึกแล้ว
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {accepted.map((kpi, idx) => (
              <div key={kpi.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{kpi.title}</p>
                      <StatusBadge status={kpi.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">วิธีประเมิน: {kpi.assessmentMethod}</p>
                    {kpi.remark && <p className="text-xs text-gray-400 mt-0.5">หมายเหตุ: {kpi.remark}</p>}
                    {staffEval?.kpiScores?.[kpi.id] != null && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        Staff ให้คะแนนตัวเอง: <strong>{staffEval.kpiScores[kpi.id]}/{maxPerItem}</strong>
                      </p>
                    )}
                  </div>
                </div>
                <ScoreSlider
                  value={scores[kpi.id] ?? 0}
                  onChange={(v) => { setScores((p) => ({ ...p, [kpi.id]: v })); setSaved(false) }}
                  disabled={saved}
                  label="คะแนน Supervisor"
                  maxScore={maxPerItem}
                />
              </div>
            ))}

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                รวม Supervisor: <strong className="text-indigo-600">{accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0)}</strong> / {maxPossible}
                <span className="text-gray-400 ml-2">(น้ำหนัก 60% → {Math.round(accepted.reduce((s, k) => s + (scores[k.id] ?? 0), 0) * 0.60 * 100) / 100} pts)</span>
              </p>
              {!saved && (
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">
                  <Save size={12} /> บันทึกคะแนน Supervisor
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weighted score summary */}
      {(staffTotal !== null || supTotal !== null) && (
        <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border text-sm ${weightedScore !== null ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex-1 space-y-1">
            <p className="text-xs font-semibold text-gray-700">สรุปคะแนน Part 3</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <span>Staff: <strong className="text-blue-600">{staffTotal ?? '—'}/{maxPossible}</strong> ×0.40</span>
              <span>Sup: <strong className="text-indigo-600">{supTotal ?? '—'}/{maxPossible}</strong> ×0.60</span>
              <span className="text-gray-400">(ข้อละ {maxPerItem} คะแนน)</span>
              {weightedScore !== null && (
                <span className="font-semibold text-green-700">
                  = {staffTotal}×0.40 + {supTotal}×0.60 = <strong>{weightedScore} / 30</strong>
                </span>
              )}
              {weightedScore === null && (
                <span className="text-yellow-600">รอข้อมูลครบทั้งสองฝ่าย</span>
              )}
            </div>
          </div>
          {weightedScore !== null && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400">คะแนน Part 3</p>
              <p className={`text-2xl font-extrabold ${weightedScore >= 24 ? 'text-green-600' : weightedScore >= 18 ? 'text-yellow-600' : 'text-red-500'}`}>
                {weightedScore}
                <span className="text-sm text-gray-400 font-medium ml-1">/ 30</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Part3KpiEval({ staffId, quarter, year, isSupervisor, onComplete }) {
  // isSupervisor = true when the current user is assigned as supervisorId for this staff in staffConfig
  if (isSupervisor) {
    return <SupervisorScoringPanel staffId={staffId} quarter={quarter} year={year} onComplete={onComplete} />
  }
  return <StaffScoringPanel staffId={staffId} quarter={quarter} year={year} onComplete={onComplete} />
}
