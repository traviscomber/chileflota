import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="border-b border-[var(--cf-border)] pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Administración</p>
        <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Panel de control</h2>
        <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">Gestión de usuarios, documentos, permisos y operación interna.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del sistema</CardTitle>
          <CardDescription>Las métricas aparecerán aquí cuando existan datos operacionales disponibles para este rol.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-[var(--cf-text-muted)]">
            Usa la navegación lateral para revisar usuarios, documentos, OCR, Cronos, compliance y reportes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
