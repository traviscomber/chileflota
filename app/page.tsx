import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileText,
  ShieldCheck,
  Sparkles,
  Users,
  UploadCloud,
  ScanLine,
  UserCheck,
  Truck,
} from "lucide-react"

export const revalidate = 300

const LABBE_HERO_IMAGE =
  "https://labbe.cl/wp-content/uploads/2022/01/ADF7E6D3-84BB-4C9A-A3D2-FD27DCDB12AA-1400x788.jpg"
const LABBE_OPERATION_IMAGE =
  "https://labbe.cl/wp-content/uploads/2021/12/IMG_0071.jpg"
const LABBE_FLEET_IMAGE =
  "https://labbe.cl/wp-content/uploads/2021/12/IMG_0068.jpg"

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

function HeroWorkflowVisual() {
  const steps = [
    { icon: UploadCloud, label: "Subcontratista", meta: "Carga documentación" },
    { icon: ScanLine, label: "ChileFlota + IA", meta: "Lee · clasifica · alerta" },
    { icon: UserCheck, label: "Ejecutiva", meta: "Revisa · valida · decide" },
    { icon: Truck, label: "Operación", meta: "Sigue con respaldo" },
  ]

  return (
    <div className="relative min-h-[540px] overflow-hidden bg-[var(--cf-sidebar)] lg:min-h-[690px]">
      <div className="relative h-[270px] overflow-hidden border-b border-[var(--cf-border)] sm:h-[310px] lg:h-[330px]">
        <img
          src={LABBE_HERO_IMAGE}
          alt="Operación real de Transportes Labbe."
          className="h-full w-full object-cover grayscale-[35%] contrast-[1.05]"
          loading="eager"
        />
        <div className="absolute inset-0 bg-[rgba(23,23,25,0.34)]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 bg-[rgba(23,23,25,0.88)] px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Implementación real</p>
            <p className="mt-1 text-sm font-semibold">Transportes Labbe · Paine, Chile</p>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-5 text-[var(--cf-text-secondary)] sm:block">
            La capa visual muestra la operación; ChileFlota agrega control documental y trazabilidad.
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-7 lg:p-8">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-muted)]">Flujo documental operativo</p>
          <p className="font-mono text-[10px] text-[var(--cf-accent)]">FLUJO · 04 ETAPAS</p>
        </div>

        <div className="mt-5 grid gap-px bg-[var(--cf-border)] sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.label} className="bg-[var(--cf-surface)] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--cf-accent)]">0{index + 1}</span>
                  <Icon className="h-4 w-4 text-[var(--cf-accent)]" aria-hidden="true" />
                </div>
                <p className="mt-5 text-sm font-semibold">{step.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">{step.meta}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-5 grid gap-px bg-[var(--cf-border)] sm:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[var(--cf-canvas)] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Antes</p>
            <p className="mt-2 text-xs font-medium text-[var(--cf-text-secondary)]">Correos · planillas · mensajes · seguimiento manual</p>
          </div>
          <div className="border-l-2 border-l-[var(--cf-accent)] bg-[var(--cf-canvas)] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Con ChileFlota</p>
            <p className="mt-2 text-xs font-semibold">Una bandeja · una decisión · evidencia trazable</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AIProcessingVisual() {
  return (
    <div className="relative overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-canvas)]">
      <div className="absolute inset-0 bg-grid opacity-25" aria-hidden="true" />
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-[var(--cf-border)] pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Ejemplo de análisis</p>
            <p className="mt-2 text-sm font-semibold">Documento laboral · periodo detectado</p>
          </div>
          <span className="flex items-center gap-2 text-xs text-[var(--cf-text-secondary)]">
            <span className="h-2 w-2 rounded-full bg-[var(--cf-accent)]" />
            IA asistiendo
          </span>
        </div>

        <div className="grid gap-4 py-5 md:grid-cols-[1fr_0.9fr]">
          <div className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
            <div className="flex items-center justify-between">
              <FileText className="h-5 w-5 text-[var(--cf-accent)]" aria-hidden="true" />
              <span className="font-mono text-[10px] text-[var(--cf-text-muted)]">PDF</span>
            </div>
            <div className="mt-8 space-y-3">
              <div className="h-2 w-4/5 bg-[var(--cf-border)]" />
              <div className="h-2 w-3/5 bg-[var(--cf-border)]" />
              <div className="h-2 w-11/12 bg-[var(--cf-border)]" />
              <div className="h-2 w-2/3 bg-[var(--cf-border)]" />
            </div>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              <div className="border border-[var(--cf-border)] p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">RUT</p>
                <p className="mt-2 text-xs font-semibold">Detectado</p>
              </div>
              <div className="border border-[var(--cf-border)] p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">Periodo</p>
                <p className="mt-2 text-xs font-semibold">Coincide</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {[
              ["Tipo documental", "Detectado", "IA"],
              ["Periodo", "Extraído", "IA"],
              ["RUT empresa", "Coincide", "REGLA"],
              ["Advertencias", "Para revisión", "IA"],
            ].map(([label, value, status]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">{label}</p>
                  <p className="mt-1 text-xs font-semibold">{value}</p>
                </div>
                <span className="font-mono text-[10px] text-[var(--cf-accent)]">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--cf-border)] pt-4">
          <p className="text-xs text-[var(--cf-text-muted)]">La IA prepara evidencia y contexto.</p>
          <p className="text-xs font-semibold">La ejecutiva decide.</p>
        </div>
      </div>
    </div>
  )
}


function RiskContinuityGraphic() {
  return (
    <div className="overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-canvas)]">
      <div className="flex items-center justify-between border-b border-[var(--cf-border)] px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">De evidencia dispersa a decisión verificable</p>
        <span className="font-mono text-[10px] text-[var(--cf-accent)]">03 CAPAS</span>
      </div>

      <div className="grid gap-px bg-[var(--cf-border)]">
        <div className="grid bg-[var(--cf-surface)] p-5 sm:grid-cols-[52px_150px_1fr] sm:items-center">
          <span className="font-mono text-xs text-[var(--cf-accent)]">01</span>
          <p className="mt-3 text-sm font-semibold sm:mt-0">Entrada</p>
          <div className="mt-4 grid gap-2 sm:mt-0 sm:grid-cols-3">
            {["PDF", "IMAGEN", "FORMULARIO"].map((item) => (
              <span key={item} className="border border-[var(--cf-border)] bg-[var(--cf-sidebar)] px-3 py-3 text-center font-mono text-[10px] text-[var(--cf-text-secondary)]">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="grid bg-[var(--cf-surface)] p-5 sm:grid-cols-[52px_150px_1fr] sm:items-center">
          <span className="font-mono text-xs text-[var(--cf-accent)]">02</span>
          <p className="mt-3 text-sm font-semibold sm:mt-0">Control</p>
          <div className="mt-4 grid gap-2 sm:mt-0 sm:grid-cols-3">
            {[
              ["Periodo", "¿Corresponde?"],
              ["Vigencia", "¿Sigue válido?"],
              ["Requisito", "¿Está cubierto?"],
            ].map(([label, question]) => (
              <div key={label} className="border-l border-[var(--cf-accent)] bg-[var(--cf-sidebar)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--cf-text-muted)]">{label}</p>
                <p className="mt-1 text-xs font-medium">{question}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid bg-[var(--cf-surface)] p-5 sm:grid-cols-[52px_150px_1fr] sm:items-center">
          <span className="font-mono text-xs text-[var(--cf-accent)]">03</span>
          <p className="mt-3 text-sm font-semibold sm:mt-0">Decisión</p>
          <div className="mt-4 grid gap-px bg-[var(--cf-border)] sm:mt-0 sm:grid-cols-[1fr_auto_1fr]">
            <div className="bg-[var(--cf-sidebar)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--cf-text-muted)]">Evidencia</p>
              <p className="mt-1 text-xs font-medium">Estado y respaldo visibles</p>
            </div>
            <div className="hidden w-12 items-center justify-center bg-[var(--cf-canvas)] sm:flex" aria-hidden="true">
              <span className="h-px w-5 bg-[var(--cf-accent)]" />
            </div>
            <div className="bg-[var(--cf-sidebar)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--cf-text-muted)]">Humano</p>
              <p className="mt-1 text-xs font-medium">Validar y dejar trazabilidad</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ControlLoopGraphic() {
  const steps = [
    { number: "01", title: "Consolidar", eyebrow: "Entrada", text: "La evidencia queda vinculada a la empresa, persona o unidad correspondiente.", footer: "Evidencia + contexto" },
    { number: "02", title: "Priorizar", eyebrow: "Criterio", text: "Requisitos, periodos y vigencias se ordenan para hacer visible lo crítico.", footer: "Riesgo + urgencia" },
    { number: "03", title: "Resolver", eyebrow: "Salida", text: "El equipo revisa, valida y mantiene trazabilidad sobre cada decisión documental.", footer: "Decisión + respaldo" },
  ]

  return (
    <div className="mt-10 overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-sidebar)]">
      <div className="grid lg:grid-cols-[1fr_64px_1fr_64px_1fr]">
        {steps.map((step, index) => (
          <div key={step.number} className="contents">
            <article className="relative min-h-[300px] bg-[var(--cf-surface)] p-6 sm:p-8">
              <span className="absolute inset-x-0 top-0 h-1 bg-[var(--cf-accent)]" aria-hidden="true" />
              <div className="flex items-start justify-between gap-6">
                <p className="font-mono text-sm text-[var(--cf-accent)]">{step.number}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">{step.eyebrow}</p>
              </div>
              <div className="mt-14">
                <p className="text-2xl font-semibold tracking-[-0.03em]">{step.title}</p>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--cf-text-secondary)]">{step.text}</p>
              </div>
              <div className="mt-12 border-t border-[var(--cf-border)] pt-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)]">{step.footer}</p>
              </div>
            </article>
            {index < steps.length - 1 ? (
              <div className="relative hidden bg-[var(--cf-canvas)] lg:block" aria-hidden="true">
                <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 bg-[var(--cf-border)]" />
                <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-y-1/2 translate-x-3 rotate-45 border-r border-t border-[var(--cf-accent)]" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid border-t border-[var(--cf-border)] bg-[var(--cf-canvas)] sm:grid-cols-3">
        <div className="p-4 text-xs text-[var(--cf-text-muted)]">Recibir y ordenar evidencia</div>
        <div className="border-t border-[var(--cf-border)] p-4 text-xs text-[var(--cf-text-muted)] sm:border-l sm:border-t-0">Detectar lo crítico</div>
        <div className="border-t border-[var(--cf-border)] p-4 text-xs text-[var(--cf-text-muted)] sm:border-l sm:border-t-0">Cerrar con trazabilidad</div>
      </div>
    </div>
  )
}

function OperationalReadGraphic() {
  const rows = [
    ["Qué falta", "Cobertura", "Requisitos sin respaldo suficiente", "Identificar gap"],
    ["Qué vence", "Vigencia", "Documentos próximos a requerir acción", "Anticipar renovación"],
    ["Qué está respaldado", "Evidencia", "Documentación validada y disponible", "Demostrar cumplimiento"],
  ]

  return (
    <div className="overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-sidebar)]">
      <div className="grid grid-cols-[1fr_auto] border-b border-[var(--cf-border)] bg-[var(--cf-canvas)] px-5 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-muted)] sm:grid-cols-[180px_120px_1fr_180px]">
        <span>Pregunta</span>
        <span className="hidden sm:block">Lectura</span>
        <span className="hidden sm:block">Evidencia</span>
        <span>Acción</span>
      </div>
      {rows.map(([question, reading, evidence, action], index) => (
        <div key={question} className="grid gap-4 border-b border-[var(--cf-border)] bg-[var(--cf-surface)] px-5 py-5 last:border-b-0 sm:grid-cols-[180px_120px_1fr_180px] sm:items-center">
          <div>
            <p className="font-mono text-[10px] text-[var(--cf-accent)]">0{index + 1}</p>
            <p className="mt-1 text-sm font-semibold">{question}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">{reading}</p>
          <div className="relative pl-5">
            <span className="absolute inset-y-0 left-0 w-px bg-[var(--cf-border)]" aria-hidden="true" />
            <p className="text-sm leading-6 text-[var(--cf-text-secondary)]">{evidence}</p>
          </div>
          <div className="border-t border-[var(--cf-border)] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <p className="text-xs font-medium text-[var(--cf-text)]">{action}</p>
          </div>
        </div>
      ))}
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

          <div className="border-t border-[var(--cf-border)] lg:border-l lg:border-t-0">
            <HeroWorkflowVisual />
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

          <RiskContinuityGraphic />
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

          <ControlLoopGraphic />
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

              <div className="mt-8">
                <AIProcessingVisual />
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

          <OperationalReadGraphic />
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

          <div className="grid overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-border)] lg:grid-cols-[1.25fr_0.75fr]">
            <div className="relative min-h-[320px] overflow-hidden bg-[var(--cf-canvas)] sm:min-h-[400px]">
              <img
                src={LABBE_OPERATION_IMAGE}
                alt="Operación de transporte de Transportes Labbe."
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover grayscale-[28%] contrast-[1.04]"
              />
              <div className="absolute inset-0 bg-[rgba(23,23,25,0.18)]" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 bg-[rgba(23,23,25,0.9)] p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Operación real</p>
                <p className="mt-2 text-lg font-semibold">Transportes Labbe</p>
                <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--cf-text-secondary)]">
                  La plataforma se construye sobre una operación de transporte existente, no sobre un caso ficticio.
                </p>
              </div>
            </div>

            <div className="grid gap-px bg-[var(--cf-border)]">
              <div className="relative min-h-[210px] overflow-hidden bg-[var(--cf-canvas)]">
                <img
                  src={LABBE_FLEET_IMAGE}
                  alt="Flota y operación logística de Transportes Labbe."
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover grayscale-[35%] contrast-[1.05]"
                />
                <div className="absolute inset-0 bg-[rgba(23,23,25,0.28)]" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 bg-[rgba(23,23,25,0.88)] px-5 py-4">
                  <p className="text-xs font-medium">Flota · logística · continuidad</p>
                </div>
              </div>

              <div className="bg-[var(--cf-surface)] p-6">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-muted)]">Actividad registrada</p>
                <p className="mt-4 text-4xl font-semibold tracking-[-0.045em]">
                  {processedDocumentCount !== null ? formatNumber.format(processedDocumentCount) : "Activa"}
                </p>
                <p className="mt-2 text-sm text-[var(--cf-text-secondary)]">documentos procesados por ChileFlota</p>
                <div className="mt-6 flex items-center gap-3 border-t border-[var(--cf-border)] pt-4 text-xs text-[var(--cf-text-muted)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--cf-accent)]" aria-hidden="true" />
                  Sólo evidencia agregada pública
                </div>
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
