export type DataQualityCompany = {
  id: string
  razonSocial: string | null
  rut: string | null
  assignedExecutiveId: string | null
  isActive: boolean | null
}

export type DataQualityDocument = {
  id: string
  subcontractorId: string | null
  subcontractorRut: string | null
  documentTypeId: string | null
  fileName: string | null
  status: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  documentPeriodStart: string | null
  isCurrent: boolean | null
}

function normalizeRut(value: string | null): string {
  return (value ?? '').toUpperCase().replace(/[^0-9K]/g, '')
}

function normalizeFileName(value: string | null): string {
  return (value ?? '').trim().toLocaleLowerCase('es-CL')
}

export function buildDataQualityReport(
  documents: DataQualityDocument[],
  companies: DataQualityCompany[],
) {
  const companyMap = new Map(companies.map((company) => [company.id, company]))
  const documentsByCompany = new Map<string, { total: number; current: number; pending: number }>()

  for (const document of documents) {
    if (!document.subcontractorId) continue
    const current = documentsByCompany.get(document.subcontractorId) ?? { total: 0, current: 0, pending: 0 }
    current.total += 1
    if (document.isCurrent !== false) current.current += 1
    if (document.status === 'pending') current.pending += 1
    documentsByCompany.set(document.subcontractorId, current)
  }

  const companiesByRut = new Map<string, DataQualityCompany[]>()
  for (const company of companies) {
    const rut = normalizeRut(company.rut)
    if (!rut) continue
    const rows = companiesByRut.get(rut) ?? []
    rows.push(company)
    companiesByRut.set(rut, rows)
  }

  const duplicateCompanies = Array.from(companiesByRut.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([normalizedRut, rows]) => {
      const executiveIds = Array.from(new Set(rows.map((row) => row.assignedExecutiveId).filter(Boolean)))
      return {
        normalizedRut,
        rows: rows.length,
        activeRows: rows.filter((row) => row.isActive !== false).length,
        conflictingExecutives: executiveIds.length > 1,
        executiveIds,
        members: rows.map((row) => {
          const counts = documentsByCompany.get(row.id) ?? { total: 0, current: 0, pending: 0 }
          return {
            companyId: row.id,
            companyName: row.razonSocial,
            rut: row.rut,
            active: row.isActive !== false,
            executiveId: row.assignedExecutiveId,
            totalDocuments: counts.total,
            currentDocuments: counts.current,
            pendingDocuments: counts.pending,
          }
        }),
      }
    })
    .sort((a, b) => {
      const bDocs = b.members.reduce((sum, item) => sum + item.currentDocuments, 0)
      const aDocs = a.members.reduce((sum, item) => sum + item.currentDocuments, 0)
      return bDocs - aDocs
    })

  const integrityIssues: Array<{
    type:
      | 'orphan_company'
      | 'pending_already_reviewed'
      | 'approved_without_review'
      | 'rut_mismatch'
      | 'unknown_status'
      | 'current_missing_period'
      | 'rejected_without_reason'
    documentId: string
    companyId: string | null
    fileName: string | null
  }> = []

  const duplicateDocumentMap = new Map<string, DataQualityDocument[]>()
  const knownStatuses = new Set(['pending', 'approved', 'rejected'])

  for (const document of documents) {
    const company = document.subcontractorId ? companyMap.get(document.subcontractorId) : undefined

    if (!document.subcontractorId || !company) {
      integrityIssues.push({
        type: 'orphan_company',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    if (document.status === 'pending' && document.reviewedAt) {
      integrityIssues.push({
        type: 'pending_already_reviewed',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    if (document.status === 'approved' && !document.reviewedAt) {
      integrityIssues.push({
        type: 'approved_without_review',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    const documentRut = normalizeRut(document.subcontractorRut)
    const companyRut = normalizeRut(company?.rut ?? null)
    if (documentRut && companyRut && documentRut !== companyRut) {
      integrityIssues.push({
        type: 'rut_mismatch',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    if (!document.status || !knownStatuses.has(document.status)) {
      integrityIssues.push({
        type: 'unknown_status',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    if (document.isCurrent !== false && !document.documentPeriodStart) {
      integrityIssues.push({
        type: 'current_missing_period',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    if (document.status === 'rejected' && !document.rejectionReason?.trim()) {
      integrityIssues.push({
        type: 'rejected_without_reason',
        documentId: document.id,
        companyId: document.subcontractorId,
        fileName: document.fileName,
      })
    }

    if (
      document.isCurrent !== false &&
      document.subcontractorId &&
      document.documentTypeId &&
      document.documentPeriodStart &&
      normalizeFileName(document.fileName)
    ) {
      const key = [
        document.subcontractorId,
        document.documentTypeId,
        document.documentPeriodStart,
        normalizeFileName(document.fileName),
      ].join('|')
      const group = duplicateDocumentMap.get(key) ?? []
      group.push(document)
      duplicateDocumentMap.set(key, group)
    }
  }

  const duplicateCurrentDocuments = Array.from(duplicateDocumentMap.values())
    .filter((rows) => rows.length > 1)
    .map((rows) => ({
      companyId: rows[0].subcontractorId,
      documentTypeId: rows[0].documentTypeId,
      documentPeriodStart: rows[0].documentPeriodStart,
      fileName: rows[0].fileName,
      rows: rows.length,
      documentIds: rows.map((row) => row.id),
    }))
    .sort((a, b) => b.rows - a.rows)

  const issueCounts = integrityIssues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] ?? 0) + 1
    return acc
  }, {})

  const hardIntegrityIssueCount =
    (issueCounts.orphan_company ?? 0) +
    (issueCounts.pending_already_reviewed ?? 0) +
    (issueCounts.approved_without_review ?? 0) +
    (issueCounts.rut_mismatch ?? 0) +
    (issueCounts.unknown_status ?? 0)

  return {
    companiesScanned: companies.length,
    documentsScanned: documents.length,
    duplicateCompanyGroups: duplicateCompanies.length,
    duplicateCompanyRows: duplicateCompanies.reduce((sum, group) => sum + group.rows, 0),
    conflictingDuplicateOwnershipGroups: duplicateCompanies.filter((group) => group.conflictingExecutives).length,
    duplicateCurrentDocumentGroups: duplicateCurrentDocuments.length,
    duplicateCurrentDocumentRows: duplicateCurrentDocuments.reduce((sum, group) => sum + group.rows, 0),
    hardIntegrityIssueCount,
    issueCounts,
    duplicateCompanies: duplicateCompanies.slice(0, 25),
    duplicateCurrentDocuments: duplicateCurrentDocuments.slice(0, 25),
    integrityIssueSamples: integrityIssues.slice(0, 50),
  }
}
