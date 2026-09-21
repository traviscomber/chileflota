'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Clock, FileText, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const items = [
  {
    icon: FileText,
    title: 'Sube el documento correcto',
    text: 'Selecciona el tipo documental y la fecha real del documento. PDF, JPG o PNG hasta 50 MB.',
  },
  {
    icon: Clock,
    title: 'Revisa el estado',
    text: 'En revisión significa recibido correctamente. No necesitas volver a cargarlo mientras espera validación.',
  },
  {
    icon: CheckCircle2,
    title: 'Actúa sólo cuando corresponde',
    text: 'Si está rechazado, vencido o próximo a vencer, revisa el motivo y reemplaza ese documento.',
  },
  {
    icon: HelpCircle,
    title: 'Consulta períodos anteriores',
    text: 'Puedes filtrar por mes y año y también cargar documentación histórica. ChileFlota confirmará el período antes de guardar.',
  },
]

export default function SubcontractorsOnboardingPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-[var(--cf-canvas)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="border-b border-[var(--cf-border)] pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Portal Subcontratistas</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--cf-text)]">Cómo funciona ChileFlota</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--cf-text-secondary)]">
            Mantén la documentación de tu empresa al día, consulta períodos anteriores y corrige sólo lo que requiere acción.
          </p>
        </section>

        <section className="overflow-hidden rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)]">
          <div className="divide-y divide-[var(--cf-border)]">
            {items.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="flex gap-4 p-4 sm:p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[var(--cf-surface-raised)] text-[var(--cf-text-secondary)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--cf-text-muted)]">0{index + 1}</p>
                  <h2 className="mt-1 text-base font-semibold text-[var(--cf-text)]">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--cf-text-secondary)]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4 sm:p-5">
          <h2 className="text-base font-semibold text-[var(--cf-text)]">Estados que verás</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <State label="Aprobado" detail="Validado y vigente." tone="success" />
            <State label="En revisión" detail="Recibido; no requiere nueva carga." tone="warning" />
            <State label="Por vencer" detail="Renueva antes de perder vigencia." tone="expiring" />
            <State label="Rechazado / vencido" detail="Revisa el motivo y reemplaza." tone="danger" />
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-[var(--cf-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--cf-text-muted)]">Si necesitas ayuda, contacta a tu ejecutiva asignada.</p>
          <Button onClick={() => router.push('/subcontractors/dashboard')}>
            Ir a documentos <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  )
}

function State({ label, detail, tone }: { label: string; detail: string; tone: 'success' | 'warning' | 'expiring' | 'danger' }) {
  const styles = {
    success: 'bg-[var(--cf-success-soft)] text-[var(--cf-success)]',
    warning: 'bg-[var(--cf-warning-soft)] text-[var(--cf-warning)]',
    expiring: 'bg-[var(--cf-expiring-soft)] text-[var(--cf-expiring)]',
    danger: 'bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]',
  }[tone]

  return (
    <div className="rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3">
      <span className={`inline-flex rounded-[4px] px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>
      <p className="mt-2 text-xs text-[var(--cf-text-muted)]">{detail}</p>
    </div>
  )
}
