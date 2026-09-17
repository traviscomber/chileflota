type MutualRatesDocument = {
  id: string
  subcontractor_id?: string | null
  file_name?: string | null
  status?: string | null
  is_current?: boolean | null
  document_period_year?: number | string | null
  document_period_month?: number | string | null
  uploaded_at?: string | null
  created_at?: string | null
  version_number?: number | null
  ai_document_type?: string | null
  ai_extracted_text?: string | null
}

function normalize(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
}

function timestamp(doc: MutualRatesDocument): number {
  const raw = doc.uploaded_at || doc.created_at || ''
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function periodPart(value: number | string | null | undefined): string {
  return value == null || value === '' ? 'unknown' : String(value)
}

export function classifyMutualRatesInstance(doc: MutualRatesDocument): 'accidentabilidad' | 'siniestralidad' | 'tasas' | 'cotizaciones' | null {
  const haystack = normalize([doc.file_name, doc.ai_document_type, doc.ai_extracted_text].filter(Boolean).join(' '))

  if (/cotizacion|cotizaciones/.test(haystack)) return 'cotizaciones'
  if (/accidentabilidad|accident/.test(haystack)) return 'accidentabilidad'
  if (/siniestralidad|siniestral/.test(haystack)) return 'siniestralidad'
  if (/certificado de tasas|certificado tasas|\btasas\b/.test(haystack)) return 'tasas'
  return null
}

export function selectCanonicalPendingMutualRates<T extends MutualRatesDocument>(docs: T[]): {
  pending: T[]
  diagnostics: {
    input: number
    canonicalPending: number
    ambiguousCurrentFallback: number
    unresolvedHistorical: number
    excludedMisclassifiedCotizaciones: number
  }
} {
  const groups = new Map<string, T[]>()
  const ambiguous: T[] = []
  let excludedMisclassifiedCotizaciones = 0

  for (const doc of docs) {
    const instance = classifyMutualRatesInstance(doc)
    if (instance === 'cotizaciones') {
      excludedMisclassifiedCotizaciones += 1
      continue
    }
    if (!instance) {
      ambiguous.push(doc)
      continue
    }

    const key = [
      doc.subcontractor_id || 'unknown',
      periodPart(doc.document_period_year),
      periodPart(doc.document_period_month),
      instance,
    ].join(':')

    const group = groups.get(key) || []
    group.push(doc)
    groups.set(key, group)
  }

  const pending: T[] = []

  for (const group of groups.values()) {
    const latest = [...group].sort((a, b) => {
      const byTime = timestamp(b) - timestamp(a)
      if (byTime !== 0) return byTime
      const byVersion = (b.version_number || 0) - (a.version_number || 0)
      if (byVersion !== 0) return byVersion
      return String(b.id).localeCompare(String(a.id))
    })[0]

    if (latest?.status === 'pending') pending.push(latest)
  }

  const ambiguousCurrent = ambiguous.filter((doc) => doc.is_current === true && doc.status === 'pending')
  pending.push(...ambiguousCurrent)

  return {
    pending,
    diagnostics: {
      input: docs.length,
      canonicalPending: pending.length,
      ambiguousCurrentFallback: ambiguousCurrent.length,
      unresolvedHistorical: ambiguous.filter((doc) => doc.is_current !== true && doc.status === 'pending').length,
      excludedMisclassifiedCotizaciones,
    },
  }
}
