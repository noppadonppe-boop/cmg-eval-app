import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Clock, LogOut, CheckCircle2 } from 'lucide-react'

export default function PendingPage() {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()

  // Auto-redirect when admin approves (real-time via AuthContext subscription)
  useEffect(() => {
    if (!userProfile) return
    if (userProfile.status === 'approved') navigate('/', { replace: true })
    if (userProfile.status === 'rejected') navigate('/login', { replace: true })
  }, [userProfile?.status, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Clock size={36} className="text-amber-500" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">รอการอนุมัติ</h2>
        <p className="text-sm text-gray-500 mb-2">
          บัญชีของคุณ <strong className="text-gray-700">{userProfile?.email}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          อยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ ระบบจะนำคุณเข้าสู่ระบบโดยอัตโนมัติเมื่อได้รับการอนุมัติ
        </p>

        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-xs font-medium text-amber-700">กำลังรอการอนุมัติ...</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-indigo-500" />
            สิ่งที่จะเกิดขึ้นต่อไป
          </p>
          <ul className="text-xs text-gray-500 space-y-1.5 pl-4">
            <li>• ผู้ดูแลระบบ (MasterAdmin) จะตรวจสอบและอนุมัติบัญชีของคุณ</li>
            <li>• เมื่อได้รับการอนุมัติ ระบบจะนำคุณเข้าสู่หน้าหลักโดยอัตโนมัติ</li>
            <li>• คุณไม่ต้องรีเฟรชหน้า</li>
          </ul>
        </div>

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <LogOut size={15} />
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
