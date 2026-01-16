'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, AlertCircle, Calendar, MapPin, Users } from 'lucide-react'
import { format } from 'date-fns'

interface Event {
  id: string
  title: string
  description: string
  event_date: string
  location: string
  capacity: number
}

export default function CheckInClient({
  event,
  userId,
  alreadyCheckedIn
}: {
  event: Event
  userId: string
  alreadyCheckedIn: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    alreadyCheckedIn ? 'success' : 'idle'
  )
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleCheckIn = async () => {
    if (alreadyCheckedIn) {
      setStatus('success')
      return
    }

    setStatus('loading')

    try {
      const { error } = await supabase
        .from('check_ins')
        .insert({
          event_id: event.id,
          student_id: userId
        })

      if (error) {
        if (error.code === '23505') { // Unique violation
          setStatus('success')
        } else {
          throw error
        }
      } else {
        setStatus('success')
      }
    } catch (err) {
      console.error('Check-in error:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : String(err) || 'Failed to check in. Please try again.')
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(to bottom right, rgb(14 165 233), rgb(59 130 246))' }}
    >
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-lg">
        {/* Event Info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
          
          <div className="space-y-2 text-gray-600 text-xs sm:text-sm mt-4">
            <div className="flex items-center justify-center">
              <Calendar size={14} className="sm:size-16 mr-2" />
              <span className="break-words">{format(new Date(event.event_date), 'EEEE, MMMM d, yyyy • h:mm a')}</span>
            </div>
            <div className="flex items-center justify-center">
              <MapPin size={14} className="sm:size-16 mr-2" />
              <span className="break-words">{event.location}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 my-6" />

        {/* Status Display */}
        {status === 'idle' && (
          <div className="text-center">
            <AlertCircle className="mx-auto text-blue-500 mb-4 sm:size-64" size={48} />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Ready to Check In?</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Click the button below to confirm your attendance at this event.
            </p>
            <button
              onClick={handleCheckIn}
              className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 transition"
            >
              Check In Now
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Checking you in...</h2>
            <p className="text-gray-600">Please wait a moment</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4 sm:size-64" size={48} />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
              {alreadyCheckedIn ? "Checked In!" : "Check-In Successful!"}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              {alreadyCheckedIn 
                ? "You&apos;re checked in to this event. Enjoy!"
                : "You&apos;re all set! Enjoy the event."}
            </p>
            <button
              onClick={() => router.push('/events')}
              className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              Back to Events
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <XCircle className="mx-auto text-red-500 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Check-In Failed</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => setStatus('idle')}
              className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}