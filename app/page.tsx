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

const workQuestions = [
  {
    icon: FolderSearch2,
    eyebrow: "Cobertura",
    title: "Qué falta",
    text: "Requisitos sin respaldo suficiente para el periodo operativo vigente.",
  },
  {
    icon: FileClock,
    eyebrow: "Vigencia",
    title: "Qué vence",
    text: "Documentación que requiere atención antes de afectar continuidad operacional.",
  },
  {
    icon: FileCheck2,
    eyebrow: "Evidencia",
    title: "Qué está respaldado",
    text: "Documentación validada y disponible para revisión, auditoría o mandante.",
  },
]

export default async function LandingPage() {
  const processedDocumentCount = await getPublicProcessedDocumentCount()
  const formatNumber = new Intl.NumberFormat("es-CL")

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#111214] text-[#F2F0EB]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#303238] bg-[#111214]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="ChileFlota inicio">
            <div className="flex h-8 w-8 items-center justify-center border border-[#454850] bg-[#181A1D]">
              <ShieldCheck className="h-4 w-4 text-[#B36A79]" aria-hidden="true" />
            </div>
            <div className="leading-none">
              <span className="block text-sm font-semibold tracking-[-0.02em]">ChileFlota</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[#777C84]">
                Compliance operacional
              </span>
            </div>
          </Link>

          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[5px] bg-[#742D3D] px-4 text-sm font-medium text-[#F2F0EB] transition-colors hover:bg-[#87364A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87364A]"
          >
            Acceder a la plataforma
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-32 sm:px-6 sm:pb-24 sm:pt-40 lg:px-8 lg:pb-28">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-5xl">
            <div className="mb-7 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#A9ADB3]">
              <span className="h-px w-8 bg-[#742D3D]" />
              Control documental de flota
            </div>

            <h1 className="text-5xl font-medium leading-[0.96] tracking-[-0.06em] sm:text-6xl lg:text-[82px]">
              Cumplimiento documental
              <span className="block text-[#B36A79]">para una operación continua.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-base leading-7 text-[#A9ADB3] sm:text-lg sm:leading-8">
              ChileFlota centraliza evidencia, vigencias y revisión documental para que la operación pueda determinar con claridad qué está habilitado, qué requiere atención y qué debe resolverse.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[5px] bg-[#742D3D] px-5 text-sm font-semibold text-[#F2F0EB] transition-colors hover:bg-[#87364A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87364A]"
              >
                Ingresar a la plataforma
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#como-cambia"
                className="inline-flex h-12 items-center justify-center px-5 text-sm font-medium text-[#C6C8CC] transition-colors hover:text-[#F2F0EB]"
              >
                Ver modelo operacional
              </a>
            </div>
          </div>

          {processedDocumentCount !== null && processedDocumentCount > 0 && (
            <div className="mt-16 grid gap-5 border-t border-[#303238] pt-6 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-8 lg:mt-20">
              <p className="text-5xl font-medium tracking-[-0.055em] text-[#F2F0EB] sm:text-6xl">
                {formatNumber.format(processedDocumentCount)}
              </p>
              <div className="max-w-xl pb-1">
                <p className="text-lg font-medium tracking-[-0.02em] text-[#E4E1DC]">
                  documentos procesados por ChileFlota.
                </p>
                <p className="mt-1 text-xs text-[#777C84]">
                  Actividad agregada de la implementación activa. Sin exposición de documentos ni datos personales.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-[#303238] bg-[#151618] px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">
                01 / Riesgo operacional
              </p>
              <h2 className="mt-4 max-w-md text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
                La documentación forma parte de la continuidad operacional.
              </h2>
            </div>

            <div className="space-y-0 border-y border-[#303238]">
              {[
                ["Evidencia distribuida", "La información llega desde múltiples actores y canales."],
                ["Vigencias variables", "Cada requisito tiene periodo, estado y condición de uso."],
                ["Decisión operacional", "La organización necesita saber si existe respaldo suficiente para operar."],
              ].map(([title, text], index) => (
                <div
                  key={title}
                  className="grid gap-3 border-b border-[#303238] py-6 last:border-b-0 sm:grid-cols-[56px_180px_1fr] sm:items-baseline sm:gap-6"
                >
                  <span className="font-mono text-xs text-[#B36A79]">0{index + 1}</span>
                  <p className="text-base font-medium text-[#E4E1DC]">{title}</p>
                  <p className="max-w-xl text-sm leading-6 text-[#8F949B]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-cambia" className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">
              02 / Modelo de control
            </p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              Una sola lectura
              <span className="block text-[#B36A79]">para revisar, resolver y demostrar.</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-px bg-[#303238] lg:grid-cols-3">
            {[
              ["Consolidar", "La evidencia queda vinculada a la empresa, persona o unidad correspondiente."],
              ["Priorizar", "El sistema ordena requisitos, periodos y vigencias para hacer visible lo que requiere atención."],
              ["Resolver", "El equipo revisa, valida y mantiene trazabilidad sobre cada decisión documental."],
            ].map(([title, text], index) => (
              <article key={title} className="min-h-64 bg-[#181A1D] p-7 sm:p-8">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[#5F636A]">0{index + 1}</span>
                <h3 className="mt-16 text-2xl font-medium tracking-[-0.03em]">{title}</h3>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[#A9ADB3]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#303238] bg-[#181A1D] px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">
                03 / Lectura operacional
              </p>
              <h2 className="mt-4 max-w-md text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
                La operación necesita respuestas verificables.
              </h2>
            </div>

            <div className="grid gap-px bg-[#303238] sm:grid-cols-3">
              {workQuestions.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="bg-[#151618] p-6 sm:p-7">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-[#B36A79]" aria-hidden="true" />
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[#5F636A]">{item.eyebrow}</span>
                    </div>
                    <h3 className="mt-12 text-2xl font-medium tracking-[-0.03em]">{item.title}</h3>
                    <p className="mt-4 text-sm leading-6 text-[#8F949B]">{item.text}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 border-y border-[#303238] py-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20 lg:py-14">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">
                04 / Evidencia operacional
              </p>
              <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
                Implementación activa y operación registrada.
              </h2>
            </div>

            <div>
              <div className="flex items-center gap-3 text-sm font-medium text-[#E4E1DC]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#39765B] text-[#9CC5B1]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                Implementación activa
              </div>
              <p className="mt-4 text-2xl font-medium tracking-[-0.03em]">Transportes Labbe</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8F949B]">
                ChileFlota opera actualmente sobre una implementación productiva para el control y revisión documental de Transportes Labbe.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#303238] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div className="max-w-4xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">
              Acceso clientes
            </p>
            <h2 className="mt-4 text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Control documental
              <span className="block text-[#B36A79]">con criterio operacional.</span>
            </h2>
          </div>

          <Link
            href="/login"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[5px] bg-[#742D3D] px-5 text-sm font-semibold text-[#F2F0EB] transition-colors hover:bg-[#87364A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87364A] sm:w-auto"
          >
            Ingresar
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#303238] px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-[#777C84] sm:flex-row sm:items-center sm:justify-between">
          <span>ChileFlota · Compliance documental para flotas</span>
          <span>Implementación activa: Transportes Labbe</span>
        </div>
      </footer>
    </main>
  )
}
