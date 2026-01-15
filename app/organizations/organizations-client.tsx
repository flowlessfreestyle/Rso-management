'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Building2, ExternalLink } from 'lucide-react'
import Logo from '@/app/components/Logo'

interface Organization {
  id: string
  organization_name: string
  bio: string | null
  profile_image_url: string | null
}

export default function OrganizationsClient({ organizations }: { organizations: Organization[] }) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Logo href="/events" />
              <Link href="/events" className="text-gray-600 hover:text-gray-900">Events</Link>
              <Link href="/my-rsvps" className="text-gray-600 hover:text-gray-900">My RSVPs</Link>
              <Link href="/organizations" className="text-gray-900 font-medium">Organizations</Link>
              <Link href="/profiles/student-profile" className="text-gray-600 hover:text-gray-900">Profile</Link>
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

      {/* Organizations List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Organizations</h2>
        
        {organizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">No organizations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {org.profile_image_url ? (
                      <img
                        src={org.profile_image_url}
                        alt={org.organization_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 mr-4"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mr-4">
                        <Building2 size={24} className="text-gray-400" />
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-900">{org.organization_name}</h3>
                  </div>
                  
                  {org.bio && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{org.bio}</p>
                  )}
                  
                  <Link
                    href={`/organizations/${org.id}`}
                    className="inline-flex items-center space-x-2 text-sky-600 hover:text-sky-700 font-medium"
                  >
                    <span>View Profile</span>
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

