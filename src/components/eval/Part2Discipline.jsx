import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import useRBAC, { ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import {
  CheckCircle2, Save, Shield, ChevronDown, ChevronUp,
  Info, Lock
} from 'lucide-react'
import {
  calculateMonthScore,
  calculateQuarterScore,
  getCategoryMeta,
  getDisciplineBreakdown,
  getDisciplineRulesForYear,
  getRulesForCategory,
  formatRuleRange,
} from '../../utils/disciplineRules'
import { getLeaveUsageByQuarter } from '../../services/leaveSyncUtils'

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

const CRITERIA_HINTS = {
  sick: 'โควต้าประมาณ 30 วัน/ปี',
  personal: 'โควต้าประมาณ 6 วัน/ปี',
  vacation: 'ใช้จำนวนวันที่เกินโควต้าพักร้อนของพนักงาน',
  absent: 'ขาดโดยไม่แจ้งลา',
  warning: 'ใบเตือนจากการกระทำผิดวินัย',
}

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

function formatLeaveDays(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)))
}

function MonthCard({ monthName, data, onUpdate, disabled, rules }) {
  const score = calculateMonthScore(data, rules)
  const breakdown = getDisciplineBreakdown(data, rules)
  const totalDed = breakdown.reduce((s, b) => s + b.ded, 0)

  const scoreColor =
    score === null ? 'text-gray-400' :
    score >= 18 ? 'text-green-600' :
    score >= 14 ? 'text-yellow-600' :
    score >= 10 ? 'text-orange-500' : 'text-red-600'

  const set = (key, val) => onUpdate({ ...data, [key]: val })

  return (
    <div className={`rounded-xl border transition-all ${score === null ? 'border-gray-200 bg-white' : score >= 18 ? 'border-green-200 bg-green-50' : score >= 14 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
      {/* Month header — details are always visible so HR can compare all months at once. */}
      <div className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-gray-700">{monthName}</span>
          {score !== null && (
            <span className={`text-sm font-extrabold ${scoreColor}`}>{score} / 20</span>
          )}
          {score === null && <span className="text-xs text-gray-400">ยังไม่ได้กรอกข้อมูล</span>}
        </div>
        <div className="flex items-center gap-2">
          {totalDed < 0 && (
            <span className="text-xs text-red-600 font-semibold bg-red-100 px-2 py-0.5 rounded-full">{totalDed} pts</span>
          )}
        </div>
      </div>

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
              const displayValue = data[f.key] === '' || data[f.key] === undefined || data[f.key] === null ? 0 : data[f.key]
              return (
                <div key={f.key} className={`rounded-lg border p-2.5 ${hasDeduction ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <label className="text-[11px] font-semibold text-gray-600 leading-tight">{f.label}</label>
                    <span className={`text-sm font-extrabold leading-none ${hasDeduction ? 'text-red-700' : 'text-gray-700'}`}>
                      {displayValue}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} max={f.max}
                      value={displayValue}
                      disabled={disabled}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{
                        color: hasDeduction ? '#b91c1c' : '#374151',
                        WebkitTextFillColor: hasDeduction ? '#b91c1c' : '#374151',
                        opacity: 1,
                      }}
                      className={`w-full px-2 py-1.5 text-sm font-medium text-center rounded-md border focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 ${hasDeduction ? 'border-red-300 bg-white' : 'border-gray-200'}`}
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
    </div>
  )
}

