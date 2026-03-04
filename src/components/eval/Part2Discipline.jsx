import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import {
  CheckCircle2, Save, Shield, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, Info, Lock
} from 'lucide-react'

/**
 * Each month starts at 20 pts. HR enters actual usage counts → system deducts automatically.
 * Quarter score = average of 3 monthly scores.
 *
 * Deduction rules:
 *  ลาป่วย    : ≤5d=0, 6-10d=-1, 11-20d=-2, >20d=-4   (max -4)
 *  ลากิจ     : ≤2d=0, 3-4d=-1, 5-6d=-2, >6d=-3        (max -3)
 *  ลาพักร้อน : ≤quota=0, เกิน1-3d=-1, เกิน>3d=-2        (max -2)
 *  ขาดงาน   : 0d=0, 1d=-3, 2d=-5, ≥3d=-8              (max -8)
 *  ใบเตือน  : 0=-0, 1=-2, ≥2=-3                        (max -3)
 * Total max deduction = 4+3+2+8+3 = 20 → score range 0–20
 */

const DEDUCTION_RULES = {
  sick: (d) => d <= 5 ? 0 : d <= 10 ? -1 : d <= 20 ? -2 : -4,
  personal: (d) => d <= 2 ? 0 : d <= 4 ? -1 : d <= 6 ? -2 : -3,
  vacation: (d, quota) => {
    const over = d - quota
    return over <= 0 ? 0 : over <= 3 ? -1 : -2
  },
  absent: (d) => d === 0 ? 0 : d === 1 ? -3 : d === 2 ? -5 : -8,
  warning: (n) => n === 0 ? 0 : n === 1 ? -2 : -3,
}

const CRITERIA_TABLE = [
  {
    key: 'sick', label: 'ลาป่วย', unit: 'วัน', quota: 30,
    hint: 'โควต้า ≤30 วัน/ปี',
    rules: [
      { range: '0 – 5 วัน',  deduct: 0,  label: 'ปกติ' },
      { range: '6 – 10 วัน', deduct: -1, label: '-1 คะแนน' },
      { range: '11 – 20 วัน',deduct: -2, label: '-2 คะแนน' },
      { range: '> 20 วัน',   deduct: -4, label: '-4 คะแนน' },
    ],
  },
  {
    key: 'personal', label: 'ลากิจ', unit: 'วัน', quota: 6,
    hint: 'โควต้า ≤6 วัน/ปี',
    rules: [
      { range: '0 – 2 วัน',  deduct: 0,  label: 'ปกติ' },
      { range: '3 – 4 วัน',  deduct: -1, label: '-1 คะแนน' },
      { range: '5 – 6 วัน',  deduct: -2, label: '-2 คะแนน' },
      { range: '> 6 วัน',    deduct: -3, label: '-3 คะแนน' },
    ],
  },
  {
    key: 'vacation', label: 'ลาพักร้อน', unit: 'วัน', quota: null,
    hint: 'โควต้าขึ้นอยู่กับแต่ละบุคคล (HR กรอก)',
    rules: [
      { range: '≤ โควต้า',       deduct: 0,  label: 'ปกติ' },
      { range: 'เกิน 1 – 3 วัน', deduct: -1, label: '-1 คะแนน' },
      { range: 'เกิน > 3 วัน',   deduct: -2, label: '-2 คะแนน' },
    ],
  },
  {
    key: 'absent', label: 'ขาดงาน (ไม่ลา)', unit: 'ครั้ง', quota: 0,
    hint: 'ขาดโดยไม่แจ้งลา',
    rules: [
      { range: '0 ครั้ง',  deduct: 0,  label: 'ปกติ' },
      { range: '1 ครั้ง',  deduct: -3, label: '-3 คะแนน' },
      { range: '2 ครั้ง',  deduct: -5, label: '-5 คะแนน' },
      { range: '≥ 3 ครั้ง',deduct: -8, label: '-8 คะแนน' },
    ],
  },
  {
    key: 'warning', label: 'ใบเตือน', unit: 'ฉบับ', quota: 0,
    hint: 'ใบเตือนจากการกระทำผิดวินัย',
    rules: [
      { range: '0 ฉบับ',  deduct: 0,  label: 'ปกติ' },
      { range: '1 ฉบับ',  deduct: -2, label: '-2 คะแนน' },
      { range: '≥ 2 ฉบับ',deduct: -3, label: '-3 คะแนน' },
    ],
  },
]

