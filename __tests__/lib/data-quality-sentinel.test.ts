import { buildDataQualityReport } from '@/lib/data-quality-sentinel'

describe('data quality sentinel', () => {
  it('detects normalized duplicate company RUTs and ownership conflicts', () => {
    const result = buildDataQualityReport([], [
      { id: 'c1', razonSocial: 'JS 1', rut: '78.455.399-K', assignedExecutiveId: 'e1', isActive: true },
      { id: 'c2', razonSocial: 'JS 2', rut: '78455399-k', assignedExecutiveId: 'e2', isActive: true },
    ])

    expect(result.duplicateCompanyGroups).toBe(1)
    expect(result.conflictingDuplicateOwnershipGroups).toBe(1)
    expect(result.duplicateCompanies[0]).toEqual(expect.objectContaining({
      normalizedRut: '78455399K',
      rows: 2,
      conflictingExecutives: true,
    }))
  })

  it('flags hard document integrity contradictions', () => {
    const result = buildDataQualityReport([
      {
        id: 'd1',
        subcontractorId: 'missing',
        subcontractorRut: '1-9',
        documentTypeId: 't1',
        fileName: 'a.pdf',
        status: 'pending',
        reviewedAt: '2026-09-01T00:00:00Z',
        rejectionReason: null,
        documentPeriodStart: '2026-09-01',
        isCurrent: true,
      },
      {
        id: 'd2',
        subcontractorId: 'c1',
        subcontractorRut: '99-9',
        documentTypeId: 't1',
        fileName: 'b.pdf',
        status: 'approved',
        reviewedAt: null,
        rejectionReason: null,
        documentPeriodStart: '2026-09-01',
        isCurrent: true,
      },
    ], [
      { id: 'c1', razonSocial: 'Empresa', rut: '11-1', assignedExecutiveId: 'e1', isActive: true },
    ])

    expect(result.issueCounts).toEqual(expect.objectContaining({
      orphan_company: 1,
      pending_already_reviewed: 1,
      approved_without_review: 1,
      rut_mismatch: 1,
    }))
    expect(result.hardIntegrityIssueCount).toBe(4)
  })

  it('detects exact current document duplicates but not different files in the same period', () => {
    const base = {
      subcontractorId: 'c1',
      subcontractorRut: '11-1',
      documentTypeId: 't1',
      status: 'pending',
      reviewedAt: null,
      rejectionReason: null,
      documentPeriodStart: '2026-09-01',
      isCurrent: true,
    }

    const result = buildDataQualityReport([
      { ...base, id: 'd1', fileName: ' Planilla.pdf ' },
      { ...base, id: 'd2', fileName: 'planilla.PDF' },
      { ...base, id: 'd3', fileName: 'otro.pdf' },
    ], [
      { id: 'c1', razonSocial: 'Empresa', rut: '11-1', assignedExecutiveId: 'e1', isActive: true },
    ])

    expect(result.duplicateCurrentDocumentGroups).toBe(1)
    expect(result.duplicateCurrentDocumentRows).toBe(2)
  })

  it('records softer integrity warnings separately from hard contradictions', () => {
    const result = buildDataQualityReport([
      {
        id: 'd1',
        subcontractorId: 'c1',
        subcontractorRut: '11-1',
        documentTypeId: 't1',
        fileName: 'rechazo.pdf',
        status: 'rejected',
        reviewedAt: '2026-09-01T00:00:00Z',
        rejectionReason: null,
        documentPeriodStart: null,
        isCurrent: true,
      },
    ], [
      { id: 'c1', razonSocial: 'Empresa', rut: '11-1', assignedExecutiveId: 'e1', isActive: true },
    ])

    expect(result.issueCounts).toEqual(expect.objectContaining({
      rejected_without_reason: 1,
      current_missing_period: 1,
    }))
    expect(result.hardIntegrityIssueCount).toBe(0)
  })
})
