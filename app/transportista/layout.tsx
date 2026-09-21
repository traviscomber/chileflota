import Link from "next/link"
import { AlertCircle, FileText, LayoutDashboard, Truck, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const navItems = [
  { href: "/transportista", label: "Inicio", icon: LayoutDashboard },
  { href: "/transportista/conductores", label: "Conductores", icon: Users },
  { href: "/transportista/vehiculos", label: "Vehículos", icon: Truck },
  { href: "/transportista/documentos", label: "Documentos", icon: FileText },
  { href: "/transportista/alertas", label: "Alertas", icon: AlertCircle },
]

export default async function TransportistaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  return (
    <div className="min-h-screen bg-[var(--cf-canvas)] text-[var(--cf-text)] md:flex">
      <aside className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] md:fixed md:inset-y-0 md:left-0 md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-[var(--cf-border)] px-5 py-4">
          <p className="text-base font-semibold tracking-tight">ChileFlota</p>
          <p className="mt-1 text-xs text-[var(--cf-text-muted)]">Transportista</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:block md:space-y-1 md:overflow-visible md:py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="flex min-h-10 shrink-0 items-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]">
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 md:ml-56">
        <main className="min-h-screen bg-[var(--cf-canvas)] p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
