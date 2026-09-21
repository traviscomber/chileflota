const SINGLETON_SUBCONTRACTOR_CODES = new Set([
  'F29',
  'F30',
  'CERT_AFIL_MUTUAL',
  'F30-1_DOÑA_ISIDORA',
])

function normalizeFileName(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function periodKey(doc: any) {
  return [
    doc.document_period_year ?? 'na',
    doc.document_period_month ?? 'na',
  ].join(':')
}

function rowTime(doc: any) {
  const raw = doc.reviewed_at || doc.approved_at || doc.validated_at || doc.updated_at || doc.created_at || 0
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function newestByKey<T>(rows: T[], keyFor: (row: T) => string) {
  const selected = new Map<string, T>()
  for (const row of rows) {
    const key = keyFor(row)
    const current = selected.get(key)
    if (!current || rowTime(row) > rowTime(current)) selected.set(key, row)
  }
  return [...selected.values()]
}

export function isClearlyMisclassifiedSubcontractorDocument(doc: any, typeCode: string | null | undefined) {
  if (!['F30', 'F30-1_CLIENTE', 'F30-1_DOÑA_ISIDORA'].includes(typeCode || '')) return false

  const text = `${doc.ai_document_type || ''} ${doc.ai_extracted_text || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const isAntecedentes = text.includes('certificado de antecedentes laborales y previsionales')
  const isCumplimiento = text.includes('certificado de cumplimiento de obligaciones laborales y previsionales')

  // F30 and F30-1 are different Dirección del Trabajo certificates.
  // F30 = antecedentes laborales y previsionales.
  // F30-1 = cumplimiento de obligaciones laborales y previsionales.
  if (typeCode === 'F30') return isCumplimiento && !isAntecedentes
  return isAntecedentes && !isCumplimiento
}

export function canonicalizeApprovedSubcontractorDocuments(rows: any[], typeById: Map<string, any>) {
  const valid = rows.filter((doc) => {
    if (!doc.document_type_id || !normalizeFileName(doc.file_name)) return false
    const typeCode = typeById.get(doc.document_type_id)?.code
    return !isClearlyMisclassifiedSubcontractorDocument(doc, typeCode)
  })

  const singleton = valid.filter((doc) => SINGLETON_SUBCONTRACTOR_CODES.has(typeById.get(doc.document_type_id)?.code || ''))
  const multi = valid.filter((doc) => !SINGLETON_SUBCONTRACTOR_CODES.has(typeById.get(doc.document_type_id)?.code || ''))

  return [
    ...newestByKey(singleton, (doc) => `${doc.subcontractor_id}:${doc.document_type_id}:${periodKey(doc)}`),
    ...multi,
  ]
}

export function canonicalizeRejectedSubcontractorDocuments(
  rejectedRows: any[],
  approvedRows: any[],
  typeById: Map<string, any>,
) {
  const approved = canonicalizeApprovedSubcontractorDocuments(approvedRows, typeById)
  const approvedExact = new Set(approved.map((doc) => [
    doc.subcontractor_id,
    doc.document_type_id,
    periodKey(doc),
    normalizeFileName(doc.file_name),
  ].join(':')))
  const approvedSingletonSlots = new Set(
    approved
      .filter((doc) => SINGLETON_SUBCONTRACTOR_CODES.has(typeById.get(doc.document_type_id)?.code || ''))
      .map((doc) => [doc.subcontractor_id, doc.document_type_id, periodKey(doc)].join(':')),
  )

  const valid = rejectedRows.filter((doc) => {
    if (!doc.document_type_id || !normalizeFileName(doc.file_name)) return false
    const typeCode = typeById.get(doc.document_type_id)?.code
    if (isClearlyMisclassifiedSubcontractorDocument(doc, typeCode)) return false

    const slot = [doc.subcontractor_id, doc.document_type_id, periodKey(doc)].join(':')
    if (SINGLETON_SUBCONTRACTOR_CODES.has(typeCode || '') && approvedSingletonSlots.has(slot)) return false

    const exact = [slot, normalizeFileName(doc.file_name)].join(':')
    return !approvedExact.has(exact)
  })

  const singleton = valid.filter((doc) => SINGLETON_SUBCONTRACTOR_CODES.has(typeById.get(doc.document_type_id)?.code || ''))
  const multi = valid.filter((doc) => !SINGLETON_SUBCONTRACTOR_CODES.has(typeById.get(doc.document_type_id)?.code || ''))

  return [
    ...newestByKey(singleton, (doc) => `${doc.subcontractor_id}:${doc.document_type_id}:${periodKey(doc)}`),
    ...multi,
  ]
}

export function canonicalizeApprovedConductorDocuments(rows: any[]) {
  const valid = rows.filter((doc) => doc.document_type_id && normalizeFileName(doc.original_filename))
  return newestByKey(valid, (doc) => `${doc.conductor_id}:${doc.document_type_id}:${periodKey(doc)}`)
}

export function canonicalizeRejectedConductorDocuments(rejectedRows: any[], approvedRows: any[]) {
  const approved = canonicalizeApprovedConductorDocuments(approvedRows)
  const approvedSlots = new Set(approved.map((doc) => `${doc.conductor_id}:${doc.document_type_id}:${periodKey(doc)}`))

  const valid = rejectedRows.filter((doc) => {
    if (!doc.document_type_id || !normalizeFileName(doc.original_filename)) return false
    const slot = `${doc.conductor_id}:${doc.document_type_id}:${periodKey(doc)}`
    return !approvedSlots.has(slot)
  })

  return newestByKey(valid, (doc) => `${doc.conductor_id}:${doc.document_type_id}:${periodKey(doc)}`)
}
