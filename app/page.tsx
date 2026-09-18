import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ArrowRight,
  Check,
  FileCheck2,
  FileClock,
  FolderSearch2,
  ShieldCheck,
} from "lucide-react"

export const revalidate = 300

async function getPublicProcessedDocumentCount(): Promise<number | null> {
  try {
    const supabase = createAdminClient()
    const [subcontractorTotal, uploadedTotal] = await Promise.all([
      supabase.from("subcontractor_documents").select("id", { count: "exact", head: true }),
      supabase.from("uploaded_documents").select("id", { count: "exact", head: true }),
    ])

    if (subcontractorTotal.error || uploadedTotal.error) {
      console.error("[landing] Could not load public processed-document count")
      return null
    }

    return Number(subcontractorTotal.count || 0) + Number(uploadedTotal.count || 0)
  } catch (error) {
    console.error("[landing] Public processed-document count failed:", error instanceof Error ? error.message : String(error))
    return null
  }
}

const operationalQuestions = [
  {
    icon: FolderSearch2,
    label: "Cobertura",
    title: "Qué falta",
    text: "Requisitos sin respaldo suficiente para el periodo operativo vigente.",
  },
  {
    icon: FileClock,
    label: "Vigencia",
    title: "Qué vence",
    text: "Documentación que requiere atención antes de afectar continuidad operacional.",
  },
  {
    icon: FileCheck2,
    label: "Evidencia",
    title: "Qué está respaldado",
    text: "Documentación validada y disponible para revisión, auditoría o mandante.",
  },
]

function SectionIndex({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--cf-text-muted)]">
      {children}
    </p>
  )
}

function HeroOperationalBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1768207750854-fb0cbd9c19f0?auto=format&fit=crop&fm=jpg&q=82&w=2400')",
        }}
      />
      <div className="absolute inset-0 bg-[rgba(9,10,12,0.48)]" />
      <div className="absolute inset-y-0 left-0 w-[64%] bg-[linear-gradient(90deg,rgba(17,18,20,0.99)_0%,rgba(17,18,20,0.95)_58%,rgba(17,18,20,0.18)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,rgba(17,18,20,0)_0%,rgba(17,18,20,0.82)_58%,rgba(17,18,20,0.98)_100%)]" />
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute right-8 top-28 hidden border-l border-[var(--cf-border)] pl-5 lg:block">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-muted)]">Flota en movimiento</p>
        <p className="mt-2 max-w-[150px] text-xs leading-5 text-[var(--cf-text-secondary)]">
          Documentación bajo control.
        </p>
      </div>
    </div>
  )
}

