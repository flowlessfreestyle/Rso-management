import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CheckInClient from './checkin-client'

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect(`/login?redirect=/checkin/${eventId}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Organizations can't check in
  if (profile?.user_type === 'organization') {
    redirect('/dashboard')
  }

  // Fetch event details
  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      profiles!events_organization_id_fkey(organization_name)
    `)
    .eq('id', eventId)
    .single()

  if (!event) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Event Not Found</h1>
        <p className="text-gray-600 mt-2">This event doesn&apos;t exist.</p>
      </div>
    </div>
  }

  // Check if user has RSVP'd
  const { data: rsvp } = await supabase
    .from('rsvps')
    .select('*')
    .eq('event_id', eventId)
    .eq('student_id', user.id)
    .single()

  // Check if already checked in
  const { data: existingCheckIn } = await supabase
    .from('check_ins')
    .select('*')
            .eq('event_id', eventId)
    .eq('student_id', user.id)
    .single()

  return (
    <CheckInClient 
      event={event}
      userId={user.id}
      hasRsvp={!!rsvp}
      alreadyCheckedIn={!!existingCheckIn}
    />
  )
}