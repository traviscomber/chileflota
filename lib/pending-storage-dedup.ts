type PendingDocument = {
  id: string
  subcontractor_id?: string | null
  document_type_id?: string | null
  document_period_start?: string | null
  document_period_year?: number | null
  document_period_month?: number | null
  file_name?: string | null
  file_url?: string | null
  uploaded_at?: string | null
  created_at?: string | null
}

type StorageMetadata = {
  eTag?: string | null
  etag?: string | null
  size?: number | string | null
  contentLength?: number | string | null
}

function normalizeFileName(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function periodKey(doc: PendingDocument) {
  if (doc.document_period_start) return doc.document_period_start.slice(0, 10)
  if (doc.document_period_year && doc.document_period_month) {
    return `${doc.document_period_year}-${String(doc.document_period_month).padStart(2, '0')}-01`
  }
  return null
}

function storageObjectPath(fileUrl: string | null | undefined) {
  if (!fileUrl) return null
  const marker = '/subcontractor-documents/'
  const index = fileUrl.indexOf(marker)
  if (index < 0) return null
  try {
    return decodeURIComponent(fileUrl.slice(index + marker.length).split('?')[0])
  } catch {
    return fileUrl.slice(index + marker.length).split('?')[0]
  }
}

function candidateKey(doc: PendingDocument) {
  const period = periodKey(doc)
  const fileName = normalizeFileName(doc.file_name)
  if (!doc.subcontractor_id || !doc.document_type_id || !period || !fileName) return null
  return [doc.subcontractor_id, doc.document_type_id, period, fileName].join('|')
}

function storageIdentity(metadata: StorageMetadata | undefined) {
  if (!metadata) return null
  const etag = String(metadata.eTag || metadata.etag || '').trim().toLowerCase()
  const size = Number(metadata.size ?? metadata.contentLength ?? 0)
  if (!etag) return null
  return `${etag}|${Number.isFinite(size) ? size : 0}`
}

function recency(doc: PendingDocument) {
  const value = Date.parse(doc.uploaded_at || doc.created_at || '')
  return Number.isFinite(value) ? value : 0
}

function candidateGroups<T extends PendingDocument>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = candidateKey(row)
    if (!key) continue
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

export function getPendingStorageDedupCandidateFolders<T extends PendingDocument>(rows: T[]) {
  const folders = new Set<string>()
  for (const group of candidateGroups(rows)) {
    for (const row of group) {
      const objectPath = storageObjectPath(row.file_url)
      if (!objectPath || !objectPath.includes('/')) continue
      folders.add(objectPath.slice(0, objectPath.lastIndexOf('/')))
    }
  }
  return [...folders]
}

export function collapseConfirmedStorageDuplicates<T extends PendingDocument>(
  rows: T[],
  metadataByObjectName: Map<string, StorageMetadata>,
) {
  const suppressedIds = new Set<string>()
  let duplicateGroups = 0

  for (const group of candidateGroups(rows)) {
    const byIdentity = new Map<string, T[]>()

    for (const row of group) {
      const objectPath = storageObjectPath(row.file_url)
      if (!objectPath) continue
      const identity = storageIdentity(metadataByObjectName.get(objectPath))
      if (!identity) continue
      const matches = byIdentity.get(identity) || []
      matches.push(row)
      byIdentity.set(identity, matches)
    }

    for (const matches of byIdentity.values()) {
      if (matches.length < 2) continue
      duplicateGroups += 1
      const ordered = [...matches].sort((a, b) => recency(b) - recency(a))
      for (const duplicate of ordered.slice(1)) suppressedIds.add(duplicate.id)
    }
  }

  return {
    rows: rows.filter((row) => !suppressedIds.has(row.id)),
    suppressedCount: suppressedIds.size,
    duplicateGroups,
  }
}
