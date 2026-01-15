import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import EventStatsClient from './event-stats-client'

export default async function EventStatsPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch event details
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      rsvps(
        id,
        rsvp_date,
        student_id,
        profiles(name, email, major, year)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !event) {
    redirect('/dashboard')
  }

  return <EventStatsClient event={event} />
}