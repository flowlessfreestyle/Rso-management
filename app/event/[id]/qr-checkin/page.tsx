import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import QRCheckInClient from './qr-checkin-client'

export default async function QRCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'organization') {
    redirect('/events')
  }

  // Fetch event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (eventError || !event || event.organization_id !== user.id) {
    redirect('/dashboard')
  }

  // Fetch RSVPs and check-ins
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select(`
      *,
      profiles(name, email)
    `)
    .eq('event_id', id)

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('student_id')
    .eq('event_id', id)

  const checkedInIds = new Set(checkIns?.map(c => c.student_id) || [])

  return (
    <QRCheckInClient 
      event={event} 
      rsvpCount={rsvps?.length || 0}
      checkInCount={checkedInIds.size}
    />
  )
}