const MONTHS_IN_QUARTER = {
  Q1: ['มกราคม',  'กุมภาพันธ์', 'มีนาคม'],
  Q2: ['เมษายน',  'พฤษภาคม',   'มิถุนายน'],
  Q3: ['กรกฎาคม', 'สิงหาคม',   'กันยายน'],
  Q4: ['ตุลาคม',  'พฤศจิกายน', 'ธันวาคม'],
}

const BLANK_MONTH = (vacationQuota = 0) => ({
  sick: '',
  personal: '',
  vacation: '',
  absent: '',
  warning: '',
  vacationQuota,
  note: '',
})

function calcMonthScore(m) {
  const s = (v) => (v === '' || v === undefined ? null : Number(v))
  const sick     = s(m.sick)
  const personal = s(m.personal)
  const vacation = s(m.vacation)
  const absent   = s(m.absent)
  const warning  = s(m.warning)
  const quota    = Number(m.vacationQuota) || 0

  if ([sick, personal, vacation, absent, warning].every((v) => v === null)) return null

  const ded =
    DEDUCTION_RULES.sick(sick ?? 0) +
    DEDUCTION_RULES.personal(personal ?? 0) +
    DEDUCTION_RULES.vacation(vacation ?? 0, quota) +
    DEDUCTION_RULES.absent(absent ?? 0) +
    DEDUCTION_RULES.warning(warning ?? 0)

  return Math.max(0, 20 + ded)
}

function deductionBreakdown(m) {
  const s = (v) => (v === '' || v === undefined ? 0 : Number(v))
  const quota = Number(m.vacationQuota) || 0
  return [
    { label: 'ลาป่วย',         val: s(m.sick),     ded: DEDUCTION_RULES.sick(s(m.sick)) },
    { label: 'ลากิจ',          val: s(m.personal), ded: DEDUCTION_RULES.personal(s(m.personal)) },
    { label: 'ลาพักร้อน',      val: s(m.vacation), ded: DEDUCTION_RULES.vacation(s(m.vacation), quota) },
    { label: 'ขาดงาน (ไม่ลา)', val: s(m.absent),   ded: DEDUCTION_RULES.absent(s(m.absent)) },
    { label: 'ใบเตือน',        val: s(m.warning),  ded: DEDUCTION_RULES.warning(s(m.warning)) },
  ]
}

