'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, Users, LogOut } from 'lucide-react'
import { format } from 'date-fns'

interface Event {
  id: string
  title: string
  description: string
  event_date: string
  location: string
  capacity: number
  profiles: { organization_name: string }
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

  const handleRsvp = async (eventId: string) => {
    setLoading(eventId)
    setError('')
    
    try {
      if (userRsvps.has(eventId)) {
        // Cancel RSVP
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/events" className="text-2xl font-bold text-purple-600 hover:text-purple-700">
                RSO Events
              </Link>
              <Link href="/events" className="text-gray-900 font-medium">Events</Link>
              <Link href="/my-rsvps" className="text-gray-600 hover:text-gray-900">My RSVPs</Link>
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

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Upcoming Events</h2>
        
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No upcoming events yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const rsvpCount = event.rsvps[0]?.count || 0
              const isRsvpd = userRsvps.has(event.id)
              const isFull = rsvpCount >= event.capacity

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                    <p className="text-sm text-purple-600 font-medium mb-3">
                      {event.profiles.organization_name}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-gray-600 text-sm">
                        <Calendar size={16} className="mr-2" />
                        {format(new Date(event.event_date), 'MMM d, yyyy • h:mm a')}
                      </div>
                      <div className="flex items-center text-gray-600 text-sm">
                        <MapPin size={16} className="mr-2" />
                        {event.location}
                      </div>
                      <div className="flex items-center text-gray-600 text-sm">
                        <Users size={16} className="mr-2" />
                        <span className={rsvpCount >= event.capacity ? 'text-red-600 font-medium' : ''}>
                          {rsvpCount}/{event.capacity} spots
                        </span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description}</p>
                    )}

                    <button
                      onClick={() => handleRsvp(event.id)}
                      disabled={loading === event.id || (isFull && !isRsvpd)}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition ${
                        isRsvpd
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : isFull
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {loading === event.id ? 'Loading...' : isRsvpd ? 'RSVP\'d ✓' : isFull ? 'Full' : 'RSVP'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}