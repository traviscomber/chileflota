import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Control documental de vehículos y PRT",
  description: "ChileFlota organiza documentación por patente, historial PRT y evidencia operacional para flotas de transporte.",
  alternates: { canonical: "/vehiculos" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Vehículos"
    title="Documentación por patente y evidencia operacional de vehículos"
    description="ChileFlota conecta documentación del vehículo, patente, historial disponible y evidencia externa para apoyar una revisión operacional trazable."
    sections={[
      { title: "Identidad por patente", text: "La unidad se resuelve por su identidad vehicular antes de asociar documentos o antecedentes de revisión." },
      { title: "PRT e historial", text: "La evidencia PRT puede incorporarse como fuente externa con trazabilidad, sin sobrescribir silenciosamente la fuente original." },
      { title: "Documentos y vigencias", text: "Los documentos relevantes del vehículo se organizan junto con fechas y estados observados." },
      { title: "Reconciliación", text: "Cuando distintas fuentes no coinciden, ChileFlota prioriza la reconciliación explícita en vez de ocultar la discrepancia." },
    ]}
    related={[{ href: "/flotas", label: "Flotas" }, { href: "/gestion-documental-flotas", label: "Gestión documental" }, { href: "/compliance-transporte", label: "Compliance transporte" }]}
  />
}
