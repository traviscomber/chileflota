'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  LogOut,
  Zap,
  Users2,
  Activity,
  TrendingUp,
  Settings,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { CompanyHeader } from '@/components/layout/company-header'

const navGroups = [
  {
    label: 'Operación',
    items: [
      { href: '/dashboard/company', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/company/subcontratistas', label: 'Subcontratistas', icon: Zap },
      { href: '/dashboard/company/conductores', label: 'Conductores', icon: Users },
      { href: '/dashboard/company/documentos', label: 'Documentos', icon: FileText },
    ],
  },
  {
    label: 'Inteligencia',
    items: [
      { href: '/dashboard/company/compliance', label: 'Compliance Matrix', icon: Shield },
      { href: '/dashboard/company/analytics/conductores', label: 'Analytics', icon: TrendingUp },
      { href: '/dashboard/company/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/dashboard/company/metrics', label: 'Impacto Operacional', icon: Activity },
    ],
  },
  {
    label: 'Administración',
    items: [
      { href: '/dashboard/company/equipo', label: 'Gestión de Equipo', icon: Users2 },
    ],
  },
]

const accountItems = [
  { href: '/dashboard/company/perfil', label: 'Mi Perfil', icon: Settings },
]

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const mainRef = useRef<HTMLElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userEmail = document.cookie
      .split('; ')
      .find(row => row.startsWith('user_email='))
      ?.split('=')[1]

    if (userEmail) {
      setHasAccess(true)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!isLoading && !hasAccess) {
      router.push('/login')
    }
  }, [isLoading, hasAccess, router])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    setSidebarOpen(false)
  }, [pathname])

  if (isLoading || !hasAccess) {
    return null
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const SidebarContent = () => (
    <>
      <div className="border-b border-[var(--cf-line)] px-4 py-5 md:px-5">
        <p className="text-lg font-medium tracking-tight text-[var(--cf-text)]">ChileFlota</p>
        <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Transportes Labbé</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex === 0 ? '' : 'mt-5'}>
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard/company' && pathname.startsWith(`${item.href}/`))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-normal transition-colors',
                      isActive
                        ? 'bg-[var(--cf-burgundy)] text-[var(--cf-text)]'
                        : 'text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)]'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-[var(--cf-line)] p-3">
        {accountItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-10 w-full items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-normal transition-colors',
                isActive
                  ? 'bg-[var(--cf-burgundy)] text-[var(--cf-text)]'
                  : 'text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)]'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <Button
          variant="ghost"
          size="sm"
          className="min-h-10 w-full justify-start rounded-[5px] px-3 text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-2)] hover:text-[var(--cf-text)]"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-4 w-4 flex-shrink-0" />
          Cerrar Sesión
        </Button>
      </div>
    </>
  )

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="flex h-screen flex-col bg-[var(--cf-bg)] md:flex-row">
        <aside className="hidden w-56 flex-col border-r border-[var(--cf-line)] bg-[var(--cf-sidebar)] md:flex">
          <SidebarContent />
        </aside>

        <SheetContent
          side="left"
          className="w-[min(82vw,288px)] border-r border-[var(--cf-line)] bg-[var(--cf-sidebar)] p-0 text-[var(--cf-text)]"
        >
          <div className="flex h-full flex-col">
            <SidebarContent />
          </div>
        </SheetContent>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <CompanyHeader onMenuClick={() => setSidebarOpen(true)} />

          <main
            ref={mainRef}
            data-company-main
            className="min-w-0 flex-1 overflow-auto bg-[var(--cf-bg)] p-4 sm:p-5 lg:p-6"
          >
            {children}
          </main>
        </div>
      </div>
    </Sheet>
  )
}
