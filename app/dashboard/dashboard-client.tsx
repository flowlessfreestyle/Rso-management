'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Plus, Calendar, Users, TrendingUp, BarChart3, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import Logo from '@/app/components/Logo'

interface Event {
  id: string
  title: string
  event_date: string
  location: string
  capacity: number
  rsvps: { count: number }[]
}

interface Profile {
  id: string
  organization_name?: string
  name?: string
}

export default function DashboardClient({ profile }: { profile: Profile }) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select(`
          *,
          rsvps(count)
        `)
        .order('event_date', { ascending: true })

      if (!cancelled) {
        setEvents(data || [])
        setLoading(false)
      }
    }

    fetchEvents()
    
    return () => {
      cancelled = true
    }
  }, [supabase, profile.id])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`)) {
      return
    }

    setDeletingEventId(eventId)
    
    try {
      // Delete all related RSVPs first (cascade delete should handle this, but being explicit)
      await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId)

      // Delete check-ins
      await supabase
        .from('check_ins')
        .delete()
        .eq('event_id', eventId)

      // Delete the event
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error

      // Remove from local state
      setEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event. Please try again.')
    } finally {
      setDeletingEventId(null)
    }
  }

  // Calculate stats
  const totalEvents = events.length
  const totalRsvps = events.reduce((sum, event) => sum + (event.rsvps[0]?.count || 0), 0)
  const avgFillRate = totalEvents > 0
    ? Math.round((totalRsvps / events.reduce((sum, e) => sum + e.capacity, 0)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Logo href="/dashboard" />
              <Link href="/dashboard" className="text-gray-900 font-medium">Dashboard</Link>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600 mt-1">Welcome back, {profile?.organization_name}!</p>
          </div>
          <button
            onClick={() => router.push('/create-event')}
            className="flex items-center space-x-2 bg-sky-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-sky-700 transition"
          >
            <Plus size={20} />
            <span>Create Event</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Events</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalEvents}</p>
              </div>
              <div className="bg-sky-100 p-3 rounded-lg">
                <Calendar className="text-sky-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total RSVPs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalRsvps}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Avg Fill Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{avgFillRate}%</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Your Events</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <BarChart3 className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500 mb-4">No events yet. Create your first event!</p>
              <button
                onClick={() => router.push('/create-event')}
                className="inline-flex items-center space-x-2 bg-sky-600 text-white px-6 py-2 rounded-lg hover:bg-sky-700 transition"
              >
                <Plus size={20} />
                <span>Create Event</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => {
                const rsvpCount = event.rsvps[0]?.count || 0
                const fillRate = Math.round((rsvpCount / event.capacity) * 100)

                return (
                  <div
                    key={event.id}
                    className="p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => router.push(`/event/${event.id}`)}
                      >
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">
                          {event.title}
                        </h4>
                        <div className="flex items-center text-sm text-gray-600 space-x-4">
                          <span className="flex items-center">
                            <Calendar size={14} className="mr-1" />
                            {format(new Date(event.event_date), 'MMM d, yyyy • h:mm a')}
                          </span>
                          <span>{event.location}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{rsvpCount}</p>
                          <p className="text-sm text-gray-600">RSVPs</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${fillRate >= 80 ? 'text-green-600' : fillRate >= 50 ? 'text-yellow-600' : 'text-gray-900'}`}>
                            {fillRate}%
                          </p>
                          <p className="text-sm text-gray-600">Fill Rate</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteEvent(event.id, event.title)
                          }}
                          disabled={deletingEventId === event.id}
                          className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          title="Delete event"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}