function CriteriaGuide({ rules }) {
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
          {['sick', 'personal', 'vacation', 'absent', 'warning'].map((key) => {
            const meta = getCategoryMeta(key)
            const categoryRules = getRulesForCategory(rules, key)
            return (
            <div key={key} className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-xs font-bold text-indigo-700 mb-0.5">{meta.label}</p>
              <p className="text-[10px] text-gray-400 mb-2">{CRITERIA_HINTS[key]}</p>
              <table className="w-full text-[11px]">
                <tbody>
                  {categoryRules.length > 0 && (
                    <tr className="text-green-600">
                      <td className="py-0.5 pr-2">{meta.valueMode === 'overQuota' ? '≤ โควต้า' : `≤ ${categoryRules[0].threshold} ${meta.unit}`}</td>
                      <td className="py-0.5 font-semibold text-right">ปกติ</td>
                    </tr>
                  )}
                  {categoryRules.map((rule) => (
                    <tr key={rule.id} className={rule.deduction < 0 ? 'text-red-600' : 'text-green-600'}>
                      <td className="py-0.5 pr-2">{formatRuleRange(rule)}</td>
                      <td className="py-0.5 font-semibold text-right">{rule.deduction < 0 ? `${rule.deduction} คะแนน` : 'ปกติ'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          })}
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

export default function Part2Discipline({ staffId, quarter, year, staffOverride = null }) {
  const { data: appData, currentUser, saveEvaluation, getEvaluationForPart, getUserById } = useApp()
  const { can } = useRBAC()
  const canEdit = can('canInputDiscipline')
  const disciplineRules = getDisciplineRulesForYear(appData, year)
  const existing = getEvaluationForPart(year, quarter, staffId, 'part2')
  const [months, setMonths] = useState(() => buildInitial(existing))
  const [saved, setSaved] = useState(!!existing)

  const staff = staffOverride || getUserById(staffId)
  const readOnly = !canEdit
  const leaveUsageByQuarter = getLeaveUsageByQuarter(appData?.leaveSyncRecords, {
    year,
    employeeCode: staff?.staffCode || staff?.employee_id || staff?.employeeId,
    userId: staff?.uid || staff?.id || staffId,
  })

  // โหลดข้อมูล Part 2 ที่ HR กรอกเมื่อมีข้อมูลเดิมจาก getEvaluationForPart
  useEffect(() => {
    if (existing) {
      setMonths(buildInitial(existing))
      setSaved(true)
    }
  }, [existing, staffId, quarter, year])

  const monthNames = MONTHS_IN_QUARTER[quarter] || ['เดือน 1', 'เดือน 2', 'เดือน 3']

  const updateMonth = (key, val) => {
    setSaved(false)
    setMonths((p) => ({ ...p, [key]: val }))
  }

  const scores3 = ['M1', 'M2', 'M3'].map((k) => calculateMonthScore(months[k], disciplineRules)).filter((s) => s !== null)
  const quarterScore = calculateQuarterScore(months, disciplineRules)

  const handleSave = () => {
    const evaluatorId = existing?.evaluatorId ?? currentUser.id
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId,
      evaluatorRole: 'HR',
      part: 'part2',
      months,
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
              <p className="text-xs text-green-700 font-medium">
                Part 2 — วินัย (HR กรอก / ใช้ผลจากการ Sync)
                {readOnly && <span className="ml-1.5 text-gray-500 font-normal">· ดูได้อย่างเดียว</span>}
              </p>
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
        </div>
      </div>

      {/* Criteria guide — always visible for quick reference. */}
      <CriteriaGuide rules={disciplineRules} />

      {/* Read-only leave usage by quarter imported from the leave system. */}
      <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-indigo-100 bg-indigo-50">
          <div>
            <p className="text-xs font-bold text-indigo-800">สรุปการใช้วันลาจาก Leave</p>
            <p className="text-[10px] text-indigo-600 mt-0.5">ปี {year} · แสดงจำนวนวันที่ลาอนุมัติแยกตาม Quarter</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-[10px] font-semibold text-indigo-700">
            <Lock size={10} /> Readonly
          </span>
        </div>
        <div className="p-3">
          {appData?.leaveSyncMeta?.[String(year)]?.status === 'synced' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { key: 'sick', label: 'ลาป่วย', cardClass: 'border-blue-200 bg-blue-50', labelClass: 'text-blue-700' },
                { key: 'personal', label: 'ลากิจ', cardClass: 'border-amber-200 bg-amber-50', labelClass: 'text-amber-700' },
                { key: 'vacation', label: 'ลาพักร้อน', cardClass: 'border-emerald-200 bg-emerald-50', labelClass: 'text-emerald-700' },
              ].map((item) => {
                const usedByQuarter = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarterKey) => ({
                  quarter: quarterKey,
                  days: Number(leaveUsageByQuarter[quarterKey]?.[item.key]) || 0,
                }))
                return (
                <div key={item.key} className={`rounded-lg border px-3 py-2.5 ${item.cardClass}`}>
                  <p className={`text-[11px] font-semibold ${item.labelClass}`}>{item.label}</p>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-600">
                    {usedByQuarter.map((entry) => (
                      <p key={entry.quarter}>{entry.quarter}: <strong>{formatLeaveDays(entry.days)} วัน</strong></p>
                    ))}
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-500">
              <Info size={14} className="text-gray-400 shrink-0" />
              ยังไม่มีข้อมูลการลา กรุณากด Sync Leave Data ก่อน
            </div>
          )}
        </div>
      </div>

      {/* แจ้ง Supervisor/Staff ว่าดูได้อย่างเดียว */}
      {readOnly && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600">
          <Lock size={14} className="shrink-0 text-gray-500" />
          <p className="text-xs font-medium">ข้อมูลขาด/ลามาสาย — ดูได้อย่างเดียว (HR เป็นผู้กรอกและแก้ไข)</p>
        </div>
      )}

      {/* HR save / edit buttons */}
      {canEdit && (
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
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-blue-50 border-blue-200">
          <CheckCircle2 size={15} className="text-blue-500" />
          <p className="text-sm font-medium text-blue-700">
            บันทึกข้อมูลแล้ว — คะแนนปัจจุบัน: <strong>{quarterScore} / 20</strong>
          </p>
        </div>
      )}

      {/* 3 month cards — all months stay open for quick comparison and direct entry. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {(['M1', 'M2', 'M3']).map((mk, idx) => (
          <MonthCard
            key={mk}
            monthName={monthNames[idx]}
            data={months[mk]}
            onUpdate={(val) => updateMonth(mk, val)}
            disabled={readOnly || !canEdit}
            rules={disciplineRules}
          />
        ))}
      </div>

      {/* Quarter summary */}
      {scores3.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">สรุปคะแนน Quarter {quarter}</p>
          <div className="flex items-center gap-3 mb-3">
            {(['M1', 'M2', 'M3']).map((mk, idx) => {
              const s = calculateMonthScore(months[mk], disciplineRules)
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

    </div>
  )
}
