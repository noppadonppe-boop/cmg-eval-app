import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginWithEmail, loginWithGoogle } from '../services/authService'
import { Eye, EyeOff, LogIn, AlertCircle, Loader } from 'lucide-react'

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

export default function LoginPage() {
  const { userProfile, authLoading, refreshProfile, hasConfig } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect when profile loads
  useEffect(() => {
    if (!userProfile) return
    if (userProfile.status === 'rejected') {
      setError('บัญชีของคุณถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ')
      return
    }
    if (userProfile.status === 'pending') { navigate('/pending', { replace: true }); return }
    if (userProfile.status === 'approved') { navigate(from, { replace: true }) }
  }, [userProfile, from, navigate])

  const handleError = (err) => {
    const code = err?.code || ''
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    else if (code.includes('too-many-requests'))
      setError('ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่')
    else if (code.includes('popup-closed'))
      setError('ปิด popup ก่อนดำเนินการเสร็จ กรุณาลองใหม่')
    else if (code.includes('unauthorized-domain'))
      setError('โดเมนนี้ไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบ')
    else setError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
  }

  const handleEmail = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email.trim(), password)
      await refreshProfile()
    } catch (err) {
      handleError(err)
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
      handleError(err)
    } finally {
      setGoogleLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader size={28} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-xl font-bold">CMG</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CMG Performance Evaluation</h1>
          <p className="text-gray-500 text-sm mt-1">เข้าสู่ระบบเพื่อดำเนินการ</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Google Sign-In */}
          {hasConfig && (
            <>
              <button
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? <Loader size={18} className="animate-spin" /> : <GoogleIcon />}
                เข้าสู่ระบบด้วย Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">หรือ</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
              เข้าสู่ระบบ
            </button>
          </form>

          {hasConfig && (
            <p className="text-center text-xs text-gray-500 mt-5">
              ยังไม่มีบัญชี?{' '}
              <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
                สมัครสมาชิก
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
