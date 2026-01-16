'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, CheckCircle, Users, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

interface Event {
  id: string
  title: string
  event_date: string
  location: string
  capacity: number
}


export default function QRCheckInClient({ 
  event, 
  rsvpCount,
  checkInCount: initialCheckInCount 
}: { 
  event: Event
  rsvpCount: number
  checkInCount: number
}) {
  const [checkInCount, setCheckInCount] = useState(initialCheckInCount)
  const [recentCheckIns, setRecentCheckIns] = useState<Array<{ id: string; name: string; time: Date }>>([])
  const router = useRouter()
  const supabase = createClient()

  // Generate check-in URL
  const [checkInUrl, setCheckInUrl] = useState('')

  useEffect(() => {
    const url = `${window.location.origin}/checkin/${event.id}`
    setTimeout(() => {
      setCheckInUrl(url)
    }, 0)
  }, [event.id])

  useEffect(() => {
    // Fetch initial recent check-ins
    const fetchRecentCheckIns = async () => {
      const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select('id, student_id, check_in_time')
        .eq('event_id', event.id)
        .order('check_in_time', { ascending: false })
        .limit(10)

      if (error) {
        return
      }

      if (checkIns && checkIns.length > 0) {
        // Fetch profile names separately
        const studentIds = checkIns.map(ci => ci.student_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', studentIds)

        const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || [])

        const formattedCheckIns = checkIns.map((ci) => ({
          id: ci.id,
          name: profileMap.get(ci.student_id) || 'Unknown Student',
          time: new Date(ci.check_in_time)
        }))

        setRecentCheckIns(formattedCheckIns)
      } else {
        setRecentCheckIns([])
      }
    }

    fetchRecentCheckIns()

    // Subscribe to new check-ins
    const channel = supabase
      .channel(`check-ins-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'check_ins',
          filter: `event_id=eq.${event.id}`
        },
        async (payload) => {
          setCheckInCount(prev => prev + 1)
          
          // Fetch student name
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', payload.new.student_id)
            .single()

          if (profile) {
            const newCheckIn = {
              id: payload.new.id,
              name: profile.name || 'Unknown Student',
              time: new Date(payload.new.check_in_time)
            }
            
            setRecentCheckIns(prev => [newCheckIn, ...prev.slice(0, 9)])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [event.id, supabase])

  const attendanceRate = rsvpCount > 0 ? Math.round((checkInCount / rsvpCount) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/event/${event.id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Event Stats
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - QR Code */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">QR Code Check-In</h2>
            <p className="text-gray-600 mb-6">Students scan this QR code to check in</p>

            {/* Event Info */}
            <div className="bg-sky-50 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg text-gray-900 mb-2">{event.title}</h3>
              <p className="text-sm text-gray-600">
                {format(new Date(event.event_date), 'EEEE, MMMM d, yyyy • h:mm a')}
              </p>
              <p className="text-sm text-gray-600">{event.location}</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-8 bg-white border-4 border-sky-600 rounded-lg">
            {checkInUrl ? (
                <QRCodeSVG 
                value={checkInUrl}
                size={300}
                level="H"
                includeMargin={true}
                />
            ) : (
                <div className="w-[300px] h-[300px] flex items-center justify-center">
                <div className="text-gray-400">Loading...</div>
                </div>
            )}
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Scan with phone camera or QR reader
            </p>
          </div>

          {/* Right Column - Stats & Activity */}
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <Users className="text-blue-600" size={24} />
                </div>
                <p className="text-gray-600 text-sm">Total RSVPs</p>
                <p className="text-3xl font-bold text-gray-900">{rsvpCount}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
                <p className="text-gray-600 text-sm">Checked In</p>
                <p className="text-3xl font-bold text-green-600">{checkInCount}</p>
              </div>
            </div>

            {/* Attendance Rate */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Attendance Rate</h3>
                <TrendingUp className={attendanceRate >= 70 ? 'text-green-600' : 'text-yellow-600'} size={24} />
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>{checkInCount} of {rsvpCount}</span>
                  <span className="font-semibold">{attendanceRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      attendanceRate >= 70 ? 'bg-green-500' : attendanceRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Recent Check-Ins */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Check-Ins</h3>
              {recentCheckIns.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Waiting for check-ins...
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentCheckIns.map((checkIn) => (
                    <div
                      key={checkIn.id}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 animate-fade-in"
                    >
                      <div className="flex items-center">
                        <CheckCircle className="text-green-600 mr-3" size={20} />
                        <span className="font-medium text-gray-900">{checkIn.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {format(checkIn.time, 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">How to use:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Display this QR code at your event entrance</li>
                <li>Students scan the code with their phone</li>
                <li>They&apos;ll be checked in automatically</li>
                <li>Watch this page for real-time check-ins</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}