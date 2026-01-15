'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [major, setMajor] = useState('')
  const [year, setYear] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const eventId = searchParams?.get('eventId')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (authError) throw authError

        if (authData.user) {
          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email,
              name,
              user_type: 'student',
              major: major || null,
              year: year || null,
            })

          if (profileError) throw profileError

          // If signing up for check-in, auto-check-in and redirect
          if (eventId) {
            // Small delay to ensure profile is fully created
            await new Promise(resolve => setTimeout(resolve, 500))
            
            try {
              const { error: checkInError } = await supabase
                .from('check_ins')
                .insert({
                  event_id: eventId,
                  student_id: authData.user.id
                })

              if (checkInError && checkInError.code !== '23505') {
                console.error('Check-in error:', checkInError)
              }
            } catch (err) {
              console.error('Error during auto check-in:', err)
            }

            router.push(`/checkin/${eventId}`)
            return
          }

          // Redirect to events page
          router.push('/events')
        }
      } else {
        // Sign in
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (authError) throw authError

        if (authData.user) {
          // If logging in for check-in, auto-check-in and redirect
          if (eventId) {
            // Check if already checked in
            const { data: existingCheckIn } = await supabase
              .from('check_ins')
              .select('*')
              .eq('event_id', eventId)
              .eq('student_id', authData.user.id)
              .single()

            if (!existingCheckIn) {
              // Perform check-in
              const { error: checkInError } = await supabase
                .from('check_ins')
                .insert({
                  event_id: eventId,
                  student_id: authData.user.id
                })

              if (checkInError && checkInError.code !== '23505') {
                // If not a duplicate error, log it but continue
                console.error('Check-in error:', checkInError)
              }
            }

            // Redirect to check-in page (will show success)
            router.push(`/checkin/${eventId}`)
            return
          }

          // Get user profile to determine redirect
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('id', authData.user.id)
            .single()

          if (profile?.user_type === 'student') {
            router.push('/events')
          } else {
            router.push('/dashboard')
          }
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
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          SSA Events Platform
        </h1>
        <h2 className="text-xl font-semibold text-center mb-6 text-gray-600">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Major
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
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
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-4 text-gray-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="text-sky-600 font-semibold hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}

