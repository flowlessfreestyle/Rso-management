'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, LogOut, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'
import Logo from '@/app/components/Logo'

interface Rsvp {
  id: string
  event_id: string
  rsvp_date: string
  events: {
    id: string
    title: string
    description: string
    event_date: string
    location: string
  }
}

export default function MyRsvpsClient({ rsvps, userId }: { rsvps: Rsvp[], userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Filter out past events
  const now = new Date()
  const upcomingRsvps = rsvps.filter(rsvp => new Date(rsvp.events.event_date) >= now)

  const handleCancelRsvp = async (eventId: string, eventDate: string) => {
    // Check if event is more than 24 hours past
    const eventDateTime = new Date(eventDate)
    const now = new Date()
    const hoursSinceEvent = (now.getTime() - eventDateTime.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceEvent > 24) {
      setError('Cannot cancel RSVP for events that occurred more than 24 hours ago.')
      return
    }

    setLoading(eventId)
    setError('')
    
    try {
      const { error: deleteError } = await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('student_id', userId)
      
      if (deleteError) throw deleteError
      
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel RSVP')
    } finally {
      setLoading(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Logo href="/events" />
              <Link href="/events" className="text-gray-600 hover:text-gray-900">Events</Link>
              <Link href="/my-rsvps" className="text-gray-900 font-medium">My RSVPs</Link>
              <Link href="/profiles/student-profile" className="text-gray-600 hover:text-gray-900">Profile</Link>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* RSVPs List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">My RSVPs</h2>
        
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {upcomingRsvps.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg mb-4">You haven&apos;t RSVP&apos;d to any upcoming events yet.</p>
            <Link
              href="/events"
              className="inline-block bg-sky-600 text-white px-6 py-2 rounded-lg hover:bg-sky-700 transition"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingRsvps.map((rsvp) => (
              <div
                key={rsvp.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {rsvp.events.title}
                    </h3>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center text-gray-600 text-sm">
                        <Calendar size={16} className="mr-2" />
                        {format(new Date(rsvp.events.event_date), 'MMM d, yyyy • h:mm a')}
                      </div>
                      <div className="flex items-center text-gray-600 text-sm">
                        <MapPin size={16} className="mr-2" />
                        {rsvp.events.location}
                      </div>
                    </div>

                    {rsvp.events.description && (
                      <p className="text-gray-600 text-sm">{rsvp.events.description}</p>
                    )}
                  </div>

                  {(() => {
                    const eventDateTime = new Date(rsvp.events.event_date)
                    const now = new Date()
                    const hoursSinceEvent = (now.getTime() - eventDateTime.getTime()) / (1000 * 60 * 60)
                    const isPast24Hours = hoursSinceEvent > 24
                    const isPast = eventDateTime < now

                    if (isPast24Hours) {
                      return (
                        <div className="ml-4 px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
                          Event Completed
                        </div>
                      )
                    }

                    return (
                      <button
                        onClick={() => handleCancelRsvp(rsvp.event_id, rsvp.events.event_date)}
                        disabled={loading === rsvp.event_id || isPast}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title={isPast ? "Event has passed" : "Cancel RSVP"}
                      >
                        <Trash2 size={20} />
                      </button>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}