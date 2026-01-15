import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import OrganizationsClient from './organizations-client'

export default async function OrganizationsPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch all organizations
  const { data: organizations } = await supabase
    .from('profiles')
    .select('id, organization_name, bio, profile_image_url')
    .eq('user_type', 'organization')
    .not('organization_name', 'is', null)
    .order('organization_name', { ascending: true })

  return <OrganizationsClient organizations={organizations || []} />
}

