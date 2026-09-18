import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ArrowRight,
  BellRing,
  FileCheck2,
  FileClock,
  FolderSearch2,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react"

export const revalidate = 300

type PublicDocumentProof = {
  total: number
  approved: number
  pending: number
  rejected: number
}

async function getPublicDocumentProof(): Promise<PublicDocumentProof | null> {
  try {
    const supabase = createAdminClient()

    const [
      subcontractorTotal,
      subcontractorApproved,
      subcontractorPending,
      subcontractorRejected,
      uploadedTotal,
      uploadedApproved,
      uploadedPending,
      uploadedRejected,
    ] = await Promise.all([
      supabase.from("subcontractor_documents").select("id", { count: "exact", head: true }),
      supabase.from("subcontractor_documents").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("subcontractor_documents").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("subcontractor_documents").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("uploaded_documents").select("id", { count: "exact", head: true }),
      supabase.from("uploaded_documents").select("id", { count: "exact", head: true }).eq("validation_status", "approved"),
      supabase.from("uploaded_documents").select("id", { count: "exact", head: true }).eq("validation_status", "pending"),
      supabase.from("uploaded_documents").select("id", { count: "exact", head: true }).eq("validation_status", "rejected"),
    ])

    const results = [
      subcontractorTotal,
      subcontractorApproved,
      subcontractorPending,
      subcontractorRejected,
      uploadedTotal,
      uploadedApproved,
      uploadedPending,
      uploadedRejected,
    ]

    if (results.some((result) => result.error)) {
      console.error("[landing] Could not load public operational proof")
      return null
    }

    return {
      total: Number(subcontractorTotal.count || 0) + Number(uploadedTotal.count || 0),
      approved: Number(subcontractorApproved.count || 0) + Number(uploadedApproved.count || 0),
      pending: Number(subcontractorPending.count || 0) + Number(uploadedPending.count || 0),
      rejected: Number(subcontractorRejected.count || 0) + Number(uploadedRejected.count || 0),
    }
  } catch (error) {
    console.error("[landing] Public operational proof failed:", error instanceof Error ? error.message : String(error))
    return null
  }
}

const operations = [
  {
    icon: UsersRound,
    index: "01",
    title: "Transportistas",
    description: "Estado documental consolidado por empresa, responsable y periodo exigible.",
  },
  {
    icon: UserRoundCheck,
    index: "02",
    title: "Conductores",
    description: "Carpeta individual con requisitos, vigencias, observaciones y evidencia disponible.",
  },
  {
    icon: Truck,
    index: "03",
    title: "Vehículos",
    description: "Documentación por patente para revisar rápidamente si una unidad está operativamente respaldada.",
  },
  {
    icon: FileCheck2,
    index: "04",
    title: "Documentos",
    description: "Una lectura común para carga, revisión, aprobación, rechazo, vigencia e historial.",
  },
]

const workflow = [
  {
    number: "01",
    title: "Recibir",
    text: "La evidencia entra desde el flujo operativo y queda vinculada a la entidad correspondiente.",
  },
  {
    number: "02",
    title: "Ordenar",
    text: "ChileFlota estructura tipo documental, periodo, responsable, estado y vigencia en un mismo modelo.",
  },
  {
    number: "03",
    title: "Revisar",
    text: "El equipo identifica qué requiere validación, qué está observado y qué ya cuenta con respaldo aprobado.",
  },
  {
    number: "04",
    title: "Resolver",
    text: "Alertas, prioridades y trazabilidad convierten la información documental en acción operacional.",
  },
]

const questions = [
  {
    icon: FolderSearch2,
    label: "Qué falta",
    text: "Requisitos pendientes o sin evidencia suficiente para la operación actual.",
  },
  {
    icon: FileClock,
    label: "Qué vence",
    text: "Vigencias que necesitan atención antes de transformarse en una detención o bloqueo.",
  },
  {
    icon: ShieldCheck,
    label: "Qué está respaldado",
    text: "Documentos aprobados, historial y evidencia disponible para auditoría y mandantes.",
  },
]

