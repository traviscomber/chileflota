import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock3,
  FileCheck2,
  FileText,
  Layers3,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"

export const revalidate = 300

const AI_VISUAL =
  "https://gcrmfajlebshvohmbfuy.supabase.co/storage/v1/object/public/landing-assets/chileflota/ai-logistics-document-workflow.webp"

async function getPublicProcessedDocumentCount(): Promise<number | null> {
  try {
    const supabase = createAdminClient()
    const [subcontractorTotal, uploadedTotal] = await Promise.all([
      supabase.from("subcontractor_documents").select("id", { count: "exact", head: true }),
      supabase.from("uploaded_documents").select("id", { count: "exact", head: true }),
    ])

    if (subcontractorTotal.error || uploadedTotal.error) return null

    return Number(subcontractorTotal.count || 0) + Number(uploadedTotal.count || 0)
  } catch {
    return null
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--cf-text-muted)]">
      {children}
    </p>
  )
}

function AccentRule() {
  return <span className="block h-px w-10 bg-[var(--cf-accent)]" aria-hidden="true" />
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

          <nav className="hidden items-center gap-7 text-xs text-[var(--cf-text-secondary)] lg:flex" aria-label="Navegación principal">
            <a href="#solucion" className="transition-colors hover:text-[var(--cf-text)]">Solución</a>
            <a href="#modelo-operacional" className="transition-colors hover:text-[var(--cf-text)]">Cómo funciona</a>
            <a href="#ia" className="transition-colors hover:text-[var(--cf-text)]">IA</a>
            <a href="#resultados" className="transition-colors hover:text-[var(--cf-text)]">Resultados</a>
          </nav>

          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-4 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)]"
          >
            Acceder
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section id="solucion" className="relative border-b border-[var(--cf-border)] pt-16">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[0.7fr_1.3fr]">
          <div className="flex min-h-[690px] items-center px-4 py-16 sm:px-6 lg:px-8 lg:pr-14">
            <div className="max-w-[590px]">
              <div className="flex items-center gap-4">
                <SectionLabel>Control documental de flota</SectionLabel>
                <AccentRule />
              </div>

              <h1 className="mt-6 text-5xl font-semibold leading-[0.96] tracking-[-0.05em] sm:text-6xl lg:text-[68px]">
                El subcontratista carga. La ejecutiva valida. La operación sigue.
              </h1>

              <p className="mt-7 max-w-[560px] text-base leading-7 text-[var(--cf-text-secondary)] sm:text-lg">
                ChileFlota centraliza la documentación de la flota. Los subcontratistas cargan, la IA estructura la información, la ejecutiva valida y la operación gana trazabilidad, tiempo y continuidad.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-6 text-sm font-medium transition-colors hover:bg-[var(--cf-accent-hover)]"
                >
                  Ingresar a la plataforma
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#modelo-operacional"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--cf-radius)] border border-[var(--cf-border)] px-6 text-sm font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]"
                >
                  Ver cómo funciona
                </a>
              </div>
            </div>
          </div>

          <div className="relative min-h-[540px] overflow-hidden border-t border-[var(--cf-border)] bg-[var(--cf-sidebar)] lg:min-h-[690px] lg:border-l lg:border-t-0">
            <img
              src={AI_VISUAL}
              alt="Flujo visual de ChileFlota desde la carga documental del subcontratista hasta la validación de la ejecutiva y la continuidad operacional."
              className="absolute inset-0 h-full w-full object-cover object-center opacity-90"
              width="1672"
              height="941"
            />
            <div className="absolute inset-0 bg-[rgba(17,18,20,0.28)]" />
            <div className="absolute inset-x-0 bottom-0 grid gap-px bg-[var(--cf-border)] sm:grid-cols-4">
              {[
                ["01", "Subcontratista", "Carga documentación"],
                ["02", "ChileFlota + IA", "Ordena y extrae"],
                ["03", "Ejecutiva", "Revisa y decide"],
                ["04", "Operación", "Sigue con respaldo"],
              ].map(([number, title, text]) => (
                <div key={number} className="bg-[rgba(23,23,25,0.94)] p-4">
                  <p className="font-mono text-[10px] text-[var(--cf-accent)]">{number}</p>
                  <p className="mt-2 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-[var(--cf-text-muted)]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl border-x border-[var(--cf-border)] bg-[var(--cf-sidebar)] sm:grid-cols-3">
          <div className="flex gap-4 p-5 sm:p-6">
            <FileText className="mt-1 h-5 w-5 shrink-0 text-[var(--cf-accent)]" aria-hidden="true" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Documentos procesados</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                {processedDocumentCount !== null ? formatNumber.format(processedDocumentCount) : "Operación activa"}
              </p>
              <p className="mt-1 text-xs text-[var(--cf-text-secondary)]">Actividad agregada del sistema</p>
            </div>
          </div>

          <div className="flex gap-4 border-t border-[var(--cf-border)] p-5 sm:border-l sm:border-t-0 sm:p-6">
            <Building2 className="mt-1 h-5 w-5 shrink-0 text-[var(--cf-accent)]" aria-hidden="true" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Implementación activa</p>
              <p className="mt-2 text-lg font-semibold">Transportes Labbe</p>
              <p className="mt-1 text-xs text-[var(--cf-text-secondary)]">Operación productiva</p>
            </div>
          </div>

          <div className="flex gap-4 border-t border-[var(--cf-border)] p-5 sm:border-l sm:border-t-0 sm:p-6">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[var(--cf-accent)]" aria-hidden="true" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Sin exponer datos</p>
              <p className="mt-2 text-lg font-semibold">Sólo evidencia agregada pública</p>
              <p className="mt-1 text-xs text-[var(--cf-text-secondary)]">Sin documentos ni datos personales</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <div className="flex items-center gap-4">
              <SectionLabel>01 / Riesgo operacional</SectionLabel>
              <AccentRule />
            </div>
            <h2 className="mt-5 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              La documentación forma parte de la continuidad operacional.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--cf-text-secondary)]">
              Cuando la evidencia se dispersa, las vigencias se pierden de vista y la operación termina resolviendo tarde.
            </p>
          </div>

          <div className="border-y border-[var(--cf-border)]">
            {[
              [FileText, "01", "Evidencia distribuida", "La información llega desde múltiples actores, fuentes y formatos."],
              [Clock3, "02", "Vigencias variables", "Cada requisito tiene periodo, estado, renovación y condición de uso."],
              [AlertTriangle, "03", "Decisión operacional", "La organización necesita saber si existe respaldo suficiente para operar."],
            ].map(([Icon, number, title, text]) => {
              const RowIcon = Icon as typeof FileText
              return (
                <div key={String(number)} className="grid gap-4 border-b border-[var(--cf-border)] py-6 last:border-b-0 sm:grid-cols-[48px_44px_190px_1fr] sm:items-center">
                  <span className="font-mono text-xs text-[var(--cf-accent)]">{String(number)}</span>
                  <RowIcon className="h-5 w-5 text-[var(--cf-accent)]" aria-hidden="true" />
                  <p className="text-sm font-semibold">{String(title)}</p>
                  <p className="text-sm leading-6 text-[var(--cf-text-secondary)]">{String(text)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="modelo-operacional" className="border-b border-[var(--cf-border)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-4">
            <SectionLabel>02 / Modelo de control</SectionLabel>
            <AccentRule />
          </div>

          <div className="mt-5 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              Una sola lectura para revisar, resolver y demostrar.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--cf-text-secondary)]">
              La experiencia se organiza alrededor de una bandeja de trabajo unificada: evidencia, contexto y decisión siempre disponibles.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {[
              [Layers3, "01", "Consolidar", "La evidencia queda vinculada a la empresa, persona o unidad correspondiente.", "Datos · contexto · visión única"],
              [ListChecks, "02", "Priorizar", "El sistema ordena requisitos, periodos y vigencias para hacer visible lo crítico.", "Alertas · análisis · foco"],
              [BadgeCheck, "03", "Resolver", "El equipo revisa, valida y mantiene trazabilidad sobre cada decisión documental.", "Acción · seguimiento · resultados"],
            ].map(([Icon, number, title, text, footer]) => {
              const CardIcon = Icon as typeof Layers3
              return (
                <article key={String(number)} className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 sm:p-7">
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-sm text-[var(--cf-accent)]">{String(number)}</span>
                    <CardIcon className="h-7 w-7 text-[var(--cf-accent)]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-12 text-xl font-semibold">{String(title)}</h3>
                  <p className="mt-4 min-h-20 text-sm leading-6 text-[var(--cf-text-secondary)]">{String(text)}</p>
                  <p className="mt-8 border-t border-[var(--cf-border)] pt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">
                    {String(footer)}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="ia" className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-4">
                <SectionLabel>03 / IA aplicada al proceso</SectionLabel>
                <AccentRule />
              </div>
              <h2 className="mt-5 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                La IA prepara la revisión. La ejecutiva toma la decisión.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-[var(--cf-text-secondary)]">
                ChileFlota reduce trabajo manual leyendo, clasificando y estructurando evidencia antes de la revisión humana.
              </p>

              <div className="mt-8 overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-canvas)]">
                <img
                  src={AI_VISUAL}
                  alt="Análisis documental asistido por IA dentro del flujo ChileFlota."
                  width="1672"
                  height="941"
                  loading="lazy"
                  className="block aspect-[16/9] w-full object-cover"
                />
              </div>
            </div>

            <div className="border-y border-[var(--cf-border)]">
              {[
                [FileText, "01", "Lectura automática", "Extrae tipo de documento, fechas de emisión y vencimiento, número, texto, confianza y advertencias."],
                [Sparkles, "02", "PDF e imágenes", "Lee texto nativo cuando existe y usa lectura visual como respaldo para documentos escaneados o imágenes."],
                [ShieldCheck, "03", "Validaciones especializadas", "Aplica reglas específicas sobre F30-1, periodo, RUT y señales de inconsistencia."],
                [AlertTriangle, "04", "Alertas operacionales", "Detecta vencimientos y próximos vencimientos para convertir análisis en acciones concretas."],
                [Users, "05", "Corrección humana", "La ejecutiva confirma o corrige el análisis; esas correcciones quedan registradas como feedback."],
              ].map(([Icon, number, title, text]) => {
                const AiIcon = Icon as typeof FileText
                return (
                  <div key={String(number)} className="grid gap-4 border-b border-[var(--cf-border)] py-5 last:border-b-0 sm:grid-cols-[44px_40px_190px_1fr] sm:items-center">
                    <span className="font-mono text-xs text-[var(--cf-accent)]">{String(number)}</span>
                    <AiIcon className="h-5 w-5 text-[var(--cf-accent)]" aria-hidden="true" />
                    <p className="text-sm font-semibold">{String(title)}</p>
                    <p className="text-sm leading-6 text-[var(--cf-text-secondary)]">{String(text)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-px bg-[var(--cf-border)] sm:grid-cols-2">
            <div className="bg-[var(--cf-surface)] p-5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">IA como apoyo</p>
              <p className="mt-2 text-base font-semibold">Clasifica, extrae, alerta y propone contexto.</p>
            </div>
            <div className="bg-[var(--cf-surface)] p-5 sm:border-l-2 sm:border-l-[var(--cf-accent)]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Control humano</p>
              <p className="mt-2 text-base font-semibold">La aprobación o rechazo sigue siendo decisión de la ejecutiva.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="resultados" className="border-b border-[var(--cf-border)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
          <div>
            <div className="flex items-center gap-4">
              <SectionLabel>04 / Lectura operacional</SectionLabel>
              <AccentRule />
            </div>
            <h2 className="mt-5 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              La operación necesita respuestas verificables.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--cf-text-secondary)]">
              Una lectura clara del estado documental permite anticiparse, reducir riesgos y sostener continuidad operacional.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [FileCheck2, "Qué falta", "Requisitos sin respaldo suficiente para el periodo operativo vigente.", "Visibilidad total de gaps"],
              [Clock3, "Qué vence", "Documentación que requiere atención antes de afectar continuidad operacional.", "Menos riesgo, más continuidad"],
              [BadgeCheck, "Qué está respaldado", "Documentación validada y disponible para revisión, auditoría o mandante.", "Cumplimiento verificable"],
            ].map(([Icon, title, text, footer]) => {
              const OpIcon = Icon as typeof FileCheck2
              return (
                <article key={String(title)} className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6">
                  <OpIcon className="h-6 w-6 text-[var(--cf-accent)]" aria-hidden="true" />
                  <h3 className="mt-8 text-xl font-semibold">{String(title)}</h3>
                  <p className="mt-4 text-sm leading-6 text-[var(--cf-text-secondary)]">{String(text)}</p>
                  <p className="mt-8 border-t border-[var(--cf-border)] pt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">
                    {String(footer)}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-16">
          <div>
            <div className="flex items-center gap-4">
              <SectionLabel>05 / Evidencia operacional</SectionLabel>
              <AccentRule />
            </div>
            <h2 className="mt-5 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              Implementación activa. Evidencia real.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--cf-text-secondary)]">
              ChileFlota ya opera en producción para el control y revisión documental de Transportes Labbe.
            </p>
          </div>

          <div className="grid border border-[var(--cf-border)] bg-[var(--cf-border)] sm:grid-cols-2">
            <div className="bg-[var(--cf-surface)] p-7 sm:p-8">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Implementación activa</p>
              <p className="mt-5 text-3xl font-semibold tracking-[-0.035em]">Transportes Labbe</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--cf-text-secondary)]">
                Flujo productivo de carga, revisión, validación y trazabilidad documental.
              </p>
            </div>
            <div className="bg-[var(--cf-surface)] p-7 sm:p-8">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Actividad registrada</p>
              <p className="mt-5 text-4xl font-semibold tracking-[-0.045em]">
                {processedDocumentCount !== null ? formatNumber.format(processedDocumentCount) : "Activa"}
              </p>
              <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">documentos procesados por ChileFlota</p>
              <div className="mt-8 flex items-center gap-3 border-t border-[var(--cf-border)] pt-5 text-xs text-[var(--cf-text-muted)]">
                <ShieldCheck className="h-4 w-4 text-[var(--cf-accent)]" aria-hidden="true" />
                Sólo evidencia agregada pública
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--cf-border)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <SectionLabel>Acceso clientes</SectionLabel>
              <AccentRule />
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
              Control documental con criterio operacional.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--cf-text-secondary)]">
              Una operación más simple, trazable y preparada para demostrar cumplimiento.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-6 text-sm font-medium transition-colors hover:bg-[var(--cf-accent-hover)]"
          >
            Acceder a la plataforma
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 text-xs text-[var(--cf-text-muted)] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-[var(--cf-accent)]" aria-hidden="true" />
            <span>ChileFlota · Compliance operacional</span>
          </div>
          <span>Control documental para flotas</span>
          <span>Implementación activa: Transportes Labbe</span>
        </div>
      </footer>
    </main>
  )
}
