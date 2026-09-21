'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CheckCircle2, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/ocr', label: 'Procesar', icon: ScanLine, exact: true },
  { href: '/ocr/compliance', label: 'Compliance', icon: BarChart3, exact: false },
  { href: '/ocr/review', label: 'Revisión', icon: CheckCircle2, exact: false },
]

export default function OCRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <header className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Link href="/ocr">
            <p className="text-base font-semibold tracking-tight">ChileFlota</p>
            <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Operación OCR</p>
          </Link>

          <nav className="flex gap-1 overflow-x-auto">
            {navLinks.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex min-h-10 shrink-0 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--cf-accent)] text-[var(--cf-text)]'
                      : 'text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
