export const LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES = [
  'LIQUIDACION_SUELDO',
  'HOJA_VIDA',
  'CERT_ANTECEDENTES',
  'COMPROBANTE_PAGO',
  'PLANILLAS_IMPOSICIONES',
  'FOTO_PATENTES',
] as const

type PendingDocumentRow = {
  id: string
  subcontractor_rut: string | null
  document_type_id: string | null
  document_period_start: string | null
  document_period_month: number | null
  document_period_year: number | null
  version_number: number | null
  versioned_at: string | null
  updated_at: string | null
  created_at: string | null
  ai_analyzed_at: string | null
  ai_warnings: string[] | null
}

type ApprovedDocumentRow = {
  subcontractor_rut: string | null
  document_type_id: string | null
  document_period_start: string | null
  expires_at: string | null
}

type DocumentTypeRow = {
  id: string
  periodicidad: string | null
  es_obligatorio: boolean | null
  is_active: boolean | null
}

function normalizeRut(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^0-9k]/g, '')
}

function periodKey(doc: PendingDocumentRow) {
  if (doc.document_period_start) return doc.document_period_start.slice(0, 10)
  if (doc.document_period_year && doc.document_period_month) {
    return `${doc.document_period_year}-${String(doc.document_period_month).padStart(2, '0')}-01`
  }
  return `unperioded:${doc.id}`
}

function recencyValue(doc: PendingDocumentRow) {
  const version = doc.version_number || 0
  const timestamp = Date.parse(doc.versioned_at || doc.updated_at || doc.created_at || '') || 0
  return version * 10 ** 15 + timestamp
}

function monthIndex(value: string | null | undefined) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})/.exec(value)
  if (!match) return null
  return Number(match[1]) * 12 + Number(match[2]) - 1
}

function hasHardAttentionSignal(doc: PendingDocumentRow) {
  if (!doc.ai_analyzed_at) return true
  return (doc.ai_warnings || []).includes('page_1_unreadable')
}

function isCoveredByApproved(
  pending: PendingDocumentRow,
  periodicidad: string | null,
  approvedRows: ApprovedDocumentRow[],
) {
  const pendingPeriod = periodKey(pending)
  const pendingMonth = monthIndex(pendingPeriod)
  if (pendingMonth === null) return false

  const normalizedCadence = (periodicidad || '').trim().toLowerCase()
  const pendingRut = normalizeRut(pending.subcontractor_rut)

  return approvedRows.some((approved) => {
    if (normalizeRut(approved.subcontractor_rut) !== pendingRut) return false
    if (approved.document_type_id !== pending.document_type_id) return false

    const approvedMonth = monthIndex(approved.document_period_start)
    if (approvedMonth === null || approvedMonth > pendingMonth) return false
    const delta = pendingMonth - approvedMonth

    // Monthly compliance evidence is period-bound. Historical rows may carry a
    // legacy one-year expires_at generated when these document types were
    // incorrectly configured as annual; never let that stale expiry bridge months.
    if (normalizedCadence === 'mensual') return delta === 0

    if (approved.expires_at) {
      const expiry = Date.parse(approved.expires_at)
      const periodStart = Date.parse(pendingPeriod)
      if (Number.isFinite(expiry) && Number.isFinite(periodStart) && expiry >= periodStart) return true
    }

    if (normalizedCadence === 'anual') return delta <= 11
    if (normalizedCadence === 'trimestral') return delta <= 2
    return delta === 0
  })
}

/**
 * Executive dashboard semantics for "requires attention".
 *
 * This intentionally does NOT count every database row with status=pending.
 * A row only reaches the KPI when it belongs to an active transportista,
 * represents the latest current version for company/type/period, is an active
 * mandatory document type, is not already covered by approved evidence for its
 * cadence, and still has a hard processing signal (not analyzed or page 1 unreadable).
 *
 * Administrative pending rows remain unchanged in the database. This function
 * only defines the operational attention KPI.
 */
export async function countActionableSubcontractorPending(supabase: any): Promise<number> {
  const [pendingResult, typesResult, transportistasResult] = await Promise.all([
    supabase
      .from('subcontractor_documents')
      .select(
        'id,subcontractor_rut,document_type_id,document_period_start,document_period_month,document_period_year,version_number,versioned_at,updated_at,created_at,ai_analyzed_at,ai_warnings',
      )
      .eq('status', 'pending')
      .eq('is_current', true),
    supabase
      .from('subcontractor_document_types')
      .select('id,periodicidad,es_obligatorio,is_active'),
    supabase
      .from('transportistas')
      .select('rut')
      .eq('is_active', true),
  ])

  if (pendingResult.error) throw pendingResult.error
  if (typesResult.error) throw typesResult.error
  if (transportistasResult.error) throw transportistasResult.error

  const activeRuts = new Set(
    (transportistasResult.data || [])
      .map((row: { rut: string | null }) => normalizeRut(row.rut))
      .filter(Boolean),
  )

  const typeMap = new Map(
    ((typesResult.data || []) as DocumentTypeRow[])
      .filter((type) => type.is_active === true && type.es_obligatorio === true)
      .map((type) => [type.id, type]),
  )

  const latestByKey = new Map<string, PendingDocumentRow>()
  for (const doc of (pendingResult.data || []) as PendingDocumentRow[]) {
    const rut = normalizeRut(doc.subcontractor_rut)
    if (!rut || !activeRuts.has(rut) || !doc.document_type_id || !typeMap.has(doc.document_type_id)) continue

    const key = `${rut}|${doc.document_type_id}|${periodKey(doc)}`
    const existing = latestByKey.get(key)
    if (!existing || recencyValue(doc) > recencyValue(existing)) latestByKey.set(key, doc)
  }

  const hardCandidates = [...latestByKey.values()].filter(hasHardAttentionSignal)
  if (hardCandidates.length === 0) return 0

  const candidateRuts = [...new Set(hardCandidates.map((doc) => doc.subcontractor_rut).filter(Boolean))] as string[]
  const candidateTypeIds = [...new Set(hardCandidates.map((doc) => doc.document_type_id).filter(Boolean))] as string[]

  let approvedQuery = supabase
    .from('subcontractor_documents')
    .select('subcontractor_rut,document_type_id,document_period_start,expires_at')
    .eq('status', 'approved')
    .eq('is_current', true)

  if (candidateRuts.length > 0) approvedQuery = approvedQuery.in('subcontractor_rut', candidateRuts)
  if (candidateTypeIds.length > 0) approvedQuery = approvedQuery.in('document_type_id', candidateTypeIds)

  const approvedResult = await approvedQuery
  if (approvedResult.error) throw approvedResult.error
  const approvedRows = (approvedResult.data || []) as ApprovedDocumentRow[]

  return hardCandidates.filter((doc) => {
    const type = doc.document_type_id ? typeMap.get(doc.document_type_id) : null
    return !isCoveredByApproved(doc, type?.periodicidad || null, approvedRows)
  }).length
}
