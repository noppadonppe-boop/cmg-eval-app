import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLE_AVATAR_BG, ROLE_BADGE_CLASSES } from '../../hooks/useRBAC'
import { CheckCircle2, AlertCircle, Save, ChevronDown, ChevronUp, Info } from 'lucide-react'

// Badge classes for evaluatorRole strings (functional roles, not user roles)
const EVAL_ROLE_BADGE = {
  Staff:       'bg-blue-100 text-blue-800 ring-blue-200',
  Supervisor:  'bg-purple-100 text-purple-800 ring-purple-200',
  Stakeholder: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  HR:          'bg-green-100 text-green-800 ring-green-200',
  MD:          'bg-red-100 text-red-800 ring-red-200',
}

export const COMPETENCY_LIST = [
  {
    key: 'c01',
    title: 'ความรู้ความสามารถ',
    desc: 'ความเข้าใจในงาน สามารถปฏิบัติงานตามหน้าที่ที่ได้รับมอบหมายได้อย่างถูกต้อง มีประสิทธิภาพ',
  },
  {
    key: 'c02',
    title: 'ความคิดสร้างสรรค์',
    desc: 'ความสามารถในการคิดแนวทางใหม่ๆ ปรับปรุงวิธีการทำงาน หรือพัฒนากระบวนการให้มีประสิทธิภาพมากขึ้น โดยสามารถใช้ความรู้และประสบการณ์เพื่อแก้ไขปัญหาและสร้างคุณค่าให้กับองค์กร',
  },
  {
    key: 'c03',
    title: 'มีไหวพริบแก้ปัญหาเฉพาะหน้าได้',
    desc: 'ความสามารถในการวิเคราะห์สถานการณ์ ตัดสินใจและแก้ไขปัญหาที่เกิดขึ้นได้อย่างเหมาะสมและทันท่วงที โดยคำนึงถึงผลกระทบต่องาน ทีม และองค์กร',
  },
  {
    key: 'c04',
    title: 'การทำงานเป็นทีม',
    desc: 'ความสามารถในการร่วมมือ ประสานงาน และสนับสนุนเพื่อนร่วมงานเพื่อให้บรรลุเป้าหมายของทีมและองค์กร',
  },
  {
    key: 'c05',
    title: 'การบริการที่ดี',
    desc: 'ความตั้งใจในการให้บริการ และช่วยเหลือผู้อื่นด้วยความสุภาพ รวดเร็ว และเหมาะสม',
  },
  {
    key: 'c06',
    title: 'การสื่อสารอย่างมีประสิทธิภาพ',
    desc: 'ความสามารถในการถ่ายทอดข้อมูล ความคิดเห็น และคำสั่งงานได้อย่างชัดเจนถูกต้อง ครบถ้วน เหมาะสมกับสถานการณ์และสามารถรับฟังผู้อื่นอย่างเข้าใจเพื่อลดความผิดพลาด',
  },
  {
    key: 'c07',
    title: 'มีความรับผิดชอบ',
    desc: 'ความตั้งใจในการปฏิบัติงานหน้าที่ที่ได้รับมอบหมายอย่างครบถ้วน ถูกต้อง และภายในระยะเวลาที่กำหนด',
  },
  {
    key: 'c08',
    title: 'การปรับตัว',
    desc: 'ความสามารถในการรับมือสถานการณ์ใหม่ การเปลี่ยนแปลงแผนงาน นโยบาย หรือสภาพแวดล้อมในการทำงาน โดยสามารถปรับแนวทางการทำงานได้อย่างเหมาะสม',
  },
  {
    key: 'c09',
    title: 'การวางแผนและการจัดการ',
    desc: 'ความสามารถในการกำหนดเป้าหมาย วางแผนงาน จัดสรรทรัพยากร และบริหารจัดการงานให้เป็นไปตามแผนที่กำหนด โดยสามารถควบคุมระยะเวลา คุณภาพ และงบประมาณได้อย่างมีประสิทธิภาพ',
  },
  {
    key: 'c10',
    title: 'การจัดการทรัพยากร (โครงการ)',
    desc: 'ความสามารถในการวางแผน จัดสรร ควบคุม และใช้ทรัพยากรของโครงการ เช่น แรงงาน / วัสดุ / อุปกรณ์ / เวลา และงบประมาณ ให้เกิดประโยชน์สูงสุด โดยสอดคล้องกับแผนงาน ระยะเวลา และเป้าหมายโครงการ',
  },
  {
    key: 'c11',
    title: 'การบริหารเวลา',
    desc: 'ความสามารถในการวางแผน จัดลำดับความสำคัญ และใช้เวลาในการทำงานอย่างมีประสิทธิภาพ เพื่อให้งานสำเร็จตามกำหนด',
  },
  {
    key: 'c12',
    title: 'ทักษะการเจรจาต่อรอง',
    desc: 'ความสามารถในการสื่อสาร เจรจา และหาข้อตกลงร่วมกันกับผู้ที่เกี่ยวข้อง ทั้งภายในและภายนอกองค์กร โดยคำนึงถึงประโยชน์องค์กร',
  },
  {
    key: 'c13',
    title: 'ความละเอียดรอบคอบ',
    desc: 'ความสามารถในการปฏิบัติงานอย่างพิถีพิถัน ตรวจสอบความถูกต้องครบถ้วนของข้อมูล เอกสาร และขั้นตอนงานก่อนส่งมอบ เพื่อลดข้อผิดพลาด และรักษามาตรฐานคุณภาพของงาน',
  },
  {
    key: 'c14',
    title: 'การทำงานเชิงรุก',
    desc: 'ความสามารถในการมองเห็นปัญหา โอกาส และความเสี่ยงล่วงหน้า และลงมือดำเนินการก่อนที่จะเกิดผลกระทบ',
  },
]

