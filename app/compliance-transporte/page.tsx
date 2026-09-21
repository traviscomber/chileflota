import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Compliance operacional de transporte en Chile",
  description: "ChileFlota conecta evidencia documental, vigencias, revisión y prioridades para operaciones de transporte en Chile.",
  alternates: { canonical: "/compliance-transporte" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Compliance de transporte"
    title="Compliance operacional basado en evidencia para transporte"
    description="ChileFlota transforma evidencia documental dispersa en estados observables, trazables y accionables para equipos que necesitan saber qué falta, qué vence y qué requiere revisión."
    sections={[
      { title: "Evidencia antes que inferencia", text: "Cada estado debe poder explicarse desde documentos, vigencias, revisiones o fuentes externas disponibles." },
      { title: "Excepciones visibles", text: "Los casos que requieren atención se separan de la operación rutinaria para reducir revisión manual innecesaria." },
      { title: "Estados conservadores", text: "La ausencia de evidencia no se convierte automáticamente en cumplimiento ni en aprobación operacional." },
      { title: "Acción trazable", text: "Las prioridades se conectan con la entidad y evidencia que originaron la excepción." },
    ]}
    related={[{ href: "/flotas", label: "Gestión de flotas" }, { href: "/gestion-documental-flotas", label: "Gestión documental" }, { href: "/inteligencia-operacional", label: "Inteligencia operacional" }]}
  />
}
