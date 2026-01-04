import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import EventsClient from './events-client'

export default async function EventsPage() {
  const supabase = await createServerSupabaseClient()
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Redirect organizations to dashboard
  if (profile?.user_type === 'organization') {
    redirect('/dashboard')
  }

  // Fetch all events with RSVP counts
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      profiles!events_organization_id_fkey(organization_name),
      rsvps(count)
    `)
    .order('event_date', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
  }

  return <EventsClient events={events || []} userId={user.id} />
}