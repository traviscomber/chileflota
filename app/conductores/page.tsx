import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Control documental de conductores",
  description: "ChileFlota organiza identidad, licencias, documentos, vigencias y observaciones de conductores para operaciones de transporte.",
  alternates: { canonical: "/conductores" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Conductores"
    title="Documentación y evidencia operacional por conductor"
    description="Cada conductor puede revisarse desde su identidad, documentos actuales, vigencias y evidencia disponible, manteniendo una lectura común con el resto de la operación."
    sections={[
      { title: "Identidad y RUT", text: "La búsqueda y las vistas operativas trabajan sobre la identidad del conductor para reducir ambigüedad entre documentos." },
      { title: "Licencias y vigencias", text: "Las fechas relevantes se presentan junto con el estado documental observado para facilitar priorización." },
      { title: "Documentos actuales", text: "ChileFlota diferencia evidencia vigente de versiones históricas para evitar mezclar estados operativos con archivos antiguos." },
      { title: "Inteligencia operacional", text: "El buscador inteligente puede resolver conductores por nombre o RUT y responder consultas documentales de forma read-only." },
    ]}
    related={[{ href: "/gestion-documental-flotas", label: "Gestión documental" }, { href: "/inteligencia-operacional", label: "Inteligencia operacional" }, { href: "/flotas", label: "Flotas" }]}
  />
}