export default async function LandingPage() {
  const processedDocumentCount = await getPublicProcessedDocumentCount()
  const formatNumber = new Intl.NumberFormat("es-CL")

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--cf-canvas)] text-[var(--cf-text)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="ChileFlota inicio">
            <span className="flex h-8 w-8 items-center justify-center border border-[var(--cf-border)] bg-[var(--cf-surface)]">
              <ShieldCheck className="h-4 w-4 text-[var(--cf-accent)]" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.02em]">ChileFlota</span>
              <span className="mt-1 block text-[11px] text-[var(--cf-text-muted)]">Compliance operacional</span>
            </span>
          </Link>

          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-4 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)]"
          >
            Acceder
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="relative min-h-[760px] overflow-hidden border-b border-[var(--cf-border)] pt-16">
        <HeroOperationalBackdrop />

        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center py-14 lg:py-20">
            <div className="max-w-[690px]">
              <div className="flex items-center gap-4">
                <SectionIndex>Control documental de flota</SectionIndex>
                <span className="hidden h-px w-12 bg-[var(--cf-border)] sm:block" />
              </div>

              <h1 className="mt-6 text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--cf-text)] sm:text-6xl lg:text-[72px]">
                Cumplimiento documental para una operación continua.
              </h1>

              <p className="mt-7 max-w-[610px] text-base leading-7 text-[var(--cf-text-secondary)] sm:text-lg">
                ChileFlota centraliza evidencia, vigencias y revisión documental para que la flota opere con respaldo y sin reconstruir información entre correos, planillas y mensajes.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-6 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)]"
                >
                  Ingresar a la plataforma
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#modelo-operacional"
                  className="inline-flex h-12 items-center justify-center rounded-[var(--cf-radius)] border border-[var(--cf-border)] bg-[rgba(17,18,20,0.72)] px-6 text-sm font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]"
                >
                  Ver modelo operacional
                </a>
              </div>
            </div>
          </div>

          <div className="grid border-t border-[var(--cf-border)] bg-[rgba(17,18,20,0.94)] sm:grid-cols-3">
            <div className="px-5 py-5 sm:px-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Actividad registrada</p>
              {processedDocumentCount !== null && processedDocumentCount > 0 ? (
                <p className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-[var(--cf-text)]">
                  {formatNumber.format(processedDocumentCount)}
                </p>
              ) : (
                <p className="mt-2 text-xl font-semibold text-[var(--cf-text)]">Operación activa</p>
              )}
              <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">documentos procesados por ChileFlota</p>
            </div>

            <div className="border-t border-[var(--cf-border)] px-5 py-5 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Implementación activa</p>
              <p className="mt-2 text-lg font-semibold text-[var(--cf-text)]">Transportes Labbe</p>
              <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">control documental operacional</p>
            </div>

            <div className="border-t border-[var(--cf-border)] px-5 py-5 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">Lectura operacional</p>
              <p className="mt-2 text-lg font-semibold text-[var(--cf-text)]">Faltantes · vigencias · respaldo</p>
              <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">actividad agregada, sin datos personales</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <SectionIndex>01 / Riesgo operacional</SectionIndex>
            <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em]">
              La documentación forma parte de la continuidad operacional.
            </h2>
          </div>

          <div className="border-y border-[var(--cf-border)]">
            {[
              ["Evidencia distribuida", "La información llega desde múltiples actores y canales."],
              ["Vigencias variables", "Cada requisito tiene periodo, estado y condición de uso."],
              ["Decisión operacional", "La organización necesita saber si existe respaldo suficiente para operar."],
            ].map(([title, text], index) => (
              <div
                key={title}
                className="grid gap-3 border-b border-[var(--cf-border)] py-6 last:border-b-0 sm:grid-cols-[52px_190px_1fr] sm:items-baseline sm:gap-6"
              >
                <span className="font-mono text-xs text-[var(--cf-accent)]">0{index + 1}</span>
                <p className="text-sm font-semibold text-[var(--cf-text)]">{title}</p>
                <p className="max-w-xl text-sm leading-6 text-[var(--cf-text-secondary)]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modelo-operacional" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionIndex>02 / Modelo de control</SectionIndex>
          <div className="mt-4 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em]">
              Una sola lectura para revisar, resolver y demostrar.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--cf-text-secondary)]">
              La experiencia se organiza alrededor de una bandeja de trabajo: evidencia a la izquierda, contexto al centro y decisión siempre disponible.
            </p>
          </div>

          <div className="mt-10 grid overflow-hidden rounded-[var(--cf-radius)] border border-[var(--cf-border)] bg-[var(--cf-border)] lg:grid-cols-3">
            {[
              ["01", "Consolidar", "La evidencia queda vinculada a la empresa, persona o unidad correspondiente."],
              ["02", "Priorizar", "El sistema ordena requisitos, periodos y vigencias para hacer visible lo que requiere atención."],
              ["03", "Resolver", "El equipo revisa, valida y mantiene trazabilidad sobre cada decisión documental."],
            ].map(([number, title, text]) => (
              <article key={number} className="min-h-64 bg-[var(--cf-surface)] p-6 sm:p-8">
                <span className="font-mono text-xs text-[var(--cf-text-muted)]">{number}</span>
                <h3 className="mt-14 text-lg font-semibold">{title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--cf-text-secondary)]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <SectionIndex>03 / Lectura operacional</SectionIndex>
            <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em]">
              La operación necesita respuestas verificables.
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-[var(--cf-radius)] bg-[var(--cf-border)] sm:grid-cols-3">
            {operationalQuestions.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="bg-[var(--cf-surface)] p-6">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-[var(--cf-accent)]" aria-hidden="true" />
                    <span className="text-xs text-[var(--cf-text-muted)]">{item.label}</span>
                  </div>
                  <h3 className="mt-10 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--cf-text-secondary)]">{item.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 border-y border-[var(--cf-border)] py-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-16">
            <div>
              <SectionIndex>04 / Evidencia operacional</SectionIndex>
              <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-[-0.035em]">
                Implementación activa y operación registrada.
              </h2>
            </div>

            <div className="border-l-2 border-[var(--cf-accent)] pl-6">
              <div className="flex items-center gap-3 text-sm font-medium text-[var(--cf-text)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cf-accent-soft)] text-[var(--cf-focus-ring)]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                Implementación activa
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Transportes Labbe</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cf-text-secondary)]">
                ChileFlota opera actualmente sobre una implementación productiva para el control y revisión documental de Transportes Labbe.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionIndex>Acceso clientes</SectionIndex>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.035em]">
              Control documental con criterio operacional.
            </h2>
          </div>

          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-5 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)]"
          >
            Acceder a la plataforma
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--cf-border)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-[var(--cf-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>ChileFlota · Compliance documental para flotas</span>
          <span>Implementación activa: Transportes Labbe</span>
        </div>
      </footer>
    </main>
  )
}