export const PART1_MAX_RAW = COMPETENCY_LIST.length * 20
export const PART1_WEIGHTS = { Staff: 0.20, Supervisor: 0.50, Stakeholder: 0.30, HR: 0.50 }

function commentRequired(score) {
  return score < 10 || score > 18
}

function scoreColor(s) {
  if (s <= 5)  return { track: '#ef4444', text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    badge: 'text-red-700'    }
  if (s <= 9)  return { track: '#fb923c', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'text-orange-700' }
  if (s <= 14) return { track: '#facc15', text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'text-yellow-700' }
  if (s <= 18) return { track: '#22c55e', text: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  badge: 'text-green-700'  }
  return       { track: '#6366f1', text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'text-indigo-700' }
}

function bandLabel(s) {
  if (s <= 5)  return 'ต้องปรับปรุง'
  if (s <= 9)  return 'ต่ำกว่ามาตรฐาน'
  if (s <= 14) return 'พอใช้'
  if (s <= 18) return 'ดี'
  return 'ดีเยี่ยม'
}

function CompetencyRow({ num, item, score, comment, onChange, onCommentChange, disabled }) {
  const [open, setOpen] = useState(false)
  const c = scoreColor(score)
  const pct = (score / 20) * 100
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
              <span className="opacity-60">/ 20</span>
              <span className="opacity-70">· {bandLabel(score)}</span>
            </div>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 mt-1 transition-colors"
          >
            {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {open ? 'ซ่อนคำอธิบาย' : 'ดูคำอธิบาย'}
          </button>
          {open && (
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</p>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="mt-3 px-1">
        <div className="flex h-1 rounded-full overflow-hidden mb-2 gap-px">
          <div className="flex-[30] bg-red-300 rounded-l-full" />
          <div className="flex-[20] bg-orange-300" />
          <div className="flex-[25] bg-yellow-300" />
          <div className="flex-[20] bg-green-400" />
          <div className="flex-[5]  bg-indigo-400 rounded-r-full" />
        </div>
        <input
          type="range" min={0} max={20} step={1} value={score} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
          style={{ background: `linear-gradient(to right, ${c.track} ${pct}%, #e5e7eb ${pct}%)` }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-1 px-0.5">
          <span>0</span><span className="text-red-400">5</span><span className="text-orange-400">9</span>
          <span className="text-yellow-500">14</span><span className="text-green-500">18</span><span className="text-indigo-500">20</span>
        </div>
      </div>

      {/* Comment */}
      <div className="mt-3">
        {needsComment && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle size={12} className="text-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-amber-600">
              {score < 10
                ? 'กรุณาระบุเหตุผลและยกตัวอย่างประกอบ (คะแนนต่ำกว่า 10)'
                : 'กรุณาระบุเหตุผลและยกตัวอย่างที่ชัดเจน (คะแนนสูงกว่า 18)'}
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
              ? score < 10
                ? 'ระบุเหตุผลที่ให้คะแนนต่ำกว่า 10 พร้อมยกตัวอย่างประกอบ...'
                : 'ระบุเหตุผลที่ให้คะแนนสูงกว่า 18 พร้อมยกตัวอย่างที่เห็นภาพ...'
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

const BLANK = () => Object.fromEntries(COMPETENCY_LIST.map((c) => [c.key, { score: 10, comment: '' }]))

function buildInitial(existing) {
  if (!existing?.scores) return BLANK()
  return Object.fromEntries(
    COMPETENCY_LIST.map((c) => [
      c.key,
      { score: existing.scores[c.key]?.score ?? 10, comment: existing.scores[c.key]?.comment ?? '' },
    ])
  )
}

export default function Part1Competency({ staffId, quarter, year, evaluatorRole }) {
  const { currentUser, saveEvaluation, getEvaluation, getUserById, data } = useApp()

  const existing = getEvaluation(year, quarter, staffId, currentUser.id, 'part1')
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

  const rawTotal = COMPETENCY_LIST.reduce((s, c) => s + scores[c.key].score, 0)
  const maxRaw = PART1_MAX_RAW

  const validate = () => {
    const missing = COMPETENCY_LIST.filter(
      (c) => commentRequired(scores[c.key].score) && !scores[c.key].comment.trim()
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

  // Preview weighted score (needs all 3 evaluators)
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
    // สูตรปกติ: Staff 20% + Supervisor 50% + Stakeholder 30%; ถ้ามี HR ใช้แทน Supervisor เมื่อไม่มี Sup
    const effectiveSup = saved_sup ? supRaw : (saved_hr ? hrRaw : 0)
    const weighted = sRaw * 0.20 + effectiveSup * 0.50 + stRaw * 0.30
    return Math.round((weighted / maxRaw) * 30 * 100) / 100
  })()

  const myEstimate = Math.round((rawTotal / maxRaw) * 30 * 100) / 100

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
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
            <Save size={14} /> บันทึก
          </button>
        </div>
      </div>

      {/* Weight info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-indigo-50 border-indigo-200">
        <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700">
          <p className="font-semibold mb-1">สูตรคำนวณคะแนน Part 1 (รวม 30 คะแนน)</p>
          <p>[ Staff×20% + Supervisor×50% + Stakeholder×30% ] / {maxRaw} × 30</p>
          <p className="mt-1 text-indigo-500">แต่ละหัวข้อมีคะแนนเต็ม 20 คะแนน รวม 14 หัวข้อ = {maxRaw} คะแนน</p>
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

      {/* Weighted preview box (when all 3 evaluators have submitted) */}
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
        {COMPETENCY_LIST.map((item, idx) => (
          <CompetencyRow
            key={item.key}
            num={idx + 1}
            item={item}
            score={scores[item.key].score}
            comment={scores[item.key].comment}
            onChange={(v) => updateScore(item.key, v)}
            onCommentChange={(v) => updateComment(item.key, v)}
            disabled={false}
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
          {COMPETENCY_LIST.map((item) => {
            const s = scores[item.key].score
            const pct = (s / 20) * 100
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
          <span>ข้อ 1</span><span>ข้อ 14</span>
        </div>
      </div>
    </div>
  )
}
