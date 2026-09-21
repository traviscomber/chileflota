'use client'

import { FileText, Home, Settings, Clock } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/conductor", label: "Inicio", icon: Home },
  { href: "/conductor/documentos", label: "Documentos", icon: FileText },
  { href: "/conductor/perfil", label: "Mi perfil", icon: Settings },
  { href: "/conductor/onboarding", label: "Guía de inicio", icon: Clock },
]

export default function ConductorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)] md:flex">
      <aside className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] md:fixed md:inset-y-0 md:left-0 md:w-52 md:border-b-0 md:border-r">
        <div className="border-b border-[var(--cf-border)] px-4 py-4 md:px-5 md:py-5">
          <p className="text-base font-semibold tracking-tight text-[var(--cf-text)]">ChileFlota</p>
          <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Transportes Labbé · Conductor</p>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:block md:space-y-1 md:overflow-visible md:py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== "/conductor" && pathname.startsWith(`${item.href}/`))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--cf-accent)] text-[var(--cf-text)]"
                    : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="hidden border-t border-[var(--cf-border)] p-4 md:absolute md:inset-x-0 md:bottom-0 md:block">
          <p className="text-xs font-medium text-[var(--cf-text-secondary)]">Soporte</p>
          <p className="mt-1 text-xs text-[var(--cf-text-muted)]">soporte@labbe.cl</p>
          <p className="mt-1 text-xs text-[var(--cf-text-muted)]">+56 9 7776 4753</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:ml-52">
        <header className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-4 md:px-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--cf-text)]">Portal de Conductores</h1>
          <p className="mt-1 text-sm text-[var(--cf-text-muted)]">Documentación y cumplimiento</p>
        </header>

        <main className="min-h-[calc(100vh-73px)] bg-[var(--cf-canvas)] p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
