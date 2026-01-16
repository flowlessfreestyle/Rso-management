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
  const [checkInProfiles, setCheckInProfiles] = useState<Map<string, { name: string; email: string; major?: string | null; year?: string | null }>>(new Map())
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
        
        // Fetch profiles for all checked-in students
        const studentIds = data.map(ci => ci.student_id)
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email, major, year')
            .in('id', studentIds)
          
          if (profiles) {
            const profileMap = new Map()
            profiles.forEach(profile => {
              profileMap.set(profile.id, {
                name: profile.name || '',
                email: profile.email || '',
                major: profile.major || null,
                year: profile.year || null
              })
            })
            setCheckInProfiles(profileMap)
          }
        }
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
        async (payload) => {
          setCheckIns(prev => [...prev, {
            student_id: payload.new.student_id,
            check_in_time: payload.new.check_in_time
          }])
          setCheckInCount(prev => prev + 1)
          
          // Fetch profile for new check-in
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email, major, year')
            .eq('id', payload.new.student_id)
            .single()
          
          if (profile) {
            setCheckInProfiles(prev => {
              const newMap = new Map(prev)
              newMap.set(profile.id, {
                name: profile.name || '',
                email: profile.email || '',
                major: profile.major || null,
                year: profile.year || null
              })
              return newMap
            })
          }
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

  const exportCSV = async () => {
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    // Get all checked-in student IDs
    const checkedInStudentIds = new Set(checkIns.map(ci => ci.student_id))
    
    // Get RSVP map for quick lookup
    const rsvpMap = new Map<string, { rsvp_date: string; profiles: { name: string; email: string; major?: string | null; year?: string | null } }>()
    event.rsvps.forEach(rsvp => {
      rsvpMap.set(rsvp.student_id, rsvp)
    })

    const headers = ['Name', 'Email', 'Major', 'Year', 'RSVP Date', 'Check-In Time', 'Attended']
    const rows: string[][] = []

    // Add all checked-in students (including those without RSVPs)
    for (const checkIn of checkIns) {
      const checkInTime = checkIn.check_in_time
      const profile = checkInProfiles.get(checkIn.student_id)
      const rsvp = rsvpMap.get(checkIn.student_id)
      
      if (profile) {
        rows.push([
          profile.name || '',
          profile.email || '',
          profile.major || '',
          profile.year || '',
          rsvp ? format(new Date(rsvp.rsvp_date), 'MMM d, yyyy h:mm a') : '-',
          format(new Date(checkInTime), 'MMM d, yyyy h:mm a'),
          'Yes'
        ])
      }
    }

    // Add RSVPs that haven't checked in yet
    event.rsvps.forEach(rsvp => {
      if (!checkedInStudentIds.has(rsvp.student_id)) {
        rows.push([
          rsvp.profiles.name || '',
          rsvp.profiles.email || '',
          rsvp.profiles.major || '',
          rsvp.profiles.year || '',
          format(new Date(rsvp.rsvp_date), 'MMM d, yyyy h:mm a'),
          '-',
          'No'
        ])
      }
    })

    // Sort rows by check-in time (checked-in first, then by RSVP date)
    rows.sort((a, b) => {
      const aCheckedIn = a[6] === 'Yes'
      const bCheckedIn = b[6] === 'Yes'
      if (aCheckedIn && !bCheckedIn) return -1
      if (!aCheckedIn && bCheckedIn) return 1
      if (aCheckedIn && bCheckedIn) {
        // Both checked in, sort by check-in time
        const aTime = a[5] !== '-' ? new Date(a[5]).getTime() : 0
        const bTime = b[5] !== '-' ? new Date(b[5]).getTime() : 0
        return bTime - aTime
      }
      // Neither checked in, sort by RSVP date
      const aRsvp = a[4] !== '-' ? new Date(a[4]).getTime() : 0
      const bRsvp = b[4] !== '-' ? new Date(b[4]).getTime() : 0
      return bRsvp - aRsvp
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

  // Calculate stats - use check-in count for capacity if higher than RSVP count
  const rsvpCount = event.rsvps.length
  const actualAttendance = Math.max(rsvpCount, checkInCount) // Use check-ins if higher
  const fillRate = Math.round((actualAttendance / event.capacity) * 100)
  
  // Calculate attendance rate: RSVP'd students who checked in / total RSVPs
  const rsvpStudentsWhoCheckedIn = event.rsvps.filter(rsvp => checkInMap.has(rsvp.student_id)).length
  const attendanceRate = rsvpCount > 0 ? Math.round((rsvpStudentsWhoCheckedIn / rsvpCount) * 100) : 0
  
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

  // Create combined attendees list (RSVPs + check-ins without RSVPs)
  const attendeesList = useMemo(() => {
    const rsvpMap = new Map<string, typeof event.rsvps[0]>()
    event.rsvps.forEach(rsvp => {
      rsvpMap.set(rsvp.student_id, rsvp)
    })

    const attendees: Array<{
      student_id: string
      name: string
      email: string
      major?: string | null
      year?: string | null
      rsvp_date?: string
      rsvp_id?: string
      check_in_time?: string
      hasRsvp: boolean
      hasCheckIn: boolean
    }> = []

    // Add all RSVPs
    event.rsvps.forEach(rsvp => {
      const checkInTime = checkInMap.get(rsvp.student_id)
      attendees.push({
        student_id: rsvp.student_id,
        name: rsvp.profiles.name || '',
        email: rsvp.profiles.email || '',
        major: rsvp.profiles.major || null,
        year: rsvp.profiles.year || null,
        rsvp_date: rsvp.rsvp_date,
        rsvp_id: rsvp.id,
        check_in_time: checkInTime,
        hasRsvp: true,
        hasCheckIn: !!checkInTime
      })
    })

    // Add check-ins that don't have RSVPs
    checkIns.forEach(checkIn => {
      if (!rsvpMap.has(checkIn.student_id)) {
        const profile = checkInProfiles.get(checkIn.student_id)
        if (profile) {
          attendees.push({
            student_id: checkIn.student_id,
            name: profile.name || '',
            email: profile.email || '',
            major: profile.major || null,
            year: profile.year || null,
            check_in_time: checkIn.check_in_time,
            hasRsvp: false,
            hasCheckIn: true
          })
        }
      }
    })

    return attendees
  }, [event.rsvps, checkIns, checkInMap, checkInProfiles])

  // Sort attendees
  const sortedAttendees = [...attendeesList].sort((a, b) => {
    let aVal, bVal
    
    if (sortField === 'name') {
      aVal = a.name.toLowerCase()
      bVal = b.name.toLowerCase()
    } else if (sortField === 'email') {
      aVal = a.email.toLowerCase()
      bVal = b.email.toLowerCase()
    } else if (sortField === 'check_in') {
      aVal = a.hasCheckIn ? 1 : 0
      bVal = b.hasCheckIn ? 1 : 0
    } else {
      // RSVP date - use check-in time if no RSVP date
      aVal = a.rsvp_date ? new Date(a.rsvp_date).getTime() : (a.check_in_time ? new Date(a.check_in_time).getTime() : 0)
      bVal = b.rsvp_date ? new Date(b.rsvp_date).getTime() : (b.check_in_time ? new Date(b.check_in_time).getTime() : 0)
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
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Logo href="/dashboard" />
              <Link href="/dashboard" className="hidden sm:block text-gray-600 hover:text-gray-900">Dashboard</Link>
              <Link href="/create-event" className="hidden md:block text-gray-600 hover:text-gray-900">Create Event</Link>
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
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{event.title}</h2>
            <button
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
            >
              <Trash2 size={18} />
              <span>{isDeleting ? 'Deleting...' : 'Delete Event'}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm sm:text-base text-gray-600">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6">
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
            <span className="text-lg font-semibold text-gray-700">{actualAttendance} / {event.capacity}</span>
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
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Attendee List ({actualAttendance})</h3>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={() => router.push(`/event/${event.id}/qr-checkin`)}
                className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm sm:text-base"
              >
                <QrCode size={18} />
                <span>QR Check-In</span>
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center justify-center space-x-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition text-sm sm:text-base"
              >
                <Download size={18} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {actualAttendance === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No attendees yet. Share your event to get attendees!
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden sm:table-cell"
                      onClick={() => handleSort('rsvp_date')}
                    >
                      RSVP Date {sortField === 'rsvp_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('check_in')}
                    >
                      Attended {sortField === 'check_in' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedAttendees.map((attendee) => {
                    return (
                      <tr key={attendee.rsvp_id || attendee.student_id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {attendee.name}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                          <span className="break-all">{attendee.email}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 hidden sm:table-cell">
                          {attendee.rsvp_date ? format(new Date(attendee.rsvp_date), 'MMM d, yyyy h:mm a') : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm">
                          {attendee.hasCheckIn && attendee.check_in_time ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle size={20} className="mr-2" />
                              <span className="hidden sm:inline">{format(new Date(attendee.check_in_time), 'MMM d, h:mm a')}</span>
                              <span className="sm:hidden">{format(new Date(attendee.check_in_time), 'h:mm a')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-gray-400">
                              <XCircle size={9} className="mr-2" />
                              <span className="hidden sm:inline">Not checked in</span>
                              <span className="sm:hidden">No</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm">
                          {attendee.hasRsvp ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              RSVP
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Walk-in
                            </span>
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