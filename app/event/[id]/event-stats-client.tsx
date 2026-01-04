'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Calendar, MapPin, Users, Clock, Download, ArrowLeft, QrCode } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
    profiles: {
      name: string
      email: string
    }
  }>
}

export default function EventStatsClient({ event }: { event: Event }) {
  const [sortField, setSortField] = useState<'name' | 'email' | 'rsvp_date'>('rsvp_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSort = (field: 'name' | 'email' | 'rsvp_date') => {
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

    const headers = ['Name', 'Email', 'RSVP Date']
    const rows = sortedRsvps.map(rsvp => [
      rsvp.profiles.name || '',
      rsvp.profiles.email || '',
      format(new Date(rsvp.rsvp_date), 'MMM d, yyyy h:mm a')
    ])

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
  
  const { daysUntilEvent, recentRsvps } = useMemo(() => {
    const now = new Date()
    const eventDate = new Date(event.event_date)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    return {
      daysUntilEvent: differenceInDays(eventDate, now),
      recentRsvps: event.rsvps.filter(r => new Date(r.rsvp_date) > oneDayAgo).length
    }
  }, [event.event_date, event.rsvps])

  // Generate RSVP trend data (group by day)
  const trendData = event.rsvps.reduce((acc, rsvp) => {
    const date = format(new Date(rsvp.rsvp_date), 'MMM d')
    const existing = acc.find(item => item.date === date)
    if (existing) {
      existing.rsvps += 1
    } else {
      acc.push({ date, rsvps: 1 })
    }
    return acc
  }, [] as Array<{ date: string; rsvps: number }>)

  // Sort RSVPs
  const sortedRsvps = [...event.rsvps].sort((a, b) => {
    let aVal, bVal
    
    if (sortField === 'name') {
      aVal = a.profiles.name.toLowerCase()
      bVal = b.profiles.name.toLowerCase()
    } else if (sortField === 'email') {
      aVal = a.profiles.email.toLowerCase()
      bVal = b.profiles.email.toLowerCase()
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
              <Link href="/dashboard" className="text-2xl font-bold text-purple-600 hover:text-purple-700">
                RSO Events
              </Link>
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
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h2>
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
            <p className="text-gray-600 text-sm font-medium">Fill Rate</p>
            <p className={`text-3xl font-bold mt-2 ${fillRate >= 80 ? 'text-green-600' : fillRate >= 50 ? 'text-yellow-600' : 'text-gray-900'}`}>
              {fillRate}%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-medium">Days Until Event</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{daysUntilEvent >= 0 ? daysUntilEvent : 0}</p>
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
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="rsvps" stroke="#9333ea" strokeWidth={2} />
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
              className={`h-6 rounded-full transition-all ${fillRate >= 80 ? 'bg-green-500' : fillRate >= 50 ? 'bg-yellow-500' : 'bg-purple-600'}`}
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
                  className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedRsvps.map((rsvp) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}