import { useState, useEffect } from 'react'
import { BookOpen, User, Briefcase, Users, Shield, Crown, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { ROLE_META, ROLE_BADGE_CLASSES, ROLE_AVATAR_BG } from '../hooks/useRBAC'

const TABS = [
  { id: 'staff', label: 'Staff',    role: 'Staff', icon: <User size={15} /> },
  { id: 'hr',    label: 'HR Admin', role: 'HR',    icon: <Shield size={15} /> },
  { id: 'hrm',   label: 'HRM',      role: 'HRM',   icon: <Briefcase size={15} /> },
  { id: 'gm',    label: 'GM',       role: 'GM',    icon: <Users size={15} /> },
  { id: 'md',    label: 'MD',       role: 'MD',    icon: <Crown size={15} /> },
]

const SCORE_BANDS = [
  { range: '0 – 5',   label: 'ต้องปรับปรุง',      color: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  { range: '6 – 9',   label: 'ต่ำกว่าเกณฑ์',      color: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { range: '10 – 14', label: 'พอใช้',              color: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { range: '15 – 18', label: 'ดี',                 color: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  { range: '19 – 20', label: 'ดีเยี่ยม',           color: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
]

const PERMISSIONS_MATRIX = [
  { action: 'ประเมินตนเองด้านสมรรถนะ (ส่วนที่ 1)',           Staff: true,  HR: false, HRM: false, GM: false, MD: false },
  { action: 'ประเมินคนอื่นด้านสมรรถนะ (ถ้า Assign เป็น Sup/Stake)', Staff: true,  HR: false, HRM: false, GM: false, MD: false },
  { action: 'บันทึกข้อมูลวินัย (ส่วนที่ 2)',                 Staff: false, HR: true,  HRM: true,  GM: false, MD: false },
  { action: 'กำหนด KPI (ถ้า Assign เป็น Supervisor)',                 Staff: true,  HR: false, HRM: false, GM: false, MD: false },
  { action: 'ยอมรับ / ปฏิเสธ KPI (ส่วนที่ 3)',              Staff: true,  HR: false, HRM: false, GM: false, MD: false },
  { action: 'ประเมินลักษณะงาน/JD (ส่วนที่ 4)',              Staff: true,  HR: false, HRM: false, GM: false, MD: false },
  { action: 'กำหนด Supervisor/Stakeholder (Hierarchy)',                Staff: false, HR: true,  HRM: true,  GM: true,  MD: false },
  { action: 'จัดการผู้ใช้/ปีประเมิน (Admin)',                     Staff: false, HR: true,  HRM: true,  GM: true,  MD: false },
  { action: 'ดูแดชบอร์ดรายไตรมาส (ส่วนที่ 5)',              Staff: true,  HR: true,  HRM: true,  GM: true,  MD: true  },
  { action: 'ดูแนวโน้มรายปี (ส่วนที่ 6)',                    Staff: false, HR: true,  HRM: true,  GM: true,  MD: true  },
  { action: 'ดูการประเมินทั้งหมด',                            Staff: false, HR: true,  HRM: true,  GM: true,  MD: true  },
]

const MANUAL_CONTENT = {
  staff: {
    color: 'blue',
    sections: [
      {
        title: 'บทบาทของคุณในระบบประเมินผล',
        content:
          'ในฐานะพนักงาน (Staff) คุณจะเข้าร่วมกระบวนการประเมินผลแบบ 360 องศา ซึ่งประกอบด้วย 4 ส่วน ได้แก่ สมรรถนะ (30 คะแนน) วินัย (20 คะแนน) KPI (30 คะแนน) และลักษณะงาน/JD (20 คะแนน) คะแนนรวมของคุณจะเป็นตัวกำหนดผลการประเมินประจำปี',
      },
      {
        title: 'ส่วนที่ 1 – การประเมินตนเองด้านสมรรถนะ (30 คะแนน)',
        content:
          'คุณจะประเมินตนเองในด้านสมรรถนะหลักโดยใช้แถบเลื่อนคะแนน 0–20 แต่ละด้านมีแถบสีบ่งชี้ระดับผลงาน ได้แก่ แดง (0–5 = ต้องปรับปรุง) ส้ม (6–9 = ต่ำกว่าเกณฑ์) เหลือง (10–14 = พอใช้) เขียว (15–18 = ดี) และน้ำเงิน (19–20 = ดีเยี่ยม) จำเป็นต้องกรอกความคิดเห็นหากคะแนนต่ำกว่า 10 หรือสูงกว่า 18',
      },
      {
        title: 'ส่วนที่ 3 – กระบวนการ KPI',
        content:
          'หัวหน้างานจะกำหนด KPI พร้อมเป้าหมายให้คุณ คุณต้องตรวจสอบและยอมรับหรือปฏิเสธ KPI แต่ละรายการ หากปฏิเสธ ต้องระบุเหตุผล เฉพาะ KPI ที่ได้รับการยอมรับเท่านั้นที่นับเป็นคะแนนสุดท้าย คุณสามารถดูสถานะ KPI ทั้งหมดที่ได้รับมอบหมายได้ตลอดเวลา',
      },
      {
        title: 'ส่วนที่ 4 – ลักษณะงาน/JD (20 คะแนน)',
        content:
          'คุณจะประเมินตนเองว่าปฏิบัติงานตามลักษณะงาน (Job Description) ได้ดีเพียงใดโดยใช้แถบเลื่อน 0–20 กรณีคะแนนต่ำกว่า 10 หรือสูงกว่า 18 ต้องกรอกความคิดเห็นประกอบ ปุ่ม "View JD Document" จะปรากฏเมื่อ HR ลิงก์เอกสาร JD ของคุณไว้ในระบบ',
      },
      {
        title: 'ส่วนที่ 5 – สรุปผลรายไตรมาส',
        content:
          'เมื่อสิ้นสุดแต่ละไตรมาส คุณสามารถดูคะแนนรวมจากทั้ง 4 ส่วนการประเมิน ซึ่งสะท้อนภาพรวมผลการปฏิบัติงานของคุณตลอดทั้งปี',
      },
    ],
  },
  hrm: {
    color: 'teal',
    sections: [
      {
        title: 'บทบาท HRM ในระบบประเมินผล',
        content:
          'ในฐานะ HRM (HR Manager) คุณมีสิทธิ์เทียบเท่า HR Admin ได้แก่ จัดการผู้ใช้ กำหนด Hierarchy (Supervisor/Stakeholder) บันทึกข้อมูลวินัย และดูรายงานทั้งหมด นอกจากนี้คุณยังสามารถถูก Assign เป็น Supervisor หรือ Stakeholder ของพนักงานคนใดก็ได้',
      },
      {
        title: 'การ Assign Supervisor/Stakeholder',
        content:
          'HRM สามารถใช้หน้า Admin → Hierarchy เพื่อกำหนดว่าใครจะเป็น Supervisor และ Stakeholder ของพนักงานแต่ละคน โดยผู้ที่ถูก Assign จะได้รับสิทธิ์ประเมินพนักงานคนนั้นในส่วนที่เกี่ยวข้องโดยอัตโนมัติ',
      },
      {
        title: 'การบันทึกข้อมูลวินัย (ส่วนที่ 2)',
        content:
          'HRM สามารถบันทึกข้อมูลวินัยของพนักงานได้เช่นเดียวกับ HR ครอบคลุมการเข้างาน การลา และการปฏิบัติตามกฎระเบียบ',
      },
    ],
  },
  gm: {
    color: 'orange',
    sections: [
      {
        title: 'บทบาท GM ในระบบประเมินผล',
        content:
          'ในฐานะ GM (General Manager) คุณมีสิทธิ์เข้าถึง Admin เพื่อจัดการผู้ใช้และกำหนด Hierarchy ได้ รวมถึงดูแดชบอร์ดและรายงานทั้งหมด คุณสามารถถูก Assign เป็น Supervisor หรือ Stakeholder ของพนักงานได้เช่นกัน',
      },
      {
        title: 'การ Assign Supervisor/Stakeholder',
        content:
          'GM สามารถกำหนด Supervisor/Stakeholder ใน Admin → Hierarchy ได้ เมื่อถูก Assign เป็น Supervisor คุณจะสามารถกำหนด KPI และประเมินสมรรถนะ/JD ของพนักงานนั้นได้ผ่านหน้าประเมิน',
      },
      {
        title: 'แดชบอร์ดและรายงาน',
        content:
          'GM มีสิทธิ์ดูแดชบอร์ดรายไตรมาส (ส่วนที่ 5) และแนวโน้มรายปี (ส่วนที่ 6) ครบถ้วน เพื่อใช้ในการตัดสินใจเชิงบริหารระดับองค์กร',
      },
    ],
  },
  hr: {
    color: 'green',
    sections: [
      {
        title: 'บทบาทของคุณในระบบประเมินผล',
        content:
          'ในฐานะ HR / ผู้ดูแลระบบ คุณมีหน้าที่จัดการการตั้งค่าระบบ บันทึกข้อมูลวินัย ดูแลการประเมินทั้งหมด และรักษาความถูกต้องของข้อมูลในทุกปีประเมิน คุณมีสิทธิ์อ่านข้อมูลคะแนนและรายงานได้ทั้งหมด',
      },
      {
        title: 'การจัดการระบบผู้ดูแล (Admin)',
        content:
          'ใช้แผงผู้ดูแลระบบเพื่อจัดการผู้ใช้ (เพิ่ม แก้ไข ลบ) จัดการการตั้งค่าพนักงานรายปี (กำหนดหัวหน้างาน ผู้มีส่วนได้เสีย โควตาการลา) และสร้างปีประเมินใหม่ เมื่อเพิ่มปีใหม่ ระบบจะโคลนโครงสร้างพนักงาน-หัวหน้างาน-ผู้มีส่วนได้เสียจากปีก่อนหน้าโดยอัตโนมัติ',
      },
      {
        title: 'ส่วนที่ 2 – การบันทึกข้อมูลวินัย (20 คะแนน)',
        content:
          'HR เป็นบทบาทเดียวที่สามารถบันทึกข้อมูลส่วนที่ 2 (วินัย) ได้ ครอบคลุมข้อมูลการเข้างาน ความตรงต่อเวลา การใช้สิทธิ์ลา และการปฏิบัติตามกฎระเบียบ บันทึกข้อมูลรายพนักงานรายไตรมาส และคะแนนจะถูกคำนวณอัตโนมัติตามเกณฑ์ที่กำหนด',
      },
      {
        title: 'การกำกับดูแลและรายงานผล',
        content:
          'HR สามารถดูการประเมินทั้งหมดในทุกบทบาท ทุกไตรมาส และทุกปี ใช้โมดูลส่วนที่ 5 (แดชบอร์ดรายไตรมาส) และส่วนที่ 6 (แนวโน้มรายปี) สำหรับรายงานในระดับองค์กร',
      },
    ],
  },
  md: {
    color: 'red',
    sections: [
      {
        title: 'บทบาท MD ในระบบประเมินผล',
        content:
          'ในฐานะ MD (Managing Director) คุณมีสิทธิ์อ่านข้อมูลการประเมินทั้งหมดในทุกพนักงาน ทุกปี และทุกหน่วยงาน MD เป็น Read-Only Exec ที่ไม่สามารถแก้ไขข้อมูลหรือ Assign Hierarchy ได้ อินเทอร์เฟซหลักคือแดชบอร์ดเชิงกลยุทธ์',
      },
      {
        title: 'ส่วนที่ 5 – แดชบอร์ดสรุปผลรายไตรมาส',
        content:
          'ดูสรุปผลการปฏิบัติงานระดับองค์กรแยกตามไตรมาส กราฟแสดงการกระจายคะแนนในทั้ง 4 ส่วนการประเมิน เพื่อระบุผู้มีผลงานโดดเด่นและพื้นที่ที่ต้องพัฒนา',
      },
      {
        title: 'ส่วนที่ 6 – แนวโน้มผลการปฏิบัติงานรายปี (หลายปี)',
        content:
          'แดชบอร์ดแนวโน้มรายปีนำเสนอการเปรียบเทียบผลการปฏิบัติงานหลายปี ติดตามวิถีการเติบโตของทีมและรายบุคคล สนับสนุนการตัดสินใจเชิงกลยุทธ์ด้าน HR รวมถึงการเลื่อนตำแหน่ง การลงทุนด้านการฝึกอบรม และการวางแผนสืบทอดตำแหน่ง',
      },
    ],
  },
}

const COLOR_MAP = {
  blue:   { activeTab: 'bg-blue-600 text-white border-blue-600',     border: 'border-l-blue-500',   header: 'bg-blue-50 border-blue-100' },
  green:  { activeTab: 'bg-green-600 text-white border-green-600',   border: 'border-l-green-500',  header: 'bg-green-50 border-green-100' },
  teal:   { activeTab: 'bg-teal-600 text-white border-teal-600',     border: 'border-l-teal-500',   header: 'bg-teal-50 border-teal-100' },
  orange: { activeTab: 'bg-orange-500 text-white border-orange-500', border: 'border-l-orange-400', header: 'bg-orange-50 border-orange-100' },
  red:    { activeTab: 'bg-red-600 text-white border-red-600',       border: 'border-l-red-500',    header: 'bg-red-50 border-red-100' },
}

export default function ManualPage() {
  const { currentUser } = useApp()
  const defaultTab = ROLE_META[currentUser?.role]?.tabKey || 'staff'
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [showMatrix, setShowMatrix] = useState(false)

  useEffect(() => {
    const tab = ROLE_META[currentUser?.role]?.tabKey
    if (tab) setActiveTab(tab)
  }, [currentUser?.role])

  const content = MANUAL_CONTENT[activeTab]
  const colors = COLOR_MAP[content.color]

  const activeTabMeta = TABS.find((t) => t.id === activeTab)
  const isMyRole = ROLE_META[currentUser?.role]?.tabKey === activeTab

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2.5 rounded-xl">
            <BookOpen size={22} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">คู่มือการใช้งาน</h1>
            <p className="text-gray-500 text-sm mt-0.5">คู่มือแยกตามบทบาทสำหรับระบบประเมินผล CMG</p>
          </div>
        </div>
        <button
          onClick={() => setShowMatrix((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
            showMatrix ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          <Info size={14} />
          ตารางสิทธิ์การใช้งาน
        </button>
      </div>

      {/* Auto-role banner */}
      {isMyRole && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
          COLOR_MAP[content.color].header
        }`}>
          <AlertTriangle size={15} className="text-amber-500 shrink-0" />
          <p className="text-sm text-gray-700">
            แสดงคู่มือสำหรับ <strong>{activeTabMeta?.label}</strong> — บทบาทที่คุณใช้งานอยู่ในขณะนี้
            เลือกแท็บอื่นด้านบนเพื่ออ่านคู่มือของบทบาทอื่น
          </p>
        </div>
      )}

      {/* Permissions Matrix */}
      {showMatrix && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">ตารางสิทธิ์ตามบทบาท</h2>
            <p className="text-xs text-gray-500 mt-0.5">สิ่งที่แต่ละบทบาทสามารถดำเนินการได้ในระบบ</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide w-64">การดำเนินการ</th>
                  {TABS.map((tab) => (
                    <th key={tab.id} className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                        ROLE_BADGE_CLASSES[tab.role] || 'bg-gray-100 text-gray-600 ring-gray-200'
                      }`}>
                        {tab.icon}
                        {tab.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS_MATRIX.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-5 py-3 text-gray-700 font-medium border-r border-gray-100">{row.action}</td>
                    {(['Staff', 'HR', 'HRM', 'GM', 'MD']).map((role) => (
                      <td key={role} className="px-4 py-3 text-center">
                        {row[role]
                          ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                          : <XCircle size={16} className="text-gray-200 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const c = COLOR_MAP[MANUAL_CONTENT[tab.id].color]
          const isMine = ROLE_META[currentUser?.role]?.tabKey === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                isActive
                  ? `${c.activeTab} shadow-sm`
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {isMine && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
              )}
            </button>
          )
        })}
        <p className="self-center text-xs text-gray-400 ml-1">
          <span className="inline-block w-2 h-2 bg-amber-400 rounded-full mr-1" />= บทบาทปัจจุบันของคุณ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main guide content */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className={`px-6 py-4 border-b ${COLOR_MAP[content.color].header}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                ROLE_BADGE_CLASSES[activeTabMeta?.role] || 'bg-gray-100 text-gray-600 ring-gray-200'
              }`}>
                {activeTabMeta?.icon}
                {activeTabMeta?.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mt-2">
              คู่มือการใช้งาน
            </h2>
          </div>
          <div className="p-6 space-y-5">
            {content.sections.map((section, idx) => (
              <div key={idx} className={`border-l-4 ${colors.border} pl-4 py-0.5`}>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{section.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: Score Reference + Evaluation Parts */}
        <div className="space-y-4">
          {/* Score Band Reference */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">ระดับคะแนนสมรรถนะ</h3>
              <p className="text-xs text-gray-500 mt-0.5">แถบเลื่อน 0–20 (ส่วนที่ 1 และ 4)</p>
            </div>
            <div className="p-3 space-y-2">
              {SCORE_BANDS.map((band) => (
                <div key={band.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${band.bg} ${band.border}`}>
                  <div className={`w-3 h-3 rounded-full shrink-0 ${band.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${band.text}`}>{band.label}</span>
                      <span className={`text-xs font-mono font-medium ${band.text}`}>{band.range}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-orange-600">ต้องกรอกความคิดเห็น</strong> เมื่อคะแนน <strong>&lt;10</strong> หรือ <strong>&gt;18</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Evaluation Parts Summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">ส่วนการประเมิน</h3>
              <p className="text-xs text-gray-500 mt-0.5">คะแนนรวม: 100 คะแนน</p>
            </div>
            <div className="p-3 space-y-1.5">
              {[
                { part: 'ส่วนที่ 1', title: 'สมรรถนะ',       pts: 30, color: 'bg-indigo-500', who: 'Staff / Sup / Stake' },
                { part: 'ส่วนที่ 2', title: 'วินัย',           pts: 20, color: 'bg-green-500',  who: 'HR เท่านั้น' },
                { part: 'ส่วนที่ 3', title: 'KPI',              pts: 30, color: 'bg-blue-500',   who: 'Sup กำหนด / Staff ประเมิน' },
                { part: 'ส่วนที่ 4', title: 'ลักษณะงาน/JD',    pts: 20, color: 'bg-purple-500', who: 'Staff / Sup / Stake' },
              ].map((p) => (
                <div key={p.part} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${p.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-900">{p.part} – {p.title}</span>
                      <span className="text-xs font-bold text-gray-500">{p.pts}pts</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{p.who}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-700">คะแนนรวม</span>
                <span className="text-sm font-bold text-indigo-600">100 คะแนน</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
