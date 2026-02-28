'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

type View = 'signin' | 'signup' | 'forgot'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [major, setMajor] = useState('')
  const [year, setYear] = useState('')
  const [view, setView] = useState<View>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams?.get('reset') === 'success') {
      setSuccessMsg('Your password has been updated. You can sign in now.')
    }
  }, [searchParams])

  const eventId = searchParams?.get('eventId')

  const switchView = (v: View) => {
    setView(v)
    setError('')
    setSuccessMsg('')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSuccessMsg('Check your email for a password reset link!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (view === 'signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) throw authError

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            email,
            name,
            user_type: 'student',
            major: major || null,
            year: year || null,
          })
          if (profileError) throw profileError

          if (eventId) {
            await new Promise(resolve => setTimeout(resolve, 500))
            try {
              const { error: checkInError } = await supabase
                .from('check_ins')
                .insert({ event_id: eventId, student_id: authData.user.id })
              if (checkInError && checkInError.code !== '23505') console.error('Check-in error:', checkInError)
            } catch (err) {
              console.error('Error during auto check-in:', err)
            }
            router.push(`/checkin/${eventId}`)
            return
          }
          router.push('/events')
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError

        if (authData.user) {
          if (eventId) {
            const { data: existingCheckIn } = await supabase
              .from('check_ins')
              .select('*')
              .eq('event_id', eventId)
              .eq('student_id', authData.user.id)
              .single()

            if (!existingCheckIn) {
              const { error: checkInError } = await supabase
                .from('check_ins')
                .insert({ event_id: eventId, student_id: authData.user.id })
              if (checkInError && checkInError.code !== '23505') console.error('Check-in error:', checkInError)
            }
            router.push(`/checkin/${eventId}`)
            return
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('id', authData.user.id)
            .single()

          router.push(profile?.user_type === 'student' ? '/events' : '/dashboard')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(to bottom right, rgb(14 165 233), rgb(59 130 246))' }}
    >
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-gray-800">
          SSA Events Platform
        </h1>
        <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6 text-gray-600">
          {view === 'signup' ? 'Create Account' : view === 'forgot' ? 'Reset Password' : 'Sign In'}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-sm">
            {successMsg}
          </div>
        )}

        {/* ── FORGOT PASSWORD VIEW ── */}
        {view === 'forgot' ? (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 text-white py-2 rounded-lg font-semibold hover:bg-sky-700 transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="text-center mt-4 text-gray-600">
              Remember it?{' '}
              <button onClick={() => switchView('signin')} className="text-sky-600 font-semibold hover:underline">
                Sign In
              </button>
            </p>
          </>
        ) : (
          /* ── SIGN IN / SIGN UP VIEW ── */
          <>
            <form onSubmit={handleAuth} className="space-y-4">
              {view === 'signup' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Major</label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                    >
                      <option value="">Select Year</option>
                      <option value="Freshman">Freshman</option>
                      <option value="Sophomore">Sophomore</option>
                      <option value="Junior">Junior</option>
                      <option value="Senior">Senior</option>
                      <option value="Graduate">Graduate</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  {view === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className="text-xs text-sky-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 text-white py-2 rounded-lg font-semibold hover:bg-sky-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : view === 'signup' ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            <p className="text-center mt-4 text-gray-600">
              {view === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => switchView(view === 'signup' ? 'signin' : 'signup')}
                className="text-sky-600 font-semibold hover:underline"
              >
                {view === 'signup' ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}