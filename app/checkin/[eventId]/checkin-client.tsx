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
  profiles: {
    organization_name: string
  }
}

export default function CheckInClient({
  event,
  userId,
  hasRsvp,
  alreadyCheckedIn
}: {
  event: Event
  userId: string
  hasRsvp: boolean
  alreadyCheckedIn: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    alreadyCheckedIn ? 'success' : 'idle'
  )
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleCheckIn = async () => {
    if (!hasRsvp) {
      setStatus('error')
      setErrorMessage("You haven't RSVP'd to this event. Please RSVP first!")
      return
    }

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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-lg">
        {/* Event Info */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
          <p className="text-purple-600 font-medium mb-4">{event.profiles.organization_name}</p>
          
          <div className="space-y-2 text-gray-600 text-sm">
            <div className="flex items-center justify-center">
              <Calendar size={16} className="mr-2" />
              {format(new Date(event.event_date), 'EEEE, MMMM d, yyyy • h:mm a')}
            </div>
            <div className="flex items-center justify-center">
              <MapPin size={16} className="mr-2" />
              {event.location}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 my-6" />

        {/* Status Display */}
        {status === 'idle' && (
          <div className="text-center">
            <AlertCircle className="mx-auto text-blue-500 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Check In?</h2>
            {hasRsvp ? (
              <>
                <p className="text-gray-600 mb-6">
                  Click the button below to confirm your attendance at this event.
                </p>
                <button
                  onClick={handleCheckIn}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Check In Now
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  You need to RSVP before you can check in to this event.
                </p>
                <button
                  onClick={() => router.push('/events')}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Go to Events & RSVP
                </button>
              </>
            )}
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Checking you in...</h2>
            <p className="text-gray-600">Please wait a moment</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {alreadyCheckedIn ? "Already Checked In!" : "Check-In Successful!"}
            </h2>
            <p className="text-gray-600 mb-6">
              {alreadyCheckedIn 
                ? "You've already checked in to this event. Enjoy!"
                : "You're all set! Enjoy the event."}
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
            <div className="space-y-3">
              {!hasRsvp && (
                <button
                  onClick={() => router.push('/events')}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Go to Events & RSVP
                </button>
              )}
              <button
                onClick={() => setStatus('idle')}
                className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}