function MonthCard({ monthName, monthIdx, data, onUpdate, disabled, vacationQuota }) {
  const [open, setOpen] = useState(monthIdx === 0)
  const score = calcMonthScore(data)
  const breakdown = deductionBreakdown(data)
  const totalDed = breakdown.reduce((s, b) => s + b.ded, 0)

  const scoreColor =
    score === null ? 'text-gray-400' :
    score >= 18 ? 'text-green-600' :
    score >= 14 ? 'text-yellow-600' :
    score >= 10 ? 'text-orange-500' : 'text-red-600'

  const set = (key, val) => onUpdate({ ...data, [key]: val })

  return (
    <div className={`rounded-xl border transition-all ${score === null ? 'border-gray-200 bg-white' : score >= 18 ? 'border-green-200 bg-green-50' : score >= 14 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
      {/* Month header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{monthName}</span>
          {score !== null && (
            <span className={`text-sm font-extrabold ${scoreColor}`}>{score} / 20</span>
          )}
          {score === null && <span className="text-xs text-gray-400">ยังไม่ได้กรอกข้อมูล</span>}
        </div>
        <div className="flex items-center gap-2">
          {totalDed < 0 && (
            <span className="text-xs text-red-600 font-semibold bg-red-100 px-2 py-0.5 rounded-full">{totalDed} pts</span>
          )}
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Vacation quota (HR sets per staff) */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold text-gray-600 shrink-0">โควต้าลาพักร้อน (วัน):</label>
            <input
              type="number" min={0} max={30}
              value={data.vacationQuota}
              disabled={disabled}
              onChange={(e) => set('vacationQuota', e.target.value)}
              className="w-20 px-2 py-1 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50"
            />
            <span className="text-xs text-gray-400">วัน/ปี (HR กรอกตามสิทธิ์ของพนักงาน)</span>
          </div>

          {/* 5 input fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: 'sick',     label: 'ลาป่วย',          unit: 'วัน',  max: 30, placeholder: '0' },
              { key: 'personal', label: 'ลากิจ',            unit: 'วัน',  max: 10, placeholder: '0' },
              { key: 'vacation', label: 'ลาพักร้อน',        unit: 'วัน',  max: 30, placeholder: '0' },
              { key: 'absent',   label: 'ขาดงาน (ไม่ลา)',  unit: 'ครั้ง', max: 10, placeholder: '0' },
              { key: 'warning',  label: 'ใบเตือน',          unit: 'ฉบับ', max: 5,  placeholder: '0' },
            ].map((f) => {
              const ded = breakdown.find((b) => b.label.startsWith(f.label.split(' ')[0]))?.ded ?? 0
              const hasDeduction = ded < 0
              return (
                <div key={f.key} className={`rounded-lg border p-2.5 ${hasDeduction ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">{f.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} max={f.max}
                      value={data[f.key]}
                      disabled={disabled}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={`w-full px-2 py-1.5 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-400 ${hasDeduction ? 'border-red-300 bg-white' : 'border-gray-200'}`}
                    />
                    <span className="text-[10px] text-gray-400 shrink-0">{f.unit}</span>
                  </div>
                  {hasDeduction && (
                    <p className="text-[10px] text-red-600 font-semibold mt-1">{ded} คะแนน</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">สรุปการหักคะแนนเดือนนี้</p>
            <div className="space-y-1">
              {breakdown.map((b) => (
                <div key={b.label} className="flex justify-between text-xs">
                  <span className="text-gray-600">{b.label}</span>
                  <span className={b.ded < 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                    {b.ded < 0 ? `${b.ded}` : '–'}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between text-xs font-bold">
                <span className="text-gray-700">คะแนนเดือนนี้</span>
                <span className={scoreColor}>{score !== null ? `${score} / 20` : '—'}</span>
              </div>
            </div>
          </div>

          {/* Note */}
          <input
            type="text"
            disabled={disabled}
            value={data.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="หมายเหตุเพิ่มเติม (เช่น รายละเอียดใบเตือน หรือสาเหตุการขาดงาน)..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 placeholder:text-gray-300"
          />
        </div>
      )}
    </div>
  )
}

function CriteriaGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Info size={14} className="text-indigo-500 shrink-0" />
        <span className="text-xs font-semibold text-indigo-700">ดูเกณฑ์การหักคะแนนวินัย</span>
        {open ? <ChevronUp size={13} className="text-indigo-400 ml-auto" /> : <ChevronDown size={13} className="text-indigo-400 ml-auto" />}
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CRITERIA_TABLE.map((c) => (
            <div key={c.key} className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-xs font-bold text-indigo-700 mb-0.5">{c.label}</p>
              <p className="text-[10px] text-gray-400 mb-2">{c.hint}</p>
              <table className="w-full text-[11px]">
                <tbody>
                  {c.rules.map((r, i) => (
                    <tr key={i} className={r.deduct < 0 ? 'text-red-600' : 'text-green-600'}>
                      <td className="py-0.5 pr-2">{r.range}</td>
                      <td className="py-0.5 font-semibold text-right">{r.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="sm:col-span-2 bg-indigo-100 rounded-lg px-3 py-2 text-[11px] text-indigo-700">
            <strong>สูตรคำนวณ:</strong> คะแนนแต่ละเดือน = 20 – ผลรวมการหักคะแนน (ขั้นต่ำ 0) <br />
            <strong>คะแนน Part 2 (ต่อ Quarter)</strong> = ค่าเฉลี่ยของ 3 เดือน → สูงสุด 20 คะแนน
          </div>
        </div>
      )}
    </div>
  )
}

const BLANK_MONTHS = () => ({ M1: BLANK_MONTH(), M2: BLANK_MONTH(), M3: BLANK_MONTH() })

function buildInitial(existing) {
  if (!existing?.months) return BLANK_MONTHS()
  return {
    M1: { ...BLANK_MONTH(), ...existing.months.M1 },
    M2: { ...BLANK_MONTH(), ...existing.months.M2 },
    M3: { ...BLANK_MONTH(), ...existing.months.M3 },
  }
}

export default function Part2Discipline({ staffId, quarter, year }) {
  const { currentUser, saveEvaluation, getEvaluation, getUserById } = useApp()
  const existing = getEvaluation(year, quarter, staffId, currentUser.id, 'part2')

  const [months, setMonths] = useState(() => buildInitial(existing))
  const [hrmApproved, setHrmApproved] = useState(existing?.hrmApproved ?? false)
  const [hrmRemark, setHrmRemark] = useState(existing?.hrmRemark ?? '')
  const [saved, setSaved] = useState(!!existing)

  const staff = getUserById(staffId)
  const isHR = currentUser?.role === 'HR'
  const isHRM = currentUser?.role === 'MD'  // MD acts as HRM approver

  const monthNames = MONTHS_IN_QUARTER[quarter] || ['เดือน 1', 'เดือน 2', 'เดือน 3']

  const updateMonth = (key, val) => {
    setSaved(false)
    setMonths((p) => ({ ...p, [key]: val }))
  }

  const scores3 = ['M1', 'M2', 'M3'].map((k) => calcMonthScore(months[k])).filter((s) => s !== null)
  const quarterScore = scores3.length > 0
    ? Math.round((scores3.reduce((a, b) => a + b, 0) / scores3.length) * 100) / 100
    : null

  const handleSave = () => {
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole: 'HR',
      part: 'part2',
      months,
      hrmApproved,
      hrmRemark,
      scaledScore: quarterScore,
      rawTotal: quarterScore,
    })
    setSaved(true)
  }

  const handleApprove = (approve) => {
    setHrmApproved(approve)
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole: 'HR',
      part: 'part2',
      months,
      hrmApproved: approve,
      hrmRemark,
      scaledScore: quarterScore,
      rawTotal: quarterScore,
    })
    setSaved(true)
  }

  const scoreColor = (s) =>
    s === null ? 'text-gray-400' :
    s >= 18 ? 'text-green-600' :
    s >= 14 ? 'text-yellow-600' :
    s >= 10 ? 'text-orange-500' : 'text-red-600'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${ROLE_AVATAR_BG[staff?.role] || 'bg-gray-400'} flex items-center justify-center text-white text-sm font-bold`}>
            {staff?.name?.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{staff?.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield size={11} className="text-green-600" />
              <p className="text-xs text-green-700 font-medium">Part 2 — วินัย (HR กรอก / HRM อนุมัติ)</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">คะแนน Part 2 ({scores3.length}/3 เดือน)</p>
            <p className={`text-2xl font-extrabold ${scoreColor(quarterScore)}`}>
              {quarterScore !== null ? quarterScore : '—'}
              <span className="text-sm font-medium text-gray-400 ml-1">/ 20</span>
            </p>
          </div>
          {/* HRM Approval status badge */}
          {hrmApproved && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              <Lock size={11} /> อนุมัติแล้ว
            </div>
          )}
        </div>
      </div>

      {/* Criteria guide (collapsible) */}
      <CriteriaGuide />

      {/* HR save / edit buttons */}
      {isHR && !hrmApproved && (
        <div className="flex gap-2 justify-end">
          {saved && (
            <button
              onClick={() => setSaved(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              แก้ไข
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
            disabled={scores3.length === 0}
          >
            <Save size={14} /> บันทึกข้อมูล HR
          </button>
        </div>
      )}

      {saved && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${hrmApproved ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <CheckCircle2 size={15} className={hrmApproved ? 'text-green-600' : 'text-blue-500'} />
          <p className={`text-sm font-medium ${hrmApproved ? 'text-green-700' : 'text-blue-700'}`}>
            {hrmApproved
              ? <>คะแนน Part 2 อนุมัติแล้ว — <strong>{quarterScore} / 20</strong></>
              : <>บันทึกข้อมูลแล้ว — รอ HRM อนุมัติ · คะแนนเบื้องต้น: <strong>{quarterScore} / 20</strong></>
            }
          </p>
        </div>
      )}

      {/* 3 month cards */}
      <div className="space-y-3">
        {(['M1', 'M2', 'M3']).map((mk, idx) => (
          <MonthCard
            key={mk}
            monthIdx={idx}
            monthName={monthNames[idx]}
            data={months[mk]}
            onUpdate={(val) => updateMonth(mk, val)}
            disabled={!isHR || hrmApproved}
            vacationQuota={months[mk].vacationQuota}
          />
        ))}
      </div>

      {/* Quarter summary */}
      {scores3.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">สรุปคะแนน Quarter {quarter}</p>
          <div className="flex items-center gap-3 mb-3">
            {(['M1', 'M2', 'M3']).map((mk, idx) => {
              const s = calcMonthScore(months[mk])
              return (
                <div key={mk} className="flex-1 text-center">
                  <p className="text-[10px] text-gray-400">{monthNames[idx]}</p>
                  <p className={`text-xl font-bold mt-0.5 ${scoreColor(s)}`}>{s !== null ? s : '—'}</p>
                  <div className="mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s === null ? '' : s >= 18 ? 'bg-green-500' : s >= 14 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: s !== null ? `${(s / 20) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="w-px bg-gray-200 self-stretch mx-1" />
            <div className="text-center shrink-0">
              <p className="text-[10px] text-gray-400">เฉลี่ย</p>
              <p className={`text-2xl font-extrabold mt-0.5 ${scoreColor(quarterScore)}`}>{quarterScore ?? '—'}</p>
              <p className="text-[10px] text-gray-400">/ 20</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            สูตร: ({scores3.join(' + ')}) / {scores3.length} = <strong className={scoreColor(quarterScore)}>{quarterScore}</strong>
          </p>
        </div>
      )}

      {/* HRM approval section */}
      {saved && !hrmApproved && (isHRM || isHR) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">การอนุมัติโดย HRM (MD)</p>
          </div>
          <p className="text-xs text-amber-700">ตรวจสอบข้อมูลและอนุมัติหรือส่งกลับแก้ไข</p>
          <textarea
            rows={2}
            value={hrmRemark}
            onChange={(e) => setHrmRemark(e.target.value)}
            placeholder="หมายเหตุของ HRM (ถ้ามี)..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder:text-gray-300 resize-none"
          />
          {isHRM && (
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
              >
                <ThumbsUp size={13} /> อนุมัติ
              </button>
              <button
                onClick={() => { setHrmApproved(false); setSaved(false) }}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100"
              >
                <ThumbsDown size={13} /> ส่งกลับแก้ไข
              </button>
            </div>
          )}
          {!isHRM && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <Lock size={11} /> รอ MD (HRM) เข้าสู่ระบบเพื่ออนุมัติ
            </p>
          )}
        </div>
      )}

      {/* Approved remark display */}
      {hrmApproved && hrmRemark && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 size={13} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-green-700">หมายเหตุ HRM:</p>
            <p className="text-xs text-green-600">{hrmRemark}</p>
          </div>
        </div>
      )}
    </div>
  )
}
