import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Gestión y compliance de flotas en Chile",
  description: "ChileFlota organiza documentación, vigencias, evidencia y excepciones para operaciones de flota en Chile.",
  alternates: { canonical: "/flotas" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Flotas en Chile"
    title="Gestión documental y compliance operacional para flotas"
    description="ChileFlota conecta empresas, conductores, vehículos, documentos y alertas en una misma lectura operacional para reducir reconstrucción manual entre planillas, correos y mensajes."
    sections={[
      { title: "Estado por entidad", text: "Consolida evidencia disponible por empresa, conductor y vehículo sin perder el contexto de cada fuente." },
      { title: "Vigencias y excepciones", text: "Permite priorizar documentos pendientes, rechazados, vencidos o próximos a vencer desde una lógica común." },
      { title: "Trazabilidad", text: "Mantiene historial, revisiones y versiones para que cada decisión documental pueda explicarse con evidencia." },
      { title: "Lectura operacional", text: "El objetivo no es acumular archivos: es identificar qué requiere atención y qué está respaldado." },
    ]}
    related={[{ href: "/compliance-transporte", label: "Compliance de transporte" }, { href: "/gestion-documental-flotas", label: "Gestión documental" }, { href: "/chile", label: "ChileFlota en Chile" }]}
  />
}
