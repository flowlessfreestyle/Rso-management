import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import MyRsvpsClient from './my-rsvps-client'

export default async function MyRsvpsPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch user's RSVPs with event details
  const { data: rsvps, error } = await supabase
    .from('rsvps')
    .select(`
      *,
      events(*)
    `)
    .eq('student_id', user.id)
    .order('rsvp_date', { ascending: false })

  if (error) {
    console.error('Error fetching RSVPs:', error)
  }

  return <MyRsvpsClient rsvps={rsvps || []} userId={user.id} />
}