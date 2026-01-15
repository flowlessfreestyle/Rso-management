import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import StudentProfileClient from './student-profile-client'

export default async function ProfilePage() {
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

  // Only students can access this page
  if (profile?.user_type !== 'student') {
    redirect('/dashboard')
  }

  return <StudentProfileClient profile={profile} />
}