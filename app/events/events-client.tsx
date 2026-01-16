'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, Users, LogOut } from 'lucide-react'
import { format } from 'date-fns'
import Logo from '@/app/components/Logo'

interface Event {
  id: string
  title: string
  description: string
  event_date: string
  location: string
  capacity: number
  rsvps: { count: number }[]
}

export default function EventsClient({ events, userId }: { events: Event[], userId: string }) {
  const [userRsvps, setUserRsvps] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const fetchUserRsvps = useCallback(async () => {
    const { data } = await supabase
      .from('rsvps')
      .select('event_id')
      .eq('student_id', userId)

    if (data) {
      setUserRsvps(new Set(data.map(r => r.event_id)))
    }
  }, [supabase, userId])

  useEffect(() => {
    fetchUserRsvps()
  }, [fetchUserRsvps])

  const handleRsvp = async (eventId: string, eventDate: string) => {
    setLoading(eventId)
    setError('')
    
    try {
      if (userRsvps.has(eventId)) {
        // Cancel RSVP - check if event is more than 24 hours past
        const eventDateTime = new Date(eventDate)
        const now = new Date()
        const hoursSinceEvent = (now.getTime() - eventDateTime.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceEvent > 24) {
          setError('Cannot cancel RSVP for events that occurred more than 24 hours ago.')
          setLoading(null)
          return
        }

        const { error: deleteError } = await supabase
          .from('rsvps')
          .delete()
          .eq('event_id', eventId)
          .eq('student_id', userId)
        
        if (deleteError) throw deleteError
        
        setUserRsvps(prev => {
          const newSet = new Set(prev)
          newSet.delete(eventId)
          return newSet
        })
      } else {
        // Create RSVP
        const { error: insertError } = await supabase
          .from('rsvps')
          .insert({ event_id: eventId, student_id: userId })
        
        if (insertError) throw insertError
        
        setUserRsvps(prev => new Set(prev).add(eventId))
      }
      
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update RSVP')
    } finally {
      setLoading(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Split events into upcoming and past
  const now = new Date()
  const upcomingEvents = events.filter(event => new Date(event.event_date) >= now)
  const pastEvents = events.filter(event => new Date(event.event_date) < now)

  const renderEventCard = (event: Event, isPast: boolean = false) => {
    const rsvpCount = event.rsvps[0]?.count || 0
    const isRsvpd = userRsvps.has(event.id)
    const isFull = rsvpCount >= event.capacity

    return (
      <div
        key={event.id}
        className={`bg-white rounded-lg shadow-md overflow-hidden ${
          isPast 
            ? 'opacity-60 grayscale' 
            : 'hover:shadow-lg transition-shadow'
        }`}
      >
        <div className="p-4 sm:p-6">
          <h3 className={`text-lg sm:text-xl font-bold mb-2 ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>
            {event.title}
          </h3>
          
          <div className="space-y-2 mb-4">
            <div className={`flex items-center text-xs sm:text-sm ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <Calendar size={14} className="mr-2 flex-shrink-0" />
              <span className="break-words">{format(new Date(event.event_date), 'MMM d, yyyy • h:mm a')}</span>
            </div>
            <div className={`flex items-center text-xs sm:text-sm ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <MapPin size={14} className="mr-2 flex-shrink-0" />
              <span className="break-words">{event.location}</span>
            </div>
            <div className={`flex items-center text-xs sm:text-sm ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <Users size={14} className="mr-2 flex-shrink-0" />
              <span className={!isPast && rsvpCount >= event.capacity ? 'text-red-600 font-medium' : ''}>
                {rsvpCount}/{event.capacity} spots
              </span>
            </div>
          </div>

          {event.description && (
            <p className={`text-xs sm:text-sm mb-4 line-clamp-2 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              {event.description}
            </p>
          )}

          {!isPast && (
            <button
              onClick={() => handleRsvp(event.id, event.event_date)}
              disabled={loading === event.id || (isFull && !isRsvpd)}
              className={`w-full py-2.5 sm:py-2 px-4 rounded-lg font-medium text-sm sm:text-base transition ${
                isRsvpd
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : isFull
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {loading === event.id ? 'Loading...' : isRsvpd ? 'RSVP\'d ✓' : isFull ? 'Full' : 'RSVP'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Logo href="/events" />
              <Link href="/events" className="hidden sm:block text-gray-900 font-medium">Events</Link>
              <Link href="/my-rsvps" className="hidden md:block text-gray-600 hover:text-gray-900">My RSVPs</Link>
              <Link href="/profiles/student-profile" className="hidden md:block text-gray-600 hover:text-gray-900">Profile</Link>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        
        {/* Upcoming Events Section */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Upcoming Events</h2>
          
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No upcoming events yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map(event => renderEventCard(event, false))}
            </div>
          )}
        </div>

        {/* Past Events Section */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Past Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map(event => renderEventCard(event, true))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}