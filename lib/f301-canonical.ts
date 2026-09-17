type F301Document = {
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

function normalizeRut(value: string | null | undefined): string | null {
  const normalized = (value || '').replace(/[^0-9kK]/g, '').toLowerCase()
  return normalized.length >= 8 ? normalized : null
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function extractF301PrincipalRut(text: string | null | undefined): string | null {
  if (!text) return null

  const lower = text.toLocaleLowerCase('es-CL')
  const start = lower.indexOf('1.2 - empresa principal')
  if (start < 0) return null

  const tail = text.slice(start + '1.2 - empresa principal'.length)
  const tailLower = lower.slice(start + '1.2 - empresa principal'.length)
  const nextSection = tailLower.indexOf('1.3 - empresa contratista')
  const section = nextSection >= 0 ? tail.slice(0, nextSection) : tail.slice(0, 1800)
  const rutMatch = section.match(/(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[0-9kK]/)

  return normalizeRut(rutMatch?.[0])
}

function isMisclassifiedAntecedentes(doc: F301Document): boolean {
  const type = (doc.ai_document_type || '').toLocaleLowerCase('es-CL')
  return type.includes('antecedentes laborales') || type.includes('antecedentes laborales y previsionales')
}

function timestamp(doc: F301Document): number {
  const raw = doc.uploaded_at || doc.created_at || ''
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function periodPart(value: number | string | null | undefined): string {
  return value == null || value === '' ? 'unknown' : String(value)
}

function filenameFallbackKey(doc: F301Document): string | null {
  const normalized = normalizeText(doc.file_name)
  if (!normalized) return null

  const meaningful = normalized
    .replace(/\bf30\b/g, ' ')
    .replace(/\bcertificado\b/g, ' ')
    .replace(/\bcliente\b/g, ' ')
    .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return meaningful.length >= 3 ? meaningful : normalized
}

export function selectCanonicalPendingF301<T extends F301Document>(docs: T[]): {
  pending: T[]
  diagnostics: {
    input: number
    canonicalPending: number
    filenameFallback: number
    ambiguousCurrentFallback: number
    unresolvedHistorical: number
    excludedMisclassifiedAntecedentes: number
  }
} {
  const keyedGroups = new Map<string, T[]>()
  const ambiguous: T[] = []
  let excludedMisclassifiedAntecedentes = 0
  let filenameFallback = 0

  for (const doc of docs) {
    if (isMisclassifiedAntecedentes(doc)) {
      excludedMisclassifiedAntecedentes += 1
      continue
    }

    const principalRut = extractF301PrincipalRut(doc.ai_extracted_text)
    const filenameKey = principalRut ? null : filenameFallbackKey(doc)

    if (!principalRut && !filenameKey) {
      ambiguous.push(doc)
      continue
    }

    if (!principalRut && filenameKey) filenameFallback += 1

    const key = [
      doc.subcontractor_id || 'unknown',
      periodPart(doc.document_period_year),
      periodPart(doc.document_period_month),
      principalRut ? `rut:${principalRut}` : `file:${filenameKey}`,
    ].join(':')

    const group = keyedGroups.get(key) || []
    group.push(doc)
    keyedGroups.set(key, group)
  }

  const pending: T[] = []

  for (const group of keyedGroups.values()) {
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
      filenameFallback,
      ambiguousCurrentFallback: ambiguousCurrent.length,
      unresolvedHistorical: ambiguous.filter((doc) => doc.is_current !== true && doc.status === 'pending').length,
      excludedMisclassifiedAntecedentes,
    },
  }
}
