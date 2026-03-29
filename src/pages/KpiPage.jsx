import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import useRBAC, { ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../hooks/useRBAC'
import { subscribeAllUsers } from '../services/authService'
import {
  Target, PlusCircle, CheckCircle2, XCircle, Clock, Pencil, Trash2,
  AlertCircle, Check, X, ChevronDown, ChevronUp, Filter, Eye, Save,
  Info, Star, Users, UserCircle2
} from 'lucide-react'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const KPI_MAX_PER_QUARTER = 3
const KPI_TOTAL_SCORE = 30

// Points per item = KPI_TOTAL_SCORE ÷ number of KPIs assigned (dynamic)
const kpiMaxPerItem = (count) => (count > 0 ? KPI_TOTAL_SCORE / count : KPI_TOTAL_SCORE)

const STATUS_STYLES = {
  Pending:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  ring: 'ring-yellow-200',  icon: <Clock size={12} />, label: 'รอยืนยัน' },
  Accepted: { bg: 'bg-green-50',   text: 'text-green-700',   ring: 'ring-green-200',   icon: <CheckCircle2 size={12} />, label: 'ยอมรับแล้ว' },
  Rejected: { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     icon: <XCircle size={12} />, label: 'ปฏิเสธ' },
}

const BLANK_FORM = {
  staffId: '', title: '', assessmentMethod: '', remark: '', quarter: 'Q1',
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
  const id = u.id || u.uid
  const name = u.name || getUserDisplayName(u)
  const role = u.role || getUserPrimaryRole(u)
  return { ...u, id, name, role }
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.icon}{s.label || status}
    </span>
  )
}

