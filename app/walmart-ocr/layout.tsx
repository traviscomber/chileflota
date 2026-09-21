import Link from 'next/link'
import { BarChart3, CheckCircle2, FileCheck, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function WalmartOCRLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <header className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Link href="/walmart-ocr">
            <p className="text-base font-semibold tracking-tight">ChileFlota</p>
            <p className="mt-1 text-xs text-[var(--cf-text-muted)]">OCR documental</p>
          </Link>

          <nav className="flex gap-1 overflow-x-auto">
            <Link href="/walmart-ocr" className="flex min-h-10 shrink-0 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
              <FileCheck className="h-4 w-4" />
              Cargar
            </Link>
            <Link href="/walmart-ocr/compliance" className="flex min-h-10 shrink-0 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
              <BarChart3 className="h-4 w-4" />
              Compliance
            </Link>
            <Link href="/walmart-ocr/review" className="flex min-h-10 shrink-0 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
              <CheckCircle2 className="h-4 w-4" />
              Revisión
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Home className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