export default async function LandingPage() {
  const documentProof = await getPublicDocumentProof()
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
              <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[#777C84]">Compliance operacional</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#777C84] sm:inline">Acceso clientes</span>
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[5px] bg-[#742D3D] px-4 text-sm font-medium text-[#F2F0EB] transition-colors hover:bg-[#87364A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87364A]"
            >
              Ingresar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-32 sm:px-6 sm:pb-28 sm:pt-40 lg:px-8 lg:pb-32">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:gap-20">
          <div>
            <div className="mb-7 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#A9ADB3]">
              <span className="h-px w-8 bg-[#742D3D]" />
              Control documental operacional
            </div>

            <h1 className="max-w-4xl text-5xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[78px]">
              La operación documental de flota, en una sola lectura.
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-[#A9ADB3] sm:text-lg sm:leading-8">
              ChileFlota conecta transportistas, conductores, vehículos, requisitos, vigencias y evidencia para que cada operación pueda revisar, priorizar y actuar sin reconstruir información entre planillas, correos y mensajes.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[5px] bg-[#742D3D] px-5 text-sm font-semibold text-[#F2F0EB] transition-colors hover:bg-[#87364A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87364A]"
              >
                Acceso clientes
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#alcance"
                className="inline-flex h-12 items-center justify-center px-5 text-sm font-medium text-[#C6C8CC] transition-colors hover:text-[#F2F0EB]"
              >
                Ver alcance operacional
              </a>
            </div>
          </div>

          <div className="border-t border-[#454850] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="mb-7 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">Vista operacional</p>
              <span className="flex items-center gap-2 text-[11px] text-[#9CC5B1]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#39765B]" />
                Sistema activo
              </span>
            </div>

            <div className="space-y-px bg-[#303238]">
              {[
                ["Transportistas", "Estado consolidado", "Empresa + periodo"],
                ["Conductores", "Carpeta individual", "Persona + requisito"],
                ["Documentación", "Evidencia trazable", "Tipo + vigencia"],
                ["Alertas", "Acción priorizada", "Riesgo + responsable"],
              ].map(([name, value, meta]) => (
                <div key={name} className="grid grid-cols-[1fr_auto] gap-5 bg-[#181A1D] px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-[#E4E1DC]">{name}</p>
                    <p className="mt-1 text-xs text-[#777C84]">{meta}</p>
                  </div>
                  <p className="self-center text-right text-xs text-[#A9ADB3]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 border-l-2 border-[#742D3D] bg-[#181A1D] px-4 py-3">
              <BellRing className="mt-0.5 h-4 w-4 flex-none text-[#CBB8BD]" aria-hidden="true" />
              <p className="text-xs leading-5 text-[#A9ADB3]">
                La prioridad no es acumular documentos. Es saber qué requiere acción y qué evidencia respalda la operación.
              </p>
            </div>
          </div>
        </div>
      </section>

      {documentProof && documentProof.total > 0 && (
        <section className="border-y border-[#303238] bg-[#151618] px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CC5B1]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#39765B]" />
                Evidencia operacional real
              </div>
              <p className="mt-5 text-5xl font-medium tracking-[-0.055em] text-[#F2F0EB] sm:text-6xl">
                {formatNumber.format(documentProof.total)}
              </p>
              <h2 className="mt-3 max-w-xl text-xl font-medium tracking-[-0.025em] text-[#E4E1DC] sm:text-2xl">
                documentos procesados por la implementación activa.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#A9ADB3]">
                Esta cifra se calcula desde registros reales de ChileFlota y se actualiza automáticamente. Se publica sólo información agregada: no expone archivos, nombres, RUT ni datos personales.
              </p>
            </div>

            <div className="grid gap-px bg-[#303238] sm:grid-cols-3">
              {[
                ["Aprobados", documentProof.approved, "Evidencia validada"],
                ["Pendientes", documentProof.pending, "En revisión operacional"],
                ["Rechazados", documentProof.rejected, "Con observación registrada"],
              ].map(([label, value, detail]) => (
                <div key={String(label)} className="bg-[#181A1D] p-5 sm:p-6">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#777C84]">{label}</p>
                  <p className="mt-3 text-3xl font-medium tracking-[-0.04em] text-[#F2F0EB]">
                    {formatNumber.format(Number(value))}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#8F949B]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="alcance" className="border-y border-[#303238] bg-[#151618] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">01 / Plataforma</p>
              <h2 className="mt-4 max-w-md text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
                Una capa común de cumplimiento para operaciones de transporte.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#A9ADB3]">
                ChileFlota organiza entidades, requisitos, estados documentales y trazabilidad en un modelo operativo que puede adaptarse a distintas flotas, transportistas y contratistas.
              </p>
            </div>

            <div className="grid gap-px bg-[#303238] sm:grid-cols-2">
              {operations.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="min-h-52 bg-[#181A1D] p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <Icon className="h-5 w-5 text-[#B36A79]" aria-hidden="true" />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-[#5F636A]">{item.index}</span>
                    </div>
                    <h3 className="mt-10 text-lg font-medium tracking-[-0.02em]">{item.title}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-[#A9ADB3]">{item.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">02 / Flujo común</p>
              <h2 className="mt-4 max-w-md text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
                Desde la evidencia hasta la decisión.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#A9ADB3]">
                El valor está en mantener una misma lógica de estado a través de toda la operación, no en sumar más pantallas.
              </p>
            </div>

            <div className="divide-y divide-[#303238] border-y border-[#303238]">
              {workflow.map((item) => (
                <div key={item.number} className="grid gap-4 py-6 sm:grid-cols-[64px_160px_1fr] sm:items-start sm:gap-6">
                  <span className="font-mono text-xs text-[#B36A79]">{item.number}</span>
                  <h3 className="text-base font-medium">{item.title}</h3>
                  <p className="max-w-xl text-sm leading-6 text-[#A9ADB3]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#303238] bg-[#181A1D] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">03 / Lectura ejecutiva</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
              Tres preguntas que el sistema debe responder sin buscar en Excel.
            </h2>
          </div>

          <div className="mt-12 grid gap-px bg-[#303238] lg:grid-cols-3">
            {questions.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.label} className="bg-[#151618] p-7 lg:min-h-64">
                  <Icon className="h-5 w-5 text-[#B36A79]" aria-hidden="true" />
                  <h3 className="mt-12 text-2xl font-medium tracking-[-0.03em]">{item.label}</h3>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-[#A9ADB3]">{item.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">04 / Implementación activa</p>
            <h2 className="mt-4 max-w-md text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
              Transportes Labbe es una implementación de ChileFlota.
            </h2>
          </div>
          <div className="border-l-2 border-[#742D3D] bg-[#181A1D] p-6 sm:p-8">
            <p className="text-sm font-medium text-[#E4E1DC]">Cliente actual</p>
            <p className="mt-3 text-2xl font-medium tracking-[-0.03em]">Transportes Labbe</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#A9ADB3]">
              La instancia operativa disponible hoy está configurada para el equipo Labbe. La plataforma y su arquitectura permanecen preparadas para incorporar nuevas operaciones sin convertir al cliente en la identidad del producto.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-[#303238] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 border-l-2 border-[#742D3D] pl-6 sm:pl-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#777C84]">Acceso clientes</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-5xl">
              Una sola entrada. Una sola lectura operacional.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#A9ADB3]">
              El acceso disponible actualmente conduce a la instancia operativa de Transportes Labbe.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[5px] bg-[#742D3D] px-5 text-sm font-semibold text-[#F2F0EB] transition-colors hover:bg-[#87364A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87364A] sm:w-auto"
          >
            Ingresar a Transportes Labbe
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#303238] px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-[#777C84] sm:flex-row sm:items-center sm:justify-between">
          <span>ChileFlota · Compliance documental y control operacional</span>
          <span>Implementación activa: Transportes Labbe</span>
        </div>
      </footer>
    </main>
  )
}
