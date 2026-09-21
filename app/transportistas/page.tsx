import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Control documental de transportistas",
  description: "ChileFlota consolida evidencia, documentos, vigencias y estado observado por empresa transportista.",
  alternates: { canonical: "/transportistas" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Transportistas"
    title="Estado documental consolidado por empresa transportista"
    description="ChileFlota reúne identidad, documentos actuales y señales de cumplimiento observadas para que cada empresa pueda revisarse desde una sola lectura operacional."
    sections={[
      { title: "Identidad empresarial", text: "RUT, razón social y contexto operacional se utilizan para resolver correctamente la entidad antes de revisar evidencia." },
      { title: "Documentos actuales", text: "Los estados se construyen sobre documentos vigentes o actuales, evitando mezclar versiones históricas con el presente." },
      { title: "Cumplimiento observado", text: "El sistema puede resumir aprobados, pendientes y rechazados sin convertir esa lectura parcial en una certificación de aptitud." },
      { title: "Búsqueda inteligente", text: "La búsqueda autenticada permite resolver empresas por RUT o nombre y abrir su evidencia existente." },
    ]}
    related={[{ href: "/compliance-transporte", label: "Compliance transporte" }, { href: "/gestion-documental-flotas", label: "Gestión documental" }, { href: "/flotas", label: "Flotas" }]}
  />
}
