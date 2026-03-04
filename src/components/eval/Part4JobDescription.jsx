import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import ScoreSlider, { COMMENT_REQUIRED } from '../ScoreSlider'
import { ROLE_AVATAR_BG } from '../../hooks/useRBAC'
import { CheckCircle2, AlertCircle, Save, Briefcase, ExternalLink, IdCard } from 'lucide-react'

const EVAL_ROLE_BADGE = {
  Staff:       'bg-blue-100 text-blue-800 ring-blue-200',
  Supervisor:  'bg-purple-100 text-purple-800 ring-purple-200',
  Stakeholder: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  HR:          'bg-green-100 text-green-800 ring-green-200',
  MD:          'bg-red-100 text-red-800 ring-red-200',
}

export default function Part4JobDescription({ staffId, quarter, year, evaluatorRole = 'Staff' }) {
  const { currentUser, saveEvaluation, getEvaluation, getUserById } = useApp()
  const existing = getEvaluation(year, quarter, staffId, currentUser.id, 'part4')

  const [score, setScore] = useState(existing?.score ?? 10)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [saved, setSaved] = useState(!!existing)
  const [error, setError] = useState('')

  const staff = getUserById(staffId)
  const isReadOnly = !!existing && saved
  const needsComment = COMMENT_REQUIRED(score)

  const handleSave = () => {
    if (needsComment && !comment.trim()) {
      setError('A comment is required for this score.')
      return
    }
    setError('')
    saveEvaluation({
      year, quarter, staffId,
      evaluatorId: currentUser.id,
      evaluatorRole,
      part: 'part4',
      score,
      comment,
      scaledScore: score,
    })
    setSaved(true)
  }

  const handleEdit = () => {
    setSaved(false)
    setError('')
  }

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
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Briefcase size={11} className="text-purple-600" />
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ring-1 ${EVAL_ROLE_BADGE[evaluatorRole] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                  {evaluatorRole}
                </span>
                <p className="text-xs text-purple-700 font-medium">— Job Description</p>
              </div>
              {staff?.staffCode && (
                <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                  <IdCard size={11} />{staff.staffCode}
                </span>
              )}
              {staff?.jdUrl && (
                <a
                  href={staff.jdUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-xs text-purple-700 font-medium hover:bg-purple-100 transition-colors"
                >
                  <ExternalLink size={11} /> View JD Document
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Part 4 Score (20pts)</p>
            <p className={`text-2xl font-extrabold ${
              score >= 19 ? 'text-indigo-600' : score >= 15 ? 'text-green-600' :
              score >= 10 ? 'text-yellow-600' : score >= 6 ? 'text-orange-600' : 'text-red-600'
            }`}>
              {score}
              <span className="text-sm font-medium text-gray-400 ml-1">/ 20</span>
            </p>
          </div>
          {saved ? (
            <button onClick={handleEdit} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">แก้ไข</button>
          ) : (
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700">
              <Save size={14} /> บันทึก
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Saved banner */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200">
          <CheckCircle2 size={15} className="text-purple-600 shrink-0" />
          <p className="text-sm text-purple-700 font-medium">
            บันทึกแล้ว — คะแนน Part 4: <strong>{score} / 20</strong>
          </p>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-700">
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
        <p>
          ประเมินว่าพนักงานปฏิบัติตามลักษณะงานอย่างเป็นทางการได้ดีเพียงใดในไตรมาสนี้ คะแนนต่ำกว่า 10 หรือสูงกว่า 18 จำเป็นต้องกรอกความคิดเห็นประกอบ
        </p>
      </div>

      {/* Single slider */}
      <ScoreSlider
        label="การปฏิบัติตามลักษณะงาน (JD) โดยรวม"
        score={score}
        comment={comment}
        onScoreChange={(v) => { setSaved(false); setScore(v); setError('') }}
        onCommentChange={(v) => { setSaved(false); setComment(v); setError('') }}
        disabled={isReadOnly}
      />

      {/* Scoring guide */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">เกณฑ์การให้คะแนน</p>
        <div className="space-y-2">
          {[
            { range: '19 – 20', desc: 'ปฏิบัติงานเกินความคาดหวังในทุกด้านในลักษณะงาน คุณภาพโดดเด่น', color: 'bg-indigo-500' },
            { range: '15 – 18', desc: 'ปฏิบัติตามลักษณะงานได้ครบถ้วน ผลงานดีในส่วนใหญ่', color: 'bg-green-500' },
            { range: '10 – 14', desc: 'ปฏิบัติตามลักษณะงานหลักได้ มีบางด้านที่ควรปรับปรุง', color: 'bg-yellow-400' },
            { range: '6 – 9',   desc: 'ปฏิบัติตามลักษณะงานได้เพียงบางส่วน หน้าที่หลายอย่างยังไม่สมบูรณ์', color: 'bg-orange-400' },
            { range: '0 – 5',   desc: 'ไม่เป็นไปตามลักษณะงานขั้นพื้นฐาน พบช่องโหว่งอย่างชัดเจน', color: 'bg-red-500' },
          ].map((g) => (
            <div key={g.range} className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${g.color}`} />
              <div>
                <span className="text-xs font-bold text-gray-700">{g.range}: </span>
                <span className="text-xs text-gray-500">{g.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
