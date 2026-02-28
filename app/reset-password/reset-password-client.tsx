'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordClient() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    const client = supabaseRef.current
    const setReadyIfRecovered = () => setReady(true)

    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReadyIfRecovered()
    })

    client.auth.getSession().then(({ data: { session } }) => {
      const isRecovery = typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
      if (session && isRecovery) setReadyIfRecovered()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/login?reset=success')
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
          Set New Password
        </h2>

        {!ready ? (
          <>
            <p className="text-center text-gray-500 text-sm">Verifying your reset link…</p>
            <p className="text-center mt-4 text-gray-600">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sky-600 font-semibold hover:underline"
              >
                Back to Sign In
              </button>
            </p>
          </>
        ) : (
          <>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
            <p className="text-center mt-4 text-gray-600">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sky-600 font-semibold hover:underline"
              >
                Back to Sign In
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}