import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import {
  BookOpen, PlusCircle, Pencil, Trash2, GripVertical,
  Save, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronUp, X,
} from 'lucide-react'

// Default competency list (fallback if no config in DB)
export const DEFAULT_COMPETENCIES = [
  { key: 'c01', title: 'ความรู้ความสามารถ', desc: 'ความเข้าใจในงาน สามารถปฏิบัติงานตามหน้าที่ที่ได้รับมอบหมายได้อย่างถูกต้อง มีประสิทธิภาพ' },
  { key: 'c02', title: 'ความคิดสร้างสรรค์', desc: 'ความสามารถในการคิดแนวทางใหม่ๆ ปรับปรุงวิธีการทำงาน หรือพัฒนากระบวนการให้มีประสิทธิภาพมากขึ้น' },
  { key: 'c03', title: 'มีไหวพริบแก้ปัญหาเฉพาะหน้าได้', desc: 'ความสามารถในการวิเคราะห์สถานการณ์ ตัดสินใจและแก้ไขปัญหาที่เกิดขึ้นได้อย่างเหมาะสมและทันท่วงที' },
  { key: 'c04', title: 'การทำงานเป็นทีม', desc: 'ความสามารถในการร่วมมือ ประสานงาน และสนับสนุนเพื่อนร่วมงานเพื่อให้บรรลุเป้าหมายของทีมและองค์กร' },
  { key: 'c05', title: 'การบริการที่ดี', desc: 'ความตั้งใจในการให้บริการ และช่วยเหลือผู้อื่นด้วยความสุภาพ รวดเร็ว และเหมาะสม' },
  { key: 'c06', title: 'การสื่อสารอย่างมีประสิทธิภาพ', desc: 'ความสามารถในการถ่ายทอดข้อมูล ความคิดเห็น และคำสั่งงานได้อย่างชัดเจนถูกต้อง ครบถ้วน' },
  { key: 'c07', title: 'มีความรับผิดชอบ', desc: 'ความตั้งใจในการปฏิบัติงานหน้าที่ที่ได้รับมอบหมายอย่างครบถ้วน ถูกต้อง และภายในระยะเวลาที่กำหนด' },
  { key: 'c08', title: 'การปรับตัว', desc: 'ความสามารถในการรับมือสถานการณ์ใหม่ การเปลี่ยนแปลงแผนงาน นโยบาย หรือสภาพแวดล้อมในการทำงาน' },
  { key: 'c09', title: 'การวางแผนและการจัดการ', desc: 'ความสามารถในการกำหนดเป้าหมาย วางแผนงาน จัดสรรทรัพยากร และบริหารจัดการงานให้เป็นไปตามแผน' },
  { key: 'c10', title: 'การจัดการทรัพยากร (โครงการ)', desc: 'ความสามารถในการวางแผน จัดสรร ควบคุม และใช้ทรัพยากรของโครงการให้เกิดประโยชน์สูงสุด' },
  { key: 'c11', title: 'การบริหารเวลา', desc: 'ความสามารถในการวางแผน จัดลำดับความสำคัญ และใช้เวลาในการทำงานอย่างมีประสิทธิภาพ เพื่อให้งานสำเร็จตามกำหนด' },
  { key: 'c12', title: 'ทักษะการเจรจาต่อรอง', desc: 'ความสามารถในการสื่อสาร เจรจา และหาข้อตกลงร่วมกันกับผู้ที่เกี่ยวข้อง ทั้งภายในและภายนอกองค์กร' },
  { key: 'c13', title: 'ความละเอียดรอบคอบ', desc: 'ความสามารถในการปฏิบัติงานอย่างพิถีพิถัน ตรวจสอบความถูกต้องครบถ้วนของข้อมูล เอกสาร และขั้นตอนงาน' },
  { key: 'c14', title: 'การทำงานเชิงรุก', desc: 'ความสามารถในการมองเห็นปัญหา โอกาส และความเสี่ยงล่วงหน้า และลงมือดำเนินการก่อนที่จะเกิดผลกระทบ' },
]

const SCALE_MAX = 10