function Avatar({ user }) {
  if (!user) return null
  return (
    <div className={`w-7 h-7 rounded-full ${ROLE_AVATAR_BG[user.role] || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {user.name.charAt(0)}
    </div>
  )
}

// ─── Score slider 0–10 ───────────────────────────────────────────────────────

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
        <span className={`text-xl font-extrabold w-14 text-right ${textColor}`}>{value}<span className="text-xs text-gray-400 font-medium ml-0.5">/{maxScore}</span></span>
      </div>
    </div>
  )
}

// ─── Supervisor View ─────────────────────────────────────────────────────────

function SupervisorView({ allUsers }) {
  const { data, selectedYear, currentUser, addKpi, updateKpi, removeKpi, saveEvaluation, getEvaluation } = useApp()
  const [form, setForm] = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterQuarter, setFilterQuarter] = useState('Q1')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [scoringKpiId, setScoringKpiId] = useState(null)
  const [supScores, setSupScores] = useState({})
  const [assignOpen, setAssignOpen] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)

  const getUserById = (id) => allUsers.find((u) => u.id === id)

  const myConfigs = data.staffConfigs.filter(
    (c) => c.supervisorId === currentUser.id && c.year === selectedYear
  )
  const myStaff = myConfigs.map((c) => getUserById(c.staffId)).filter(Boolean)

  const myKpis = data.kpis.filter(
    (k) => k.year === selectedYear && k.supervisorId === currentUser.id
  )

  const countInQuarter = (staffId, quarter, excludeId = null) =>
    data.kpis.filter(
      (k) => k.year === selectedYear && k.staffId === staffId && k.quarter === quarter && k.id !== excludeId
    ).length

  const existingCount = form.staffId ? countInQuarter(form.staffId, form.quarter, editingId) : 0
  const remainingSlots = Math.max(0, KPI_MAX_PER_QUARTER - existingCount)
  const canSend = !editingId && remainingSlots > 0 && drafts.length === remainingSlots
  const canAddDraft = !editingId && remainingSlots > 0 && drafts.length < remainingSlots

  const validateEdit = () => {
    const e = {}
    if (!form.staffId) e.staffId = 'เลือกพนักงาน'
    if (!form.title.trim()) e.title = 'ระบุงานที่มอบหมาย'
    if (!form.assessmentMethod.trim()) e.assessmentMethod = 'ระบุวิธีการประเมิน'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateDraft = () => {
    const e = {}
    if (!form.staffId) e.staffId = 'เลือกพนักงาน'
    if (!form.title.trim()) e.title = 'ระบุงานที่มอบหมาย'
    if (!form.assessmentMethod.trim()) e.assessmentMethod = 'ระบุวิธีการประเมิน'
    if (!editingId && remainingSlots <= 0) e.quota = `มี KPI ครบ ${KPI_MAX_PER_QUARTER} ข้อแล้วใน ${form.quarter}`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const saveEdit = () => {
    if (!validateEdit()) return
    const payload = {
      staffId: form.staffId,
      title: form.title.trim(),
      assessmentMethod: form.assessmentMethod.trim(),
      remark: form.remark.trim(),
      quarter: form.quarter,
    }
    updateKpi(editingId, { ...payload, status: 'Pending', rejectReason: '' })
    closeAssign()
  }

  const addDraft = () => {
    if (sendingRef.current) return
    if (!canAddDraft) return
    if (!validateDraft()) return
    const draft = {
      id: `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      staffId: form.staffId,
      quarter: form.quarter,
      title: form.title.trim(),
      assessmentMethod: form.assessmentMethod.trim(),
      remark: form.remark.trim(),
    }
    setDrafts((prev) => [...prev, draft])
    setForm((prev) => ({ ...prev, title: '', assessmentMethod: '', remark: '' }))
    setErrors({})
  }

  const removeDraft = (id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const sendDrafts = () => {
    if (sendingRef.current) return
    if (!canSend) return
    sendingRef.current = true
    setSending(true)
    drafts.forEach((d) => {
      addKpi({
        year: selectedYear,
        supervisorId: currentUser.id,
        staffId: d.staffId,
        title: d.title,
        assessmentMethod: d.assessmentMethod,
        remark: d.remark,
        quarter: d.quarter,
      })
    })
    closeAssign()
    sendingRef.current = false
    setSending(false)
  }

  const handleEdit = (kpi) => {
    setForm({ staffId: kpi.staffId, title: kpi.title, assessmentMethod: kpi.assessmentMethod || '', remark: kpi.remark || '', quarter: kpi.quarter })
    setEditingId(kpi.id)
    setErrors({})
    setDrafts([])
    setAssignOpen(true)
  }

  const openAssign = (staffId) => {
    setForm({ ...BLANK_FORM, staffId, quarter: filterQuarter })
    setEditingId(null)
    setErrors({})
    setDrafts([])
    setAssignOpen(true)
  }

  const closeAssign = () => {
    setForm(BLANK_FORM)
    setEditingId(null)
    setErrors({})
    setDrafts([])
    setAssignOpen(false)
    sendingRef.current = false
    setSending(false)
  }

  // Scoring: Supervisor scores accepted KPIs at end of quarter
  const openScoring = (staffId, quarter) => {
    const accepted = myKpis.filter(k => k.staffId === staffId && k.quarter === quarter && k.status === 'Accepted')
    const init = {}
    accepted.forEach(k => {
      const existing = getEvaluation(selectedYear, quarter, staffId, currentUser.id, 'part3_sup')
      const saved = existing?.kpiScores?.[k.id] ?? 0
      init[k.id] = saved
    })
    setSupScores(init)
    setScoringKpiId(`${staffId}__${quarter}`)
  }

  const saveSupScoring = (staffId, quarter) => {
    const accepted = myKpis.filter(k => k.staffId === staffId && k.quarter === quarter && k.status === 'Accepted')
    const total = accepted.reduce((s, k) => s + (supScores[k.id] ?? 0), 0)
    saveEvaluation({
      year: selectedYear, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole: 'Supervisor',
      part: 'part3_sup',
      kpiScores: supScores,
      rawTotal: total,
      scaledScore: total,
    })
    setScoringKpiId(null)
  }

  const filteredByQuarter = myKpis.filter(k => k.quarter === filterQuarter && (filterStaff === 'all' || k.staffId === filterStaff))
  const assignedInModal = myKpis
    .filter((k) => k.staffId === form.staffId && k.quarter === form.quarter)
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))

  if (myStaff.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
        <Target size={36} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-400">ยังไม่มีพนักงานที่ดูแล สำหรับปี {selectedYear}</p>
        <p className="text-xs text-gray-400 mt-1">ให้ HR ตั้งค่าลำดับชั้นใน Admin → Hierarchy</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>Part 3 — KPI (30 คะแนน):</strong> กำหนด KPI สูงสุด {KPI_MAX_PER_QUARTER} ข้อ/คน/Quarter
          · คะแนนต่อข้อ: <strong>1 ข้อ = 30 คะแนน · 2 ข้อ = 15 คะแนน · 3 ข้อ = 10 คะแนน</strong>
          · Staff 40% + Supervisor 60% · สูตร: Staff_total×0.40 + Sup_total×0.60
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter size={13} /><span className="font-medium">กรอง:</span></div>
        <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">พนักงานทั้งหมด</option>
          {myStaff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {QUARTERS.map((q) => (
            <button key={q} onClick={() => setFilterQuarter(q)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${filterQuarter === q ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}`}>
              {q}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">รายการ KPI แสดงในหน้าต่าง “มอบหมาย KPI”</span>
      </div>

      {/* KPI list grouped by staff */}
      {myStaff.filter(s => filterStaff === 'all' || s.id === filterStaff).map((staff) => {
        const staffKpis = filteredByQuarter.filter(k => k.staffId === staff.id)
        const accepted = staffKpis.filter(k => k.status === 'Accepted')
        const pending = staffKpis.filter(k => k.status === 'Pending')
        const rejected = staffKpis.filter(k => k.status === 'Rejected')
        const kpiCount = staffKpis.length
        const maxPerItem = kpiMaxPerItem(kpiCount)
        const supEval = getEvaluation(selectedYear, filterQuarter, staff.id, currentUser.id, 'part3_sup')
        const isScoringOpen = scoringKpiId === `${staff.id}__${filterQuarter}`

        return (
          <div key={staff.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Avatar user={staff} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{staff.name}</p>
                  <p className="text-xs text-gray-400">
                    {staffKpis.length}/{KPI_MAX_PER_QUARTER} KPI · {accepted.length} ยอมรับ · {pending.length} รอยืนยัน · {rejected.length} ปฏิเสธ · {maxPerItem} คะแนน/ข้อ
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAssign(staff.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <PlusCircle size={12} /> มอบหมาย KPI
                </button>
                {accepted.length > 0 && (
                  <button onClick={() => isScoringOpen ? setScoringKpiId(null) : openScoring(staff.id, filterQuarter)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isScoringOpen ? 'bg-indigo-100 text-indigo-700' : supEval ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                    <Star size={12} />
                    {supEval ? `ให้คะแนนแล้ว (${supEval.rawTotal}/${accepted.length * maxPerItem})` : 'ให้คะแนน Supervisor'}
                    {isScoringOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>
            </div>

            {/* Supervisor scoring panel */}
            {isScoringOpen && accepted.length > 0 && (
              <div className="px-5 pb-5 pt-3 border-t border-indigo-100 bg-indigo-50 space-y-4">
                <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5"><Star size={12} /> ให้คะแนน KPI — {staff.name} · {filterQuarter} (Supervisor 60%) · ข้อละ {maxPerItem} คะแนน</p>
                {accepted.map((kpi) => (
                  <div key={kpi.id} className="bg-white rounded-lg border border-indigo-100 p-3">
                    <p className="text-xs font-semibold text-gray-800 mb-2">{kpi.title}</p>
                    <ScoreSlider
                      value={supScores[kpi.id] ?? 0}
                      onChange={(v) => setSupScores((p) => ({ ...p, [kpi.id]: v }))}
                      disabled={false}
                      maxScore={maxPerItem}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-indigo-600 font-semibold">
                    รวม Supervisor: {accepted.reduce((s, k) => s + (supScores[k.id] ?? 0), 0)} / {accepted.length * maxPerItem}
                  </p>
                  <button onClick={() => saveSupScoring(staff.id, filterQuarter)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">
                    <Save size={12} /> บันทึกคะแนน Supervisor
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {assignOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{editingId ? 'แก้ไข KPI' : 'มอบหมาย KPI ใหม่'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">ปี: <strong className="text-indigo-600">{selectedYear}</strong> · สูงสุด {KPI_MAX_PER_QUARTER} ข้อ/คน/Quarter</p>
              </div>
              <button onClick={closeAssign} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
                <X size={13} /> ปิด
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">พนักงาน *</label>
                <div className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-700">
                  {getUserById(form.staffId)?.name || '—'}
                </div>
                {errors.staffId && <p className="text-xs text-red-500 mt-1">{errors.staffId}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quarter *</label>
                <div className="flex gap-2">
                  {QUARTERS.map((q) => {
                    const cnt = form.staffId ? countInQuarter(form.staffId, q, editingId) : 0
                    const full = cnt >= KPI_MAX_PER_QUARTER
                    const canPick = form.staffId && !full
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          if (!canPick && form.quarter !== q) return
                          if (!editingId && drafts.length > 0) setDrafts([])
                          setForm({ ...form, quarter: q })
                          setErrors({})
                        }}
                        className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                          form.quarter === q
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : full
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {q}
                        {form.staffId && <span className={`block text-[10px] font-normal ${form.quarter === q ? 'opacity-70' : full ? 'text-red-400' : 'text-gray-400'}`}>{cnt}/{KPI_MAX_PER_QUARTER}</span>}
                      </button>
                    )
                  })}
                </div>
                {errors.quota && <p className="text-xs text-red-500 mt-1">{errors.quota}</p>}
              </div>

              {!editingId && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">
                      รายการที่เตรียมส่ง: {drafts.length}/{remainingSlots}
                    </p>
                    {drafts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDrafts([])}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
                      >
                        ล้างรายการ
                      </button>
                    )}
                  </div>
                  {remainingSlots === 0 ? (
                    <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500">
                      ครบ {KPI_MAX_PER_QUARTER} ข้อแล้วใน {form.quarter}
                    </div>
                  ) : drafts.length === 0 ? (
                    <div className="px-3 py-2 rounded-lg border border-dashed border-gray-200 bg-white text-xs text-gray-400">
                      กรอกข้อมูล KPI แล้วกด “มอบหมาย (เพิ่มข้อ)” ให้ครบ {remainingSlots} ข้อ เพื่อแสดงปุ่ม “ส่ง KPI”
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {drafts.map((d, idx) => (
                        <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                          <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-900 truncate">{d.title}</p>
                            <p className="text-[11px] text-gray-500 truncate">{d.assessmentMethod}</p>
                            {d.remark && <p className="text-[11px] text-gray-400 truncate">{d.remark}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDraft(d.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">งานที่มอบหมาย *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="เช่น เพิ่มยอดขายในตลาด X ให้ได้ 10%"
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.title ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">วิธีการประเมิน *</label>
                <input
                  type="text"
                  value={form.assessmentMethod}
                  onChange={(e) => setForm({ ...form, assessmentMethod: e.target.value })}
                  placeholder="เช่น ดูจากรายงานยอดขายรายเดือน"
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.assessmentMethod ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.assessmentMethod && <p className="text-xs text-red-500 mt-1">{errors.assessmentMethod}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">หมายเหตุ <span className="text-gray-400 font-normal">(ถ้ามี)</span></label>
                <input
                  type="text"
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  placeholder="ข้อมูลเพิ่มเติมหรือเงื่อนไขพิเศษ"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {!editingId && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700">KPI ที่มอบหมายแล้ว ({form.quarter})</p>
                  <p className="text-xs text-gray-400">{assignedInModal.length} รายการ</p>
                </div>
                {assignedInModal.length === 0 ? (
                  <div className="px-3 py-3 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 text-center">
                    ยังไม่มี KPI ใน {form.quarter}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {assignedInModal.map((kpi, idx) => {
                      const canEdit = kpi.status === 'Pending' || kpi.status === 'Rejected'
                      return (
                        <div key={kpi.id} className="px-4 py-3 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${kpi.status === 'Accepted' ? 'bg-green-100 text-green-700' : kpi.status === 'Rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                {idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-semibold text-gray-900">{kpi.title}</p>
                                  <StatusBadge status={kpi.status} />
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">วิธีประเมิน: <span className="text-gray-700">{kpi.assessmentMethod}</span></p>
                                {kpi.remark && <p className="text-[11px] text-gray-400 mt-0.5">หมายเหตุ: {kpi.remark}</p>}
                                {kpi.status === 'Rejected' && kpi.rejectReason && (
                                  <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                                    <XCircle size={12} className="mt-0.5 shrink-0" />
                                    <span><strong>เหตุผลที่ปฏิเสธ:</strong> {kpi.rejectReason}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {canEdit && (
                                <button onClick={() => handleEdit(kpi)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={14} /></button>
                              )}
                              <button onClick={() => setConfirmDelete(kpi.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={closeAssign} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ยกเลิก
              </button>
              {editingId ? (
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Check size={14} /> บันทึกการแก้ไข
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={addDraft}
                    disabled={!canAddDraft || sending}
                    className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      canAddDraft && !sending
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <PlusCircle size={14} /> มอบหมาย (เพิ่มข้อ)
                  </button>
                  {canSend && (
                    <button
                      type="button"
                      onClick={sendDrafts}
                      disabled={sending}
                      className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        sending ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <CheckCircle2 size={14} /> ส่ง KPI
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg"><AlertCircle size={18} className="text-red-600" /></div>
              <h3 className="text-base font-semibold text-gray-900">ลบ KPI</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">ลบ <strong>"{data.kpis.find(k => k.id === confirmDelete)?.title}"</strong>? ไม่สามารถยกเลิกได้</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={() => { removeKpi(confirmDelete); setConfirmDelete(null) }} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Staff View ───────────────────────────────────────────────────────────────

function StaffView({ allUsers }) {
  const { data, selectedYear, activeQuarter, currentUser, respondKpi, saveEvaluation, getEvaluation } = useApp()
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  // Automatically select the quarter that has pending KPIs, otherwise fallback to activeQuarter
  const [filterQuarter, setFilterQuarter] = useState(() => {
    const kpis = data.kpis.filter((k) => k.staffId === currentUser.id && k.year === selectedYear)
    const pendingQ = QUARTERS.find(q => kpis.some(k => k.quarter === q && k.status === 'Pending'))
    return pendingQ || activeQuarter || 'Q1'
  })

  const [staffScores, setStaffScores] = useState({})
  const [scoringSaved, setScoringSaved] = useState({})

  const myKpis = data.kpis.filter((k) => k.staffId === currentUser.id && k.year === selectedYear)
  const quarterKpis = myKpis.filter((k) => k.quarter === filterQuarter)
  const accepted = quarterKpis.filter((k) => k.status === 'Accepted')
  const pending = quarterKpis.filter((k) => k.status === 'Pending')
  const rejected = quarterKpis.filter((k) => k.status === 'Rejected')
  const maxPerItem = kpiMaxPerItem(quarterKpis.length)

  const getUserById = (id) => allUsers.find((u) => u.id === id)

  const handleAccept = (id) => respondKpi(id, 'Accepted')

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) { setRejectError('กรุณาระบุเหตุผลที่ปฏิเสธ'); return }
    respondKpi(rejectModal, 'Rejected', rejectReason.trim())
    setRejectModal(null); setRejectReason(''); setRejectError('')
  }

  const initScores = (quarter) => {
    const kpis = myKpis.filter(k => k.quarter === quarter && k.status === 'Accepted')
    const existing = getEvaluation(selectedYear, quarter, currentUser.id, currentUser.id, 'part3_staff')
    const init = {}
    kpis.forEach(k => { init[k.id] = existing?.kpiScores?.[k.id] ?? 0 })
    setStaffScores(init)
    setScoringSaved(prev => ({ ...prev, [quarter]: !!existing }))
  }

  const handleQuarterChange = (q) => { setFilterQuarter(q); initScores(q) }

  const saveStaffScoring = () => {
    const total = accepted.reduce((s, k) => s + (staffScores[k.id] ?? 0), 0)
    saveEvaluation({
      year: selectedYear, quarter: filterQuarter, staffId: currentUser.id,
      evaluatorId: currentUser.id,
      evaluatorRole: 'Staff',
      part: 'part3_staff',
      kpiScores: staffScores,
      rawTotal: total,
      scaledScore: total,
    })
    setScoringSaved(prev => ({ ...prev, [filterQuarter]: true }))
  }

  const staffEval = getEvaluation(selectedYear, filterQuarter, currentUser.id, currentUser.id, 'part3_staff')
  const isSavedThisQ = scoringSaved[filterQuarter] || !!staffEval

  if (myKpis.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
        <Target size={36} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-400">ยังไม่มี KPI ที่มอบหมายให้คุณในปี {selectedYear}</p>
        <p className="text-xs text-gray-400 mt-1">Supervisor จะมอบหมาย KPI ให้คุณตรวจสอบ</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>Part 3 — KPI (30 คะแนน):</strong> ตรวจสอบและยอมรับ KPI ที่ได้รับมอบหมาย จากนั้นประเมินผลงานตนเองในปลาย Quarter (Staff 40%)
        </div>
      </div>

      {/* Quarter tabs */}
      <div className="flex gap-2">
        {QUARTERS.map((q) => {
          const qKpis = myKpis.filter(k => k.quarter === q)
          const qPending = qKpis.filter(k => k.status === 'Pending').length
          return (
            <button key={q} onClick={() => handleQuarterChange(q)}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all relative ${filterQuarter === q ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}`}>
              {q}
              {qPending > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{qPending}</span>}
            </button>
          )
        })}
      </div>

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-yellow-800 flex items-center gap-1.5"><AlertCircle size={13} /> รอการตรวจสอบ ({pending.length} รายการ)</p>
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
                    <p className="text-xs text-gray-500 pl-7">วิธีประเมิน: {kpi.assessmentMethod}</p>
                    {kpi.remark && <p className="text-xs text-gray-400 pl-7 mt-0.5">หมายเหตุ: {kpi.remark}</p>}
                    <div className="flex items-center gap-1.5 pl-7 mt-1.5">
                      <Avatar user={sup} />
                      <span className="text-xs text-gray-500">มอบหมายโดย <strong>{sup?.name}</strong></span>
                    </div>
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

      {/* Rejected items */}
      {rejected.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-red-700">KPI ที่ปฏิเสธ ({rejected.length} รายการ) — รอ Supervisor แก้ไขและมอบหมายใหม่</p>
          {rejected.map(kpi => (
            <div key={kpi.id} className="bg-white rounded-lg border border-red-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-800">{kpi.title}</p>
              {kpi.rejectReason && <p className="text-xs text-red-500 mt-0.5">เหตุผล: {kpi.rejectReason}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Accepted — self-scoring */}
      {accepted.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-green-50 border-b border-green-100">
            <p className="text-xs font-semibold text-green-800">KPI ที่ยอมรับ ({accepted.length} รายการ) — ประเมินตนเอง (Staff 40%) · ข้อละ {maxPerItem} คะแนน</p>
            {isSavedThisQ && (
              <span className="text-xs text-green-700 font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> บันทึกแล้ว</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {accepted.map((kpi, idx) => (
              <div key={kpi.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{kpi.title}</p>
                    <p className="text-xs text-gray-400">วิธีประเมิน: {kpi.assessmentMethod}</p>
                  </div>
                </div>
                <ScoreSlider
                  value={staffScores[kpi.id] ?? (staffEval?.kpiScores?.[kpi.id] ?? 0)}
                  onChange={(v) => { setStaffScores(p => ({ ...p, [kpi.id]: v })); setScoringSaved(p => ({ ...p, [filterQuarter]: false })) }}
                  disabled={false}
                  label="คะแนนประเมินตนเอง"
                  maxScore={maxPerItem}
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                รวม Staff: <strong className="text-indigo-600">{accepted.reduce((s, k) => s + (staffScores[k.id] ?? staffEval?.kpiScores?.[k.id] ?? 0), 0)}</strong> / {accepted.length * maxPerItem}
              </div>
              <button onClick={saveStaffScoring}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                <Save size={12} /> บันทึกคะแนน Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {quarterKpis.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-10 text-center">
          <Target size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">ไม่มี KPI ใน {filterQuarter}</p>
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
            <p className="text-xs text-gray-500 mb-4 pl-11"><strong>"{data.kpis.find(k => k.id === rejectModal)?.title}"</strong></p>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">เหตุผลที่ปฏิเสธ <span className="text-red-500">*</span></label>
            <textarea value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setRejectError('') }} rows={3}
              placeholder="ระบุเหตุผลและรายละเอียดที่ต้องการให้ Supervisor ปรับปรุง..."
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 ${rejectError ? 'border-red-400' : 'border-gray-300'}`} />
            {rejectError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{rejectError}</p>}
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

// ─── Read-only Overview (HR / MD) ─────────────────────────────────────────────

function OverviewView({ allUsers }) {
  const { data, selectedYear, getEvaluation } = useApp()
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterQuarter, setFilterQuarter] = useState('Q1')

  const yearKpis = data.kpis.filter((k) => k.year === selectedYear)
  const staffWithKpis = [...new Set(yearKpis.map((k) => k.staffId))]
    .map((id) => allUsers.find((u) => u.id === id)).filter(Boolean)
  const getUserById = (id) => allUsers.find((u) => u.id === id)

  const filteredStaff = filterStaff === 'all' ? staffWithKpis : staffWithKpis.filter(s => s.id === filterStaff)

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter size={13} /><span className="font-medium">กรอง:</span></div>
        <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">พนักงานทั้งหมด</option>
          {staffWithKpis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {QUARTERS.map((q) => (
            <button key={q} onClick={() => setFilterQuarter(q)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${filterQuarter === q ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}`}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Staff cards */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <Eye size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">ไม่พบข้อมูล KPI สำหรับปี {selectedYear}</p>
        </div>
      ) : filteredStaff.map((staff) => {
        const staffKpis = yearKpis.filter(k => k.staffId === staff.id && k.quarter === filterQuarter)
        const accepted = staffKpis.filter(k => k.status === 'Accepted')
        const supId = data.staffConfigs.find(c => c.staffId === staff.id && c.year === selectedYear)?.supervisorId
        const supEval = supId ? getEvaluation(selectedYear, filterQuarter, staff.id, supId, 'part3_sup') : null
        const staffEval = getEvaluation(selectedYear, filterQuarter, staff.id, staff.id, 'part3_staff')

        const staffTotal = staffEval?.rawTotal ?? null
        const supTotal = supEval?.rawTotal ?? null
        const kpiCount = staffKpis.length
        const maxPerItem = kpiMaxPerItem(kpiCount)
        const maxPossible = kpiCount * maxPerItem

        let weightedScore = null
        if (staffTotal !== null && supTotal !== null) {
          weightedScore = Math.round((staffTotal * 0.40 + supTotal * 0.60) * 100) / 100
        } else if (staffTotal !== null) {
          weightedScore = Math.round(staffTotal * 0.40 * 100) / 100
        } else if (supTotal !== null) {
          weightedScore = Math.round(supTotal * 0.60 * 100) / 100
        }

        return (
          <div key={staff.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Avatar user={staff} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{staff.name}</p>
                  <p className="text-xs text-gray-400">
                    {staffKpis.length} KPI · {accepted.length} ยอมรับ
                    {supId && <span> · Sup: {getUserById(supId)?.name}</span>}
                  </p>
                </div>
              </div>
              {weightedScore !== null && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">คะแนน Part 3</p>
                  <p className={`text-xl font-extrabold ${weightedScore >= 24 ? 'text-green-600' : weightedScore >= 18 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {weightedScore} <span className="text-xs text-gray-400 font-medium">/ 30</span>
                  </p>
                </div>
              )}
            </div>

            {staffKpis.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-gray-400">ไม่มี KPI ใน {filterQuarter}</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {staffKpis.map((kpi, idx) => {
                  const sScore = staffEval?.kpiScores?.[kpi.id] ?? null
                  const supScore = supEval?.kpiScores?.[kpi.id] ?? null
                  return (
                    <div key={kpi.id} className="px-5 py-3 flex items-center gap-4">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{kpi.title}</p>
                        <p className="text-[10px] text-gray-400 truncate">{kpi.assessmentMethod}</p>
                      </div>
                      <StatusBadge status={kpi.status} />
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-blue-600 font-semibold">Staff: {sScore ?? '—'}/{maxPerItem}</span>
                        <span className="text-indigo-600 font-semibold">Sup: {supScore ?? '—'}/{maxPerItem}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Score summary */}
            {(staffTotal !== null || supTotal !== null) && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-6 text-xs">
                <span className="text-gray-500">Staff: <strong className="text-blue-600">{staffTotal ?? '—'}/{maxPossible}</strong> ×0.40</span>
                <span className="text-gray-500">Sup: <strong className="text-indigo-600">{supTotal ?? '—'}/{maxPossible}</strong> ×0.60</span>
                <span className="text-gray-500">คะแนนรวม Part 3: <strong className={weightedScore !== null ? (weightedScore >= 24 ? 'text-green-600' : 'text-yellow-600') : 'text-gray-400'}>{weightedScore ?? '—'} / 30</strong></span>
                <span className="text-[10px] text-gray-400">({staffTotal ?? '?'}×0.40 + {supTotal ?? '?'}×0.60)</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main KPI Page ─────────────────────────────────────────────────────────────

export default function KpiPage() {
  const { data, currentUser, selectedYear } = useApp()
  const { role } = useRBAC()
  const [firebaseUsers, setFirebaseUsers] = useState([])
  const [activeViewId, setActiveViewId] = useState('')

  useEffect(() => subscribeAllUsers((list) => setFirebaseUsers(list.map(normalizeAnyUser).filter(Boolean))), [])
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [selectedYear])

  const allUsers = (firebaseUsers.length > 0 ? firebaseUsers : (data.users ?? [])).map(normalizeAnyUser).filter(Boolean)

  // Determine view by staffConfig assignments, not role
  const isSupervisor = data.staffConfigs.some(
    (c) => c.supervisorId === currentUser.id && c.year === selectedYear
  )
  const isAssignedAsStaff = data.staffConfigs.some(
    (c) => c.staffId === currentUser.id && c.year === selectedYear
  )
  const isExecOrHR = ['HR', 'HRM', 'GM', 'MD'].includes(role)

  const availableViews = []
  if (isAssignedAsStaff) availableViews.push({ id: 'staff', label: 'การประเมินตนเอง (Staff)', icon: UserCircle2 })
  if (isSupervisor) availableViews.push({ id: 'sup', label: 'การประเมินทีม (Supervisor)', icon: Users })
  if (isExecOrHR) availableViews.push({ id: 'hr', label: 'ภาพรวมพนักงาน (HR/MD)', icon: Eye })

  const actualViewId = availableViews.some((v) => v.id === activeViewId)
    ? activeViewId
    : availableViews[0]?.id

  let view
  if (actualViewId === 'staff') {
    view = <StaffView allUsers={allUsers} />
  } else if (actualViewId === 'sup') {
    view = <SupervisorView allUsers={allUsers} />
  } else if (actualViewId === 'hr') {
    view = <OverviewView allUsers={allUsers} />
  } else {
    view = (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-gray-50 p-4 rounded-2xl mb-4"><Eye size={32} className="text-gray-300" /></div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">ไม่มีข้อมูล KPI</h2>
        <p className="text-sm text-gray-500 max-w-xs">คุณยังไม่ได้รับการ Assign ใน Hierarchy ของปี {selectedYear} กรุณาติดต่อ HR</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-xl"><Target size={22} className="text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">KPI Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">Part 3 — KPI Evaluation (30 คะแนน · Staff 40% / Supervisor 60%)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${ROLE_BADGE_CLASSES[role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
            {currentUser.name} · {role}
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
            <span className="text-sm font-semibold text-blue-700">{selectedYear}</span>
          </div>
        </div>
      </div>

      {availableViews.length > 1 && (
        <div className="flex bg-white border border-gray-200 p-1 rounded-xl w-fit overflow-x-auto hide-scrollbar max-w-full shadow-sm mb-2">
          {availableViews.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveViewId(v.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shrink-0 ${
                actualViewId === v.id
                  ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <v.icon size={16} />
              {v.label}
            </button>
          ))}
        </div>
      )}

      {view}
    </div>
  )
}
