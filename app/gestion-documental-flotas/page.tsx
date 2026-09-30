import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Gestión documental de flotas y transportistas",
  description: "Control documental de empresas, conductores y vehículos con vigencias, estados, historial y evidencia trazable.",
  alternates: { canonical: "/gestion-documental-flotas" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Gestión documental"
    title="Control documental para flotas, transportistas y conductores"
    description="ChileFlota organiza documentos por entidad, estado, vigencia y periodo para que la revisión no dependa de reconstruir información desde múltiples fuentes."
    sections={[
      { title: "Carga y clasificación", text: "La evidencia queda vinculada a la entidad correspondiente y puede ser clasificada según tipo documental y contexto operativo." },
      { title: "Aprobación y rechazo", text: "El flujo distingue estados revisados y mantiene trazabilidad sobre observaciones y decisiones humanas." },
      { title: "Versiones e historial", text: "Renovaciones y correcciones no eliminan silenciosamente la evidencia previa; el historial sigue disponible." },
      { title: "Vigencia operacional", text: "Las fechas relevantes ayudan a anticipar vencimientos y priorizar atención antes de que se conviertan en bloqueos." },
    ]}
    related={[{ href: "/conductores", label: "Conductores" }, { href: "/vehiculos", label: "Vehículos" }, { href: "/transportistas", label: "Transportistas" }]}
  />
}
