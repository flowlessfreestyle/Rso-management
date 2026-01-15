'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Calendar, MapPin, Users, Clock, Download, ArrowLeft, QrCode, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import Logo from '@/app/components/Logo'

interface Event {
  id: string
  title: string
  description: string
  event_date: string
  location: string
  capacity: number
  created_at: string
  rsvps: Array<{
    id: string
    rsvp_date: string
    student_id: string
    profiles: {
      name: string
      email: string
      major?: string | null
      year?: string | null
    }
  }>
}

interface CheckIn {
  student_id: string
  check_in_time: string
}

export default function EventStatsClient({ event }: { event: Event }) {
  const [sortField, setSortField] = useState<'name' | 'email' | 'rsvp_date' | 'check_in'>('rsvp_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [checkInCount, setCheckInCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Fetch check-ins and subscribe to real-time updates
  useEffect(() => {
    const fetchCheckIns = async () => {
      const { data, error } = await supabase
        .from('check_ins')
        .select('student_id, check_in_time')
        .eq('event_id', event.id)

      if (!error && data) {
        setCheckIns(data)
        setCheckInCount(data.length)
      }
    }

    fetchCheckIns()

    // Subscribe to new check-ins
    const channel = supabase
      .channel(`event-check-ins-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'check_ins',
          filter: `event_id=eq.${event.id}`
        },
        (payload) => {
          setCheckIns(prev => [...prev, {
            student_id: payload.new.student_id,
            check_in_time: payload.new.check_in_time
          }])
          setCheckInCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [event.id, supabase])

  // Create a map of check-ins for quick lookup
  const checkInMap = useMemo(() => {
    const map = new Map<string, string>()
    checkIns.forEach(ci => {
      map.set(ci.student_id, ci.check_in_time)
    })
    return map
  }, [checkIns])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteEvent = async () => {
    if (!confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    
    try {
      // Delete all related RSVPs first
      await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', event.id)

      // Delete check-ins
      await supabase
        .from('check_ins')
        .delete()
        .eq('event_id', event.id)

      // Delete the event
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id)

      if (error) throw error

      // Redirect to dashboard after successful deletion
      router.push('/dashboard')
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event. Please try again.')
      setIsDeleting(false)
    }
  }

  const handleSort = (field: 'name' | 'email' | 'rsvp_date' | 'check_in') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const exportCSV = () => {
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const headers = ['Name', 'Email', 'Major', 'Year', 'RSVP Date', 'Check-In Time', 'Attended']
    const rows = sortedRsvps.map(rsvp => {
      const checkInTime = checkInMap.get(rsvp.student_id)
      return [
        rsvp.profiles.name || '',
        rsvp.profiles.email || '',
        rsvp.profiles.major || '',
        rsvp.profiles.year || '',
        format(new Date(rsvp.rsvp_date), 'MMM d, yyyy h:mm a'),
        checkInTime ? format(new Date(checkInTime), 'MMM d, yyyy h:mm a') : '-',
        checkInTime ? 'Yes' : 'No'
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => escapeCSV(String(cell))).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}_attendees.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Calculate stats
  const rsvpCount = event.rsvps.length
  const fillRate = Math.round((rsvpCount / event.capacity) * 100)
  const attendanceRate = rsvpCount > 0 ? Math.round((checkInCount / rsvpCount) * 100) : 0
  
  const { daysUntilEvent, recentRsvps } = useMemo(() => {
    const now = new Date()
    const eventDate = new Date(event.event_date)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    return {
      daysUntilEvent: differenceInDays(eventDate, now),
      recentRsvps: event.rsvps.filter(r => new Date(r.rsvp_date) > oneDayAgo).length
    }
  }, [event.event_date, event.rsvps])

  // Generate RSVP trend data (cumulative count by day)
  const trendData = useMemo(() => {
    if (event.rsvps.length === 0) return []
    
    // Sort RSVPs by date
    const sorted = [...event.rsvps].sort((a, b) => 
      new Date(a.rsvp_date).getTime() - new Date(b.rsvp_date).getTime()
    )
    
    // Get date range from event creation to event date (or today if event hasn't happened)
    const startDate = new Date(event.created_at)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(event.event_date)
    endDate.setHours(23, 59, 59, 999)
    const now = new Date()
    const chartEndDate = endDate > now ? now : endDate
    chartEndDate.setHours(23, 59, 59, 999)
    
    // Generate all dates in the range
    const dates: Date[] = []
    const currentDate = new Date(startDate)
    
    while (currentDate <= chartEndDate) {
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Calculate cumulative RSVP count for each date
    return dates.map(date => {
      // Count RSVPs that occurred on or before this date
      const cumulativeCount = sorted.filter(rsvp => {
        const rsvpDate = new Date(rsvp.rsvp_date)
        rsvpDate.setHours(0, 0, 0, 0)
        return rsvpDate <= date
      }).length
      
      return {
        date: format(date, 'MMM d'),
        rsvps: cumulativeCount
      }
    })
  }, [event.rsvps, event.created_at, event.event_date])

  // Sort RSVPs
  const sortedRsvps = [...event.rsvps].sort((a, b) => {
    let aVal, bVal
    
    if (sortField === 'name') {
      aVal = a.profiles.name.toLowerCase()
      bVal = b.profiles.name.toLowerCase()
    } else if (sortField === 'email') {
      aVal = a.profiles.email.toLowerCase()
      bVal = b.profiles.email.toLowerCase()
    } else if (sortField === 'check_in') {
      aVal = checkInMap.has(a.student_id) ? 1 : 0
      bVal = checkInMap.has(b.student_id) ? 1 : 0
    } else {
      aVal = new Date(a.rsvp_date).getTime()
      bVal = new Date(b.rsvp_date).getTime()
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Logo href="/dashboard" />
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
              <Link href="/create-event" className="text-gray-600 hover:text-gray-900">Create Event</Link>
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
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Dashboard
        </button>

        {/* Event Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-3xl font-bold text-gray-900">{event.title}</h2>
            <button
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              <Trash2 size={18} />
              <span>{isDeleting ? 'Deleting...' : 'Delete Event'}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
            <div className="flex items-center">
              <Calendar size={20} className="mr-3" />
              {format(new Date(event.event_date), 'EEEE, MMMM d, yyyy • h:mm a')}
            </div>
            <div className="flex items-center">
              <MapPin size={20} className="mr-3" />
              {event.location}
            </div>
            <div className="flex items-center">
              <Users size={20} className="mr-3" />
              Capacity: {event.capacity} people
            </div>
            <div className="flex items-center">
              <Clock size={20} className="mr-3" />
              {daysUntilEvent > 0 ? `${daysUntilEvent} days until event` : daysUntilEvent === 0 ? 'Event is today!' : 'Event has passed'}
            </div>
          </div>
          {event.description && (
            <p className="mt-4 text-gray-700">{event.description}</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-medium">Total RSVPs</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{rsvpCount}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-medium">Checked In</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{checkInCount}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-medium">Attendance Rate</p>
            <p className={`text-3xl font-bold mt-2 ${attendanceRate >= 70 ? 'text-green-600' : attendanceRate >= 40 ? 'text-yellow-600' : 'text-gray-900'}`}>
              {attendanceRate}%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-medium">RSVPs Last 24h</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{recentRsvps}</p>
          </div>
        </div>

        {/* RSVP Trend Chart */}
        {trendData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">RSVP Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, event.capacity]} />
                <Tooltip />
                <ReferenceLine 
                  y={event.capacity} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label={{ value: 'Capacity', position: 'right', fill: '#ef4444' }}
                />
                <Line type="monotone" dataKey="rsvps" stroke="#0284c7" strokeWidth={2} name="RSVPs" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Capacity Progress */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold text-gray-900">Capacity</h3>
            <span className="text-lg font-semibold text-gray-700">{rsvpCount} / {event.capacity}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-6">
            <div
              className={`h-6 rounded-full transition-all ${fillRate >= 80 ? 'bg-green-500' : fillRate >= 50 ? 'bg-yellow-500' : 'bg-sky-600'}`}
              style={{ width: `${Math.min(fillRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Attendee List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900">Attendee List ({rsvpCount})</h3>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push(`/event/${event.id}/qr-checkin`)}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                <QrCode size={18} />
                <span>QR Check-In</span>
              </button>
              {rsvpCount > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center space-x-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition"
                >
                  <Download size={18} />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {rsvpCount === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No RSVPs yet. Share your event to get attendees!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('rsvp_date')}
                    >
                      RSVP Date {sortField === 'rsvp_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('check_in')}
                    >
                      Attended {sortField === 'check_in' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedRsvps.map((rsvp) => {
                    const checkInTime = checkInMap.get(rsvp.student_id)
                    return (
                      <tr key={rsvp.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rsvp.profiles.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {rsvp.profiles.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {format(new Date(rsvp.rsvp_date), 'MMM d, yyyy h:mm a')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {checkInTime ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle size={16} className="mr-2" />
                              <span>{format(new Date(checkInTime), 'MMM d, h:mm a')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-gray-400">
                              <XCircle size={16} className="mr-2" />
                              <span>Not checked in</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}