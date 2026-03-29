import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_AVATAR_BG, ROLE_BADGE_CLASSES } from '../../hooks/useRBAC'
import { CheckCircle2, AlertCircle, Save, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { DEFAULT_COMPETENCIES } from '../admin/CompetencyTab'

// Badge classes for evaluatorRole strings (functional roles, not user roles)
const EVAL_ROLE_BADGE = {
  Staff:       'bg-blue-100 text-blue-800 ring-blue-200',
  Supervisor:  'bg-purple-100 text-purple-800 ring-purple-200',
  Stakeholder: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  HR:          'bg-green-100 text-green-800 ring-green-200',
  MD:          'bg-red-100 text-red-800 ring-red-200',
}

const SCALE_MAX = 10

// Helper: get the competency list from config or defaults
function getCompetencyList(data) {
  const cfg = data?.competencyConfig
  if (Array.isArray(cfg?.items) && cfg.items.length > 0) return cfg.items
  return DEFAULT_COMPETENCIES
}

// Exported for scoreUtils to use
export function getCompetencyListFromData(data) {
  return getCompetencyList(data)
}

export function getPart1MaxRaw(data) {
  return getCompetencyList(data).length * SCALE_MAX
}

export const COMPETENCY_LIST = DEFAULT_COMPETENCIES // backward compat — but prefer getCompetencyList(data)
export const PART1_MAX_RAW = DEFAULT_COMPETENCIES.length * SCALE_MAX
export const PART1_WEIGHTS = { Staff: 0.20, Supervisor: 0.50, Stakeholder: 0.30, HR: 0.50 }

function commentRequired(score) {
  return score < (SCALE_MAX * 0.4) || score > (SCALE_MAX * 0.9) // <4 or >9
}

function scoreColor(s) {
  if (s <= 2) return { track: '#ef4444', text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    badge: 'text-red-700'    }
  if (s <= 4) return { track: '#fb923c', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'text-orange-700' }
  if (s <= 6) return { track: '#facc15', text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'text-yellow-700' }
  if (s <= 8) return { track: '#22c55e', text: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  badge: 'text-green-700'  }
  return       { track: '#6366f1', text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'text-indigo-700' }
}

function bandLabel(s) {
  if (s <= 2) return 'ต้องปรับปรุง'
  if (s <= 4) return 'ต่ำกว่ามาตรฐาน'
  if (s <= 6) return 'พอใช้'
  if (s <= 8) return 'ดี'
  return 'ดีเยี่ยม'
}

function CompetencyRow({ num, item, score, comment, onChange, onCommentChange, disabled }) {
  const [open, setOpen] = useState(false)
  const c = scoreColor(score)
  const pct = (score / SCALE_MAX) * 100
  const needsComment = commentRequired(score)

  return (
    <div className={`rounded-xl border p-4 transition-all ${c.bg} ${c.border}`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-6 h-6 rounded-full bg-white/60 border border-current flex items-center justify-center text-xs font-bold mt-0.5" style={{ color: c.track }}>
          {num}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</p>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white/70 text-xs font-bold shrink-0 ${c.border} ${c.badge}`}>
              <span className="text-base font-extrabold" style={{ color: c.track }}>{score}</span>
              <span className="opacity-60">/ {SCALE_MAX}</span>
              <span className="opacity-70">· {bandLabel(score)}</span>
            </div>
          </div>
          {item.desc && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 mt-1 transition-colors"
            >
              {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {open ? 'ซ่อนคำอธิบาย' : 'ดูคำอธิบาย'}
            </button>
          )}
          {open && item.desc && (
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</p>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="mt-3 px-1">
        <div className="flex h-1 rounded-full overflow-hidden mb-2 gap-px">
          <div className="flex-[20] bg-red-300 rounded-l-full" />
          <div className="flex-[20] bg-orange-300" />
          <div className="flex-[20] bg-yellow-300" />
          <div className="flex-[20] bg-green-400" />
          <div className="flex-[20] bg-indigo-400 rounded-r-full" />
        </div>
        <input
          type="range" min={0} max={SCALE_MAX} step={1} value={score} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
          style={{ background: `linear-gradient(to right, ${c.track} ${pct}%, #e5e7eb ${pct}%)` }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-1 px-0.5">
          <span>0</span><span className="text-red-400">2</span><span className="text-orange-400">4</span>
          <span className="text-yellow-500">6</span><span className="text-green-500">8</span><span className="text-indigo-500">{SCALE_MAX}</span>
        </div>
      </div>

      {/* Comment */}
      <div className="mt-3">
        {needsComment && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle size={12} className="text-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-amber-600">
              {score < SCALE_MAX * 0.4
                ? 'กรุณาระบุเหตุผลและยกตัวอย่างประกอบ (คะแนนต่ำ)'
                : 'กรุณาระบุเหตุผลและยกตัวอย่างที่ชัดเจน (คะแนนสูง)'}
            </p>
          </div>
        )}
        <textarea
          rows={needsComment ? 2 : 1}
          disabled={disabled}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={
            needsComment
              ? score < SCALE_MAX * 0.4
                ? 'ระบุเหตุผลที่ให้คะแนนต่ำ พร้อมยกตัวอย่างประกอบ...'
                : 'ระบุเหตุผลที่ให้คะแนนสูง พร้อมยกตัวอย่างที่เห็นภาพ...'
              : 'หมายเหตุเพิ่มเติม (ไม่บังคับ)...'
          }
          className={`w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2 bg-white disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-300 ${
            needsComment && !comment.trim()
              ? 'border-amber-400 focus:ring-amber-400'
              : 'border-gray-200 focus:ring-indigo-300'
          }`}
        />
        {needsComment && !comment.trim() && (
          <p className="text-xs text-amber-600 mt-1">↑ จำเป็นต้องกรอกก่อนบันทึก</p>
        )}
      </div>
    </div>
  )
}

export default function Part1Competency({ staffId, quarter, year, evaluatorRole }) {
  const { currentUser, saveEvaluation, getEvaluation, getUserById, data } = useApp()

  const competencyList = getCompetencyList(data)
  const maxRaw = competencyList.length * SCALE_MAX

  const existing = getEvaluation(year, quarter, staffId, currentUser.id, 'part1')

  const buildInitial = (existing) => {
    if (!existing?.scores) {
      return Object.fromEntries(competencyList.map((c) => [c.key, { score: Math.round(SCALE_MAX / 2), comment: '' }]))
    }
    return Object.fromEntries(
      competencyList.map((c) => [
        c.key,
        { score: existing.scores[c.key]?.score ?? Math.round(SCALE_MAX / 2), comment: existing.scores[c.key]?.comment ?? '' },
      ])
    )
  }

  const [scores, setScores] = useState(() => buildInitial(existing))
  const [saved, setSaved] = useState(!!existing)
  const [errors, setErrors] = useState([])

  const staff = getUserById(staffId)

  const updateScore = (key, score) => {
    setSaved(false)
    setScores((p) => ({ ...p, [key]: { ...p[key], score } }))
  }
  const updateComment = (key, comment) => {
    setSaved(false)
    setScores((p) => ({ ...p, [key]: { ...p[key], comment } }))
  }

  const rawTotal = competencyList.reduce((s, c) => s + (scores[c.key]?.score ?? 0), 0)

  const validate = () => {
    const missing = competencyList.filter(
      (c) => commentRequired(scores[c.key]?.score ?? 0) && !(scores[c.key]?.comment ?? '').trim()
    ).map((c) => c.title)
    setErrors(missing)
    return missing.length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole,
      part: 'part1',
      scores,
      rawTotal,
    })
    setSaved(true)
    setErrors([])
  }

  // Preview weighted score
  const allP1 = data.quarterlyEvaluations.filter(
    (e) => e.staffId === staffId && e.year === year && e.quarter === quarter && e.part === 'part1'
  )
  const previewWeighted = (() => {
    const saved_staff = allP1.find((e) => e.evaluatorRole === 'Staff')
    const saved_sup   = allP1.find((e) => e.evaluatorRole === 'Supervisor')
    const saved_stake = allP1.find((e) => e.evaluatorRole === 'Stakeholder')
    const saved_hr    = allP1.find((e) => e.evaluatorRole === 'HR')
    if (!saved_staff && !saved_sup && !saved_stake && !saved_hr) return null
    const sRaw = saved_staff?.rawTotal ?? 0
    const supRaw = saved_sup?.rawTotal ?? 0
    const stRaw = saved_stake?.rawTotal ?? 0
    const hrRaw = saved_hr?.rawTotal ?? 0
    const effectiveSup = saved_sup ? supRaw : (saved_hr ? hrRaw : 0)
    const weighted = sRaw * 0.20 + effectiveSup * 0.50 + stRaw * 0.30
    return Math.round((weighted / maxRaw) * 30 * 100) / 100
  })()

  const myEstimate = Math.round((rawTotal / maxRaw) * 30 * 100) / 100

  const isComplete = competencyList.every((c) => {
    const s = scores[c.key]?.score ?? Math.round(SCALE_MAX / 2)
    const comm = scores[c.key]?.comment ?? ''
    return !commentRequired(s) || comm.trim() !== ''
  })

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
            <p className="text-xs text-gray-500">
              ประเมินในฐานะ:{' '}
              <span className={`font-semibold px-1.5 py-0.5 rounded-full ring-1 ${EVAL_ROLE_BADGE[evaluatorRole] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                {evaluatorRole}
              </span>
              <span className="ml-2 text-gray-400">
                น้ำหนัก: <strong className="text-gray-600">{(PART1_WEIGHTS[evaluatorRole] ?? 0) * 100}%</strong>
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">คะแนนของฉัน ({rawTotal}/{maxRaw})</p>
            <p className="text-lg font-extrabold text-indigo-500">{myEstimate} <span className="text-xs font-normal text-gray-400">pt weighted</span></p>
          </div>
          {!saved && (
            <button
              onClick={handleSave}
              disabled={!isComplete}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                isComplete 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save size={14} /> บันทึก
            </button>
          )}
        </div>
      </div>

      {/* Weight info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-indigo-50 border-indigo-200">
        <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700">
          <p className="font-semibold mb-1">สูตรคำนวณคะแนน Part 1 (รวม 30 คะแนน)</p>
          <p>[ Staff×20% + Supervisor×50% + Stakeholder×30% ] / {maxRaw} × 30</p>
          <p className="mt-1 text-indigo-500">แต่ละหัวข้อมีคะแนนเต็ม {SCALE_MAX} คะแนน รวม {competencyList.length} หัวข้อ = {maxRaw} คะแนน</p>
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-red-50 border-red-200">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">กรุณากรอกความคิดเห็นในหัวข้อต่อไปนี้ก่อนบันทึก:</p>
            <ul className="text-xs text-red-600 mt-1 space-y-0.5 list-disc list-inside">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Saved banner */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 size={15} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-medium">
            บันทึกแล้ว — คะแนนดิบ: <strong>{rawTotal} / {maxRaw}</strong>
            {previewWeighted !== null && (
              <span className="ml-2 text-indigo-700">→ คะแนนรวมถ่วงน้ำหนัก (เบื้องต้น): <strong>{previewWeighted} / 30</strong></span>
            )}
          </p>
        </div>
      )}

      {/* Weighted preview box */}
      {previewWeighted !== null && (
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200 px-5 py-4">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">สรุปคะแนน Part 1 (ถ่วงน้ำหนัก)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {(['Staff', 'Supervisor', 'Stakeholder', 'HR']).map((role) => {
              const e = allP1.find((x) => x.evaluatorRole === role)
              const w = PART1_WEIGHTS[role]
              return (
                <div key={role} className="bg-white rounded-lg border border-indigo-100 p-3 text-center">
                  <p className="text-[11px] text-gray-500 font-medium">{role}</p>
                  <p className="text-lg font-extrabold text-gray-900 mt-0.5">
                    {e ? e.rawTotal : <span className="text-gray-300">—</span>}
                    <span className="text-xs font-normal text-gray-400"> /{maxRaw}</span>
                  </p>
                  <p className="text-[10px] text-indigo-500 mt-0.5">น้ำหนัก {w * 100}%</p>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between bg-white rounded-lg border border-indigo-200 px-4 py-2.5">
            <p className="text-xs text-indigo-700 font-medium">คะแนนสรุป Part 1</p>
            <p className="text-2xl font-extrabold text-indigo-700">{previewWeighted} <span className="text-sm font-medium text-gray-400">/ 30</span></p>
          </div>
        </div>
      )}

      {/* Competency rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {competencyList.map((item, idx) => (
          <CompetencyRow
            key={item.key}
            num={idx + 1}
            item={item}
            score={scores[item.key]?.score ?? Math.round(SCALE_MAX / 2)}
            comment={scores[item.key]?.comment ?? ''}
            onChange={(v) => updateScore(item.key, v)}
            onCommentChange={(v) => updateComment(item.key, v)}
            disabled={saved}
          />
        ))}
      </div>

      {/* Score summary strip */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">สรุปคะแนนดิบ</p>
          <p className="text-xs text-gray-500">
            {rawTotal} / {maxRaw} → คาดการณ์ส่วนตัว: <strong className="text-indigo-600">{myEstimate} pts</strong>
          </p>
        </div>
        <div className="flex gap-0.5">
          {competencyList.map((item) => {
            const s = scores[item.key]?.score ?? 0
            const pct = (s / SCALE_MAX) * 100
            const c = scoreColor(s)
            return (
              <div key={item.key} className="flex-1">
                <div className="bg-gray-100 rounded-sm h-2 overflow-hidden">
                  <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, background: c.track }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>ข้อ 1</span><span>ข้อ {competencyList.length}</span>
        </div>
      </div>
    </div>
  )
}
