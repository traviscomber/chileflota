'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [hasSimpleLogin, setHasSimpleLogin] = useState(false)
  const [cookieCheckDone, setCookieCheckDone] = useState(false)

  useEffect(() => {
    // Check if user has a simple email login (from /login endpoint, not Supabase Auth)
    const userEmail = document.cookie
      .split('; ')
      .find(row => row.startsWith('user_email='))
      ?.split('=')[1]
    
    if (userEmail) {
      setHasSimpleLogin(true)
    }
    setCookieCheckDone(true)
  }, [])

  useEffect(() => {
    // Only redirect after we've checked the cookie AND loading is done
    if (cookieCheckDone && !loading && !user && !hasSimpleLogin) {
      router.replace('/login')
    }
  }, [user, loading, hasSimpleLogin, cookieCheckDone, router])

  if (loading || !cookieCheckDone) {
    return (
      <div className="min-h-screen bg-[var(--cf-canvas)] flex items-center justify-center">
        <div className="text-[var(--cf-text-muted)] text-sm">Cargando...</div>
      </div>
    )
  }

  // Allow access if user has Supabase Auth OR simple email login
  if (!user && !hasSimpleLogin) {
    return null
  }

  // If this is a /dashboard/company route, let its own layout handle everything
  // (CompanyLayout will render its own sidebar and layout)
  if (pathname.startsWith('/dashboard/company')) {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)]">
      <DashboardSidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

