"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, BarChart3, FileText, Home, LogOut, Menu, Settings, Shield, Truck, Users, X } from "lucide-react"
import { useRole } from "@/app/providers"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: string[]
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useRole()
  const role = user?.role
  const pathname = usePathname()
  const router = useRouter()

  const navItems: NavItem[] = [
    {
      label: "Inicio",
      href: role === "admin" ? "/admin" : role === "mandante" ? "/mandante" : role === "transportista" ? "/transportista" : "/conductor",
      icon: <Home className="h-4 w-4" />,
      roles: ["admin", "mandante", "transportista", "conductor"],
    },
    { label: "Mandantes", href: "/admin/mandantes", icon: <Users className="h-4 w-4" />, roles: ["admin"] },
    { label: "Transportistas", href: "/admin/transportistas", icon: <Truck className="h-4 w-4" />, roles: ["admin"] },
    { label: "Conductores", href: "/admin/conductores", icon: <Users className="h-4 w-4" />, roles: ["admin"] },
    { label: "Vehículos", href: "/admin/vehiculos", icon: <Truck className="h-4 w-4" />, roles: ["admin"] },
    { label: "Documentos", href: "/admin/documentos", icon: <FileText className="h-4 w-4" />, roles: ["admin"] },
    { label: "Roles y permisos", href: "/admin/roles", icon: <Shield className="h-4 w-4" />, roles: ["admin"] },
    { label: "Reportes", href: "/admin/reportes", icon: <BarChart3 className="h-4 w-4" />, roles: ["admin"] },
    { label: "Compliance", href: "/compliance", icon: <Shield className="h-4 w-4" />, roles: ["admin", "mandante", "executive"] },
    { label: "Transportistas", href: "/mandante/transportistas", icon: <Truck className="h-4 w-4" />, roles: ["mandante"] },
    { label: "Alertas", href: "/mandante/alertas", icon: <AlertTriangle className="h-4 w-4" />, roles: ["mandante"] },
    { label: "Reportes", href: "/mandante/reportes", icon: <BarChart3 className="h-4 w-4" />, roles: ["mandante"] },
    { label: "Conductores", href: "/transportista/conductores", icon: <Users className="h-4 w-4" />, roles: ["transportista"] },
    { label: "Vehículos", href: "/transportista/vehiculos", icon: <Truck className="h-4 w-4" />, roles: ["transportista"] },
    { label: "Documentos", href: "/transportista/upload", icon: <FileText className="h-4 w-4" />, roles: ["transportista"] },
    { label: "Mis documentos", href: "/conductor/documentos", icon: <FileText className="h-4 w-4" />, roles: ["conductor"] },
  ]

  const filteredItems = navItems.filter((item) => item.roles.includes(role || ""))
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)] md:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 border-r border-[var(--cf-border)] bg-[var(--cf-sidebar)] transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-[var(--cf-border)] px-5 py-4">
          <p className="text-base font-semibold tracking-tight">ChileFlota</p>
          <p className="mt-1 text-xs capitalize text-[var(--cf-text-muted)]">{role || "usuario"}</p>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {filteredItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-[var(--cf-accent)] text-[var(--cf-text)]"
                  : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-[var(--cf-border)] p-3">
          <Link href="/settings" className="flex min-h-10 items-center gap-2 rounded-[5px] px-3 py-2 text-sm text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)]">
            <Settings className="h-4 w-4" />
            Configuración
          </Link>
          <button onClick={handleLogout} className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-[5px] px-3 py-2 text-sm text-[var(--cf-text-muted)] hover:bg-[var(--cf-danger-soft)] hover:text-[var(--cf-danger)]">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:ml-56">
        <header className="flex min-h-14 items-center border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 md:px-6">
          <button
            onClick={() => setSidebarOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-[5px] text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] md:hidden"
            aria-label="Abrir navegación"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        <main className="min-h-[calc(100vh-56px)] bg-[var(--cf-canvas)]">{children}</main>
      </div>

      {sidebarOpen && <button aria-label="Cerrar navegación" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/50 md:hidden" />}
    </div>
  )
}
