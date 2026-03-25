import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerWithEmail, loginWithGoogle } from '../services/authService'
import { Eye, EyeOff, UserPlus, AlertCircle, Loader, CheckCircle2 } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default function RegisterPage() {
  const { userProfile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ firstName: '', lastName: '', position: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!userProfile) return
    if (userProfile.status === 'approved') { navigate('/', { replace: true }); return }
    if (userProfile.status === 'pending') { navigate('/pending', { replace: true }) }
  }, [userProfile, navigate])

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (form.password !== form.confirm) { setError('รหัสผ่านไม่ตรงกัน'); return }
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('กรุณากรอกชื่อและนามสกุล'); return }
    setLoading(true)
    try {
      const result = await registerWithEmail(form.email.trim(), form.password, form.firstName.trim(), form.lastName.trim(), form.position.trim())
      if (result.profile?.isFirstUser) {
        await refreshProfile()
      } else {
        setSuccess(true)
      }
    } catch (err) {
      const code = err?.code || ''
      if (code.includes('email-already-in-use')) setError('อีเมลนี้ถูกใช้งานแล้ว')
      else if (code.includes('invalid-email')) setError('รูปแบบอีเมลไม่ถูกต้อง')
      else if (code.includes('weak-password')) setError('รหัสผ่านไม่ปลอดภัยพอ')
      else setError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      await refreshProfile()
    } catch (err) {
      const code = err?.code || ''
      if (code.includes('popup-closed')) setError('ปิด popup ก่อนดำเนินการเสร็จ')
      else setError(err?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setGoogleLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">สมัครสมาชิกสำเร็จ!</h2>
          <p className="text-sm text-gray-500 mb-6">บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ กรุณารอการแจ้งเตือน</p>
          <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-2xl mb-3 shadow-lg">
            <span className="text-white text-base font-bold">CMG</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">สมัครสมาชิก</h1>
          <p className="text-gray-500 text-sm mt-1">สร้างบัญชีเพื่อใช้งานระบบประเมินผล</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 mb-4"
          >
            {googleLoading ? <Loader size={18} className="animate-spin" /> : <GoogleIcon />}
            สมัครด้วย Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">หรือกรอกข้อมูล</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ชื่อ *</label>
                <input type="text" value={form.firstName} onChange={set('firstName')} placeholder="ชื่อ" required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">นามสกุล *</label>
                <input type="text" value={form.lastName} onChange={set('lastName')} placeholder="นามสกุล" required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ตำแหน่ง</label>
              <input type="text" value={form.position} onChange={set('position')} placeholder="เช่น Software Engineer"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">อีเมล *</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">รหัสผ่าน * (อย่างน้อย 6 ตัว)</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••" required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-9" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ยืนยันรหัสผ่าน *</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {loading ? <Loader size={15} className="animate-spin" /> : <UserPlus size={15} />}
              สมัครสมาชิก
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            มีบัญชีแล้ว?{' '}
            <Link to="/login" className="text-indigo-600 font-semibold hover:underline">เข้าสู่ระบบ</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
