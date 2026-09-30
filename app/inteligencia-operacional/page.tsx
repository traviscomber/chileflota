import type { Metadata } from "next"
import { PublicDiscoveryPage } from "@/components/public/public-discovery-page"

export const metadata: Metadata = {
  title: "Inteligencia operacional para flotas",
  description: "ChileFlota combina búsqueda determinística e Intelligence Core read-only para responder consultas de empresas, conductores y documentos con evidencia.",
  alternates: { canonical: "/inteligencia-operacional" },
}

export default function Page() {
  return <PublicDiscoveryPage
    eyebrow="Inteligencia operacional"
    title="Un buscador operacional conectado a evidencia real"
    description="ChileFlota integra búsqueda por RUT, empresa, conductor y documento con un Intelligence Core read-only que responde consultas operacionales sin reemplazar la evidencia canónica."
    sections={[
      { title: "Búsqueda determinística", text: "Las coincidencias exactas de RUT, empresa, conductor y documento mantienen un comportamiento inmediato y predecible." },
      { title: "Preguntas operacionales", text: "Las consultas sobre documentos y cumplimiento observado se resuelven mediante herramientas acotadas sobre fuentes autorizadas." },
      { title: "Evidencia primero", text: "Las respuestas distinguen hechos observados, interpretación, desconocidos y siguiente acción." },
      { title: "Guardrail de aptitud", text: "El sistema no declara APTO o cleared mientras la cobertura operacional completa no esté certificada por el contrato correspondiente." },
    ]}
    related={[{ href: "/conductores", label: "Conductores" }, { href: "/transportistas", label: "Transportistas" }, { href: "/compliance-transporte", label: "Compliance transporte" }]}
  />
}
