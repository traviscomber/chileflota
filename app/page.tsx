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
      <svg
        viewBox="0 0 1600 760"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="presentation"
      >
        <rect width="1600" height="760" fill="var(--cf-canvas)" />
        <rect x="730" y="0" width="870" height="760" fill="var(--cf-sidebar)" />
        <path d="M0 600 H1600" stroke="var(--cf-border)" strokeWidth="1" />
        <path d="M1020 0 V760" stroke="var(--cf-border)" strokeWidth="1" opacity="0.5" />

        <g opacity="0.7">
          <path d="M0 110 H1600 M0 190 H1600 M0 270 H1600 M0 350 H1600 M0 430 H1600 M0 510 H1600" stroke="var(--cf-border)" strokeWidth="1" opacity="0.18" />
          <path d="M800 0 V760 M880 0 V760 M960 0 V760 M1040 0 V760 M1120 0 V760 M1200 0 V760 M1280 0 V760 M1360 0 V760 M1440 0 V760" stroke="var(--cf-border)" strokeWidth="1" opacity="0.18" />
        </g>

        <g transform="translate(780 118)">
          <g>
            <rect x="0" y="16" width="170" height="82" fill="var(--cf-surface)" stroke="var(--cf-border)" />
            <rect x="20" y="34" width="70" height="8" fill="var(--cf-text-muted)" opacity="0.45" />
            <rect x="20" y="56" width="110" height="2" fill="var(--cf-border)" />
            <circle cx="148" cy="57" r="5" fill="var(--cf-accent)" />
          </g>
          <g transform="translate(18 118)">
            <rect x="0" y="0" width="170" height="82" fill="var(--cf-surface)" stroke="var(--cf-border)" />
            <rect x="20" y="18" width="54" height="8" fill="var(--cf-text-muted)" opacity="0.45" />
            <rect x="20" y="40" width="110" height="2" fill="var(--cf-border)" />
            <circle cx="148" cy="41" r="5" fill="var(--cf-accent)" />
          </g>
          <g transform="translate(0 220)">
            <rect x="0" y="0" width="170" height="82" fill="var(--cf-surface)" stroke="var(--cf-border)" />
            <rect x="20" y="18" width="66" height="8" fill="var(--cf-text-muted)" opacity="0.45" />
            <rect x="20" y="40" width="112" height="2" fill="var(--cf-border)" />
            <circle cx="148" cy="41" r="5" fill="var(--cf-accent)" />
          </g>
          <g transform="translate(18 322)">
            <rect x="0" y="0" width="170" height="82" fill="var(--cf-surface)" stroke="var(--cf-border)" />
            <rect x="20" y="18" width="58" height="8" fill="var(--cf-text-muted)" opacity="0.45" />
            <rect x="20" y="40" width="104" height="2" fill="var(--cf-border)" />
            <circle cx="148" cy="41" r="5" fill="var(--cf-accent)" />
          </g>
        </g>

        <g transform="translate(1010 144)">
          <rect x="0" y="0" width="300" height="392" fill="var(--cf-canvas)" stroke="var(--cf-border)" strokeWidth="1.2" />
          <rect x="0" y="0" width="300" height="54" fill="var(--cf-surface)" />
          <rect x="20" y="21" width="88" height="8" fill="var(--cf-text-secondary)" opacity="0.45" />
          <circle cx="270" cy="27" r="4" fill="var(--cf-text-muted)" />
          <circle cx="284" cy="27" r="4" fill="var(--cf-text-muted)" />
          {[0, 1, 2, 3].map((row) => (
            <g key={row} transform={`translate(0 ${54 + row * 82})`}>
              <rect x="0" y="0" width="300" height="82" fill="var(--cf-canvas)" stroke="var(--cf-border)" />
              <rect x="22" y="24" width="108" height="8" fill="var(--cf-text-secondary)" opacity="0.6" />
              <rect x="22" y="45" width="72" height="2" fill="var(--cf-border)" />
              <circle cx="262" cy="39" r="17" fill="var(--cf-accent-soft)" />
              <path d="M254 39 l6 6 11 -14" fill="none" stroke="var(--cf-focus-ring)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </g>

        <g fill="none" strokeWidth="1.5">
          <path d="M948 175 C980 175 980 185 1010 185" stroke="var(--cf-accent)" />
          <path d="M966 277 C990 277 990 267 1010 267" stroke="var(--cf-border)" />
          <path d="M948 379 C980 379 980 349 1010 349" stroke="var(--cf-accent)" />
          <path d="M966 481 C990 481 990 431 1010 431" stroke="var(--cf-border)" />
          <path d="M1310 340 C1370 340 1370 380 1428 380" stroke="var(--cf-accent)" />
        </g>

        <g transform="translate(1380 324)">
          <path d="M0 150 H176 V79 H132 L106 46 H44 L20 82 H0 Z" fill="var(--cf-surface-raised)" stroke="var(--cf-border)" />
          <rect x="32" y="94" width="96" height="38" fill="var(--cf-sidebar)" />
          <path d="M132 79 H176 V150 H132 Z" fill="var(--cf-surface)" />
          <circle cx="43" cy="151" r="19" fill="var(--cf-canvas)" stroke="var(--cf-text-muted)" />
          <circle cx="143" cy="151" r="19" fill="var(--cf-canvas)" stroke="var(--cf-text-muted)" />
          <rect x="62" y="58" width="45" height="27" fill="var(--cf-canvas)" stroke="var(--cf-border)" />
          <path d="M0 150 H176" stroke="var(--cf-accent)" strokeWidth="2" />
        </g>

        <g opacity="0.75">
          <path d="M1340 555 H1600" stroke="var(--cf-border)" />
          <path d="M1320 582 H1600" stroke="var(--cf-border)" />
          <path d="M1468 250 V550" stroke="var(--cf-border)" />
          <path d="M1518 220 V550" stroke="var(--cf-border)" />
          <path d="M1568 190 V550" stroke="var(--cf-border)" />
        </g>

        <circle cx="1452" cy="286" r="30" fill="var(--cf-accent)" />
        <path d="M1439 286 l10 10 18 -24" fill="none" stroke="var(--cf-text)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="710" y="0" width="120" height="760" fill="var(--cf-canvas)" opacity="0.82" />
      </svg>
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

      <section className="relative min-h-[720px] overflow-hidden border-b border-[var(--cf-border)] pt-16">
        <HeroOperationalBackdrop />

        <div className="relative z-10 mx-auto flex min-h-[720px] max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
          <div className="grid flex-1 items-center py-16 lg:grid-cols-[0.72fr_1.28fr] lg:py-20">
            <div className="max-w-xl bg-[var(--cf-canvas)]/95 pr-0 lg:pr-10">
              <SectionIndex>Control documental de flota</SectionIndex>
              <h1 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-5xl lg:text-[64px]">
                Cumplimiento documental para una operación continua.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[var(--cf-text-secondary)]">
                Evidencia, vigencias y revisión documental en una sola lectura operacional.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--cf-radius)] bg-[var(--cf-accent)] px-5 text-sm font-medium text-[var(--cf-text)] transition-colors hover:bg-[var(--cf-accent-hover)]"
                >
                  Ingresar a la plataforma
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#modelo-operacional"
                  className="inline-flex h-11 items-center justify-center rounded-[var(--cf-radius)] border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-5 text-sm font-medium text-[var(--cf-text-secondary)] transition-colors hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]"
                >
                  Ver modelo operacional
                </a>
              </div>
            </div>
          </div>

          <div className="grid border-t border-[var(--cf-border)] bg-[var(--cf-sidebar)] sm:grid-cols-[1.4fr_1fr_1fr]">
            <div className="px-5 py-5 sm:px-6">
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Actividad registrada</p>
              {processedDocumentCount !== null && processedDocumentCount > 0 ? (
                <p className="mt-1 text-4xl font-semibold tracking-[-0.045em] text-[var(--cf-text)]">
                  {formatNumber.format(processedDocumentCount)}
                </p>
              ) : (
                <p className="mt-1 text-lg font-semibold text-[var(--cf-text)]">Operación activa</p>
              )}
              <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">documentos procesados por ChileFlota</p>
            </div>

            <div className="border-t border-[var(--cf-border)] px-5 py-5 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Implementación productiva</p>
              <p className="mt-2 text-base font-semibold text-[var(--cf-text)]">Transportes Labbe</p>
              <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">control documental operacional</p>
            </div>

            <div className="border-t border-[var(--cf-border)] px-5 py-5 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-xs font-medium text-[var(--cf-text-muted)]">Lectura de operación</p>
              <p className="mt-2 text-base font-semibold text-[var(--cf-text)]">Faltantes · vigencias · respaldo</p>
              <p className="mt-1 text-sm text-[var(--cf-text-secondary)]">sin exponer datos personales</p>
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
