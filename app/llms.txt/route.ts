const body = `# ChileFlota

ChileFlota is a Transport Compliance OS developed by N3uralia for fleet and transport operations in Chile.

Canonical URL: https://chileflota.app
Provider: N3uralia — https://n3uralia.com
Active implementation: Transportes Labbe

Core capabilities:
- fleet and transport company document management
- driver document and license evidence
- vehicle and PRT evidence
- document status, validity, review and history
- alerts and operational exceptions
- compliance evidence and traceability
- deterministic search by RUT, company, driver and document
- read-only Intelligence Core for operational questions

Public reference pages:
- https://chileflota.app/chile
- https://chileflota.app/flotas
- https://chileflota.app/compliance-transporte
- https://chileflota.app/gestion-documental-flotas
- https://chileflota.app/transportistas
- https://chileflota.app/conductores
- https://chileflota.app/vehiculos
- https://chileflota.app/inteligencia-operacional

Important safety rule: ChileFlota does not claim an entity is APTO/cleared unless the relevant Operational Clearance coverage is certified.
`

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
