export const MULTI_INSTANCE_DOCUMENT_CODES = new Set([
  'LIQUIDACION_SUELDO',
  'HOJA_VIDA',
  'CERT_ANTECEDENTES',
  'CERT_COTIZACIONES',
  'COMPROBANTE_PAGO',
  'PLANILLAS_IMPOSICIONES',
  'FOTO_PATENTES',
  'PENSION',
  'F30-1_CLIENTE',
  'CERT_TASAS_MUTUAL',
])

export function isMultiInstanceDocumentCode(code: string | null | undefined): boolean {
  return Boolean(code && MULTI_INSTANCE_DOCUMENT_CODES.has(code))
}

export function buildExactDocumentSlotKey(input: {
  subcontractorId: string | null | undefined
  documentTypeId: string | null | undefined
  periodYear: number | string | null | undefined
  periodMonth: number | string | null | undefined
}): string | null {
  const { subcontractorId, documentTypeId, periodYear, periodMonth } = input
  if (!subcontractorId || !documentTypeId || !periodYear || !periodMonth) return null
  return `${subcontractorId}:${documentTypeId}:${periodYear}:${periodMonth}`
}
