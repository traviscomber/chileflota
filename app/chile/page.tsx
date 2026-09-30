import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "ChileFlota en Chile | Compliance para flotas",
  description: "ChileFlota es una plataforma de N3uralia para compliance operacional de flotas y transporte en Chile.",
  alternates: { canonical: "/chile" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Chile"
    title="ChileFlota: compliance operacional para flotas en Chile"
    description="ChileFlota es una plataforma desarrollada por N3uralia para organizar evidencia, vigencias, transportistas, conductores, vehículos y excepciones operacionales en una misma capa de cumplimiento."
    sections={[
      { title: "Producto", text: "ChileFlota es el producto. N3uralia provee la tecnología y Transportes Labbé es una implementación activa del sistema." },
      { title: "Mercado objetivo", text: "La plataforma está orientada a operaciones de transporte, flotas, contratistas y equipos que gestionan cumplimiento documental en Chile." },
      { title: "Problema que resuelve", text: "Reduce la fragmentación entre planillas, correos, carpetas y mensajes al mantener estados y evidencia dentro de un modelo común." },
      { title: "Arquitectura operativa", text: "Evidence → canonical state → operational decision → action → outcome → telemetry → improved decision." },
    ]}
    related={[{ href: "/flotas", label: "Flotas en Chile" }, { href: "/compliance-transporte", label: "Compliance transporte" }, { href: "/gestion-documental-flotas", label: "Gestión documental" }]}
  />
}