export default function CompetencyTab() {
  const { data, updateData } = useApp()

  // Load from data.competencyConfig or use defaults
  const savedItems = data?.competencyConfig?.items
  const [items, setItems] = useState(() =>
    Array.isArray(savedItems) && savedItems.length > 0
      ? savedItems
      : DEFAULT_COMPETENCIES
  )

  const [editingIdx, setEditingIdx] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', desc: '' })
  const [addMode, setAddMode] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', desc: '' })
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(!!savedItems)
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null)

  // Sync from remote changes
  useEffect(() => {
    if (Array.isArray(data?.competencyConfig?.items) && data.competencyConfig.items.length > 0) {
      setItems(data.competencyConfig.items)
    }
  }, [data?.competencyConfig?.items?.length])

  const maxRaw = items.length * SCALE_MAX
  const weightedMax = 30

  const handleSave = () => {
    if (items.length === 0) {
      setErrors({ global: 'กรุณาเพิ่มอย่างน้อย 1 หัวข้อ Competency' })
      return
    }
    updateData((prev) => ({
      ...prev,
      competencyConfig: {
        items: items.map((item, i) => ({
          key: item.key || `c${String(i + 1).padStart(2, '0')}`,
          title: item.title,
          desc: item.desc,
        })),
        scaleMax: SCALE_MAX,
        updatedAt: new Date().toISOString(),
      },
    }))
    setSaved(true)
    setErrors({})
  }

  const startEdit = (idx) => {
    setEditingIdx(idx)
    setEditForm({ title: items[idx].title, desc: items[idx].desc })
    setAddMode(false)
  }

  const saveEdit = () => {
    if (!editForm.title.trim()) {
      setErrors({ edit: 'กรุณาระบุชื่อหัวข้อ' })
      return
    }
    setItems((prev) => prev.map((item, i) =>
      i === editingIdx ? { ...item, title: editForm.title.trim(), desc: editForm.desc.trim() } : item
    ))
    setEditingIdx(null)
    setErrors({})
    setSaved(false)
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setErrors({})
  }

  const handleAdd = () => {
    if (!addForm.title.trim()) {
      setErrors({ add: 'กรุณาระบุชื่อหัวข้อ' })
      return
    }
    const newKey = `c${String(items.length + 1).padStart(2, '0')}_${Date.now()}`
    setItems((prev) => [...prev, { key: newKey, title: addForm.title.trim(), desc: addForm.desc.trim() }])
    setAddForm({ title: '', desc: '' })
    setAddMode(false)
    setErrors({})
    setSaved(false)
  }

  const handleDelete = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
    setConfirmDeleteIdx(null)
    setSaved(false)
  }

  const moveItem = (idx, direction) => {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= items.length) return
    setItems((prev) => {
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
    setSaved(false)
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>Part 1 — Competency (30 คะแนน):</strong> ตั้งค่าหัวข้อ Competency ที่ใช้ประเมินพนักงานทุกคน
          <br />แต่ละหัวข้อมีคะแนนเต็ม <strong>0–{SCALE_MAX}</strong> · จำนวนหัวข้อไม่จำกัด · คะแนนถ่วงน้ำหนักรวม = <strong>{weightedMax} คะแนน</strong>
          <br />สูตร: (คะแนนดิบรวม / คะแนนเต็ม) × {weightedMax}
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <BookOpen size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">หัวข้อ Competency</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {items.length} หัวข้อ · คะแนนดิบเต็ม {maxRaw} · Scale 0–{SCALE_MAX}/ข้อ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAddMode(true); setEditingIdx(null) }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <PlusCircle size={14} /> เพิ่มหัวข้อ
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Save size={14} /> บันทึกการตั้งค่า
            </button>
          </div>
        </div>

        {/* Status banners */}
        {saved && (
          <div className="mx-5 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
            <p className="text-xs text-green-700 font-medium">
              บันทึกแล้ว — {items.length} หัวข้อ · คะแนนดิบเต็ม {maxRaw} · Scale 0–{SCALE_MAX}/ข้อ
            </p>
          </div>
        )}
        {errors.global && (
          <div className="mx-5 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-medium">{errors.global}</p>
          </div>
        )}

        {/* Add form */}
        {addMode && (
          <div className="mx-5 mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-indigo-700">เพิ่มหัวข้อใหม่</p>
            <input
              type="text"
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ชื่อหัวข้อ เช่น ความรู้ความสามารถ"
              className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <textarea
              rows={2}
              value={addForm.desc}
              onChange={(e) => setAddForm((f) => ({ ...f, desc: e.target.value }))}
              placeholder="คำอธิบาย (ไม่บังคับ)"
              className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white"
            />
            {errors.add && <p className="text-xs text-red-600">{errors.add}</p>}
            <div className="flex gap-2">
              <button onClick={handleAdd} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                เพิ่ม
              </button>
              <button onClick={() => { setAddMode(false); setErrors({}) }} className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 border-t">
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 w-8">#</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">ชื่อหัวข้อ</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">คำอธิบาย</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center w-24">Scale</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right w-36">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    ยังไม่มีหัวข้อ Competency — กดปุ่ม "เพิ่มหัวข้อ" เพื่อเริ่มต้น
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.key || idx} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                    </div>
                  </td>

                  {editingIdx === idx ? (
                    <>
                      <td colSpan={2} className="px-4 py-3">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          <textarea
                            rows={2}
                            value={editForm.desc}
                            onChange={(e) => setEditForm((f) => ({ ...f, desc: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                          />
                          {errors.edit && <p className="text-xs text-red-600">{errors.edit}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">0–{SCALE_MAX}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={saveEdit} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">บันทึก</button>
                          <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">ยกเลิก</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 md:hidden line-clamp-1">{item.desc}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-gray-500 line-clamp-2 max-w-md">{item.desc || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">0–{SCALE_MAX}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(idx)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDeleteIdx(idx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        {items.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>รวม {items.length} หัวข้อ · Scale 0–{SCALE_MAX}/ข้อ · คะแนนดิบเต็ม {maxRaw}</span>
            <span className="text-indigo-600 font-semibold">คะแนนถ่วงน้ำหนัก Part 1 = {weightedMax} คะแนน</span>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteIdx !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg"><AlertCircle size={18} className="text-red-600" /></div>
              <h3 className="text-base font-semibold text-gray-900">ลบหัวข้อ Competency</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              ลบ <strong>"{items[confirmDeleteIdx]?.title}"</strong>? หมายเหตุ: หากมีการประเมินอยู่แล้ว ข้อมูลเก่าของหัวข้อนี้จะยังคงอยู่แต่จะไม่ปรากฏในฟอร์มใหม่
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteIdx(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={() => handleDelete(confirmDeleteIdx)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
