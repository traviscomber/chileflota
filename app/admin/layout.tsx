"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, BarChart3, FileSearch, FileText, LayoutDashboard, LogOut, Shield, SquareStack, UsersIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuarios", icon: UsersIcon },
  { href: "/admin/documentos", label: "Documentos", icon: FileText },
  { href: "/admin/ocr", label: "OCR", icon: FileSearch },
  { href: "/admin/cronos", label: "Cronos", icon: Activity },
  { href: "/compliance", label: "Compliance", icon: SquareStack },
  { href: "/admin/roles", label: "Roles y permisos", icon: Shield },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
]

const titles: Array<[string, string, string]> = [
  ["/admin/usuarios", "Usuarios", "Gestión de accesos y perfiles"],
  ["/admin/documentos", "Documentos", "Revisión y control documental"],
  ["/admin/ocr", "Operación OCR", "Procesamiento y revisión humana"],
  ["/admin/cronos", "Cronos", "Sincronizaciones y salud operativa"],
  ["/compliance", "Compliance", "Matriz ejecutiva de cumplimiento"],
  ["/admin/roles", "Roles y permisos", "Gobierno de acceso"],
  ["/admin/reportes", "Reportes", "Análisis y exportación"],
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const match = titles.find(([prefix]) => pathname.startsWith(prefix))
  const pageTitle = match?.[1] || "Administración"
  const pageSubtitle = match?.[2] || "Resumen general del sistema"

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)] md:flex">
      <aside className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] md:fixed md:inset-y-0 md:left-0 md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-[var(--cf-border)] px-4 py-4 md:px-5">
          <p className="text-base font-semibold tracking-tight text-[var(--cf-text)]">ChileFlota</p>
          <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Administración</p>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:block md:space-y-1 md:overflow-visible md:py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
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

        <div className="hidden border-t border-[var(--cf-border)] p-3 md:absolute md:inset-x-0 md:bottom-0 md:block">
          <button className="flex min-h-10 w-full items-center gap-2 rounded-[5px] px-3 py-2 text-sm text-[var(--cf-text-muted)] transition-colors hover:bg-[var(--cf-danger-soft)] hover:text-[var(--cf-danger)]">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:ml-56">
        <header className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-4 md:px-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--cf-text)]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-[var(--cf-text-muted)]">{pageSubtitle}</p>
        </header>
        <main className="min-h-[calc(100vh-73px)] bg-[var(--cf-canvas)] p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
