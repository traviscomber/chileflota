import { buildReviewBacklogSnapshot } from '@/lib/review-backlog-sentinel'

describe('review backlog sentinel', () => {
  const now = new Date('2026-09-30T12:00:00.000Z')

  it('separates ownership anomalies from stale review backlog', () => {
    const result = buildReviewBacklogSnapshot(
      [
        { id: 'd1', subcontractorId: 'c1', pendingSince: '2026-08-01T12:00:00.000Z' },
        { id: 'd2', subcontractorId: 'c2', pendingSince: '2026-09-28T12:00:00.000Z' },
      ],
      [
        { id: 'c1', razonSocial: 'Empresa Antigua', rut: '1-9', assignedExecutiveId: 'e1', isActive: true },
        { id: 'c2', razonSocial: 'Empresa Sin Asignar', rut: '2-7', assignedExecutiveId: null, isActive: true },
      ],
      [{ id: 'e1', fullName: 'Ejecutiva Activa', email: 'active@example.com', isActive: true }],
      now,
    )

    expect(result.totalPending).toBe(2)
    expect(result.backlogAnomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'stale_review', companyId: 'c1' }),
    ]))
    expect(result.ownershipAnomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'missing_assignment', companyId: 'c2' }),
    ]))
    expect(result.ownershipAnomalies).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ companyId: 'c1' }),
    ]))
  })

  it('flags inactive or missing executives without reassigning anything', () => {
    const result = buildReviewBacklogSnapshot(
      [
        { id: 'd1', subcontractorId: 'c1', pendingSince: '2026-09-20T12:00:00.000Z' },
        { id: 'd2', subcontractorId: 'c2', pendingSince: '2026-09-20T12:00:00.000Z' },
      ],
      [
        { id: 'c1', razonSocial: 'Inactive', rut: '1-9', assignedExecutiveId: 'e1', isActive: true },
        { id: 'c2', razonSocial: 'Missing', rut: '2-7', assignedExecutiveId: 'e2', isActive: true },
      ],
      [{ id: 'e1', fullName: 'Inactive Exec', email: 'inactive@example.com', isActive: false }],
      now,
    )

    expect(result.ownershipAnomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'inactive_executive', companyId: 'c1' }),
      expect.objectContaining({ type: 'missing_executive', companyId: 'c2' }),
    ]))
  })

  it('builds SLA buckets and executive workload metrics', () => {
    const result = buildReviewBacklogSnapshot(
      [
        { id: 'd1', subcontractorId: 'c1', pendingSince: '2026-09-29T12:00:00.000Z' },
        { id: 'd2', subcontractorId: 'c1', pendingSince: '2026-09-24T12:00:00.000Z' },
        { id: 'd3', subcontractorId: 'c1', pendingSince: '2026-09-10T12:00:00.000Z' },
        { id: 'd4', subcontractorId: 'c1', pendingSince: '2026-08-01T12:00:00.000Z' },
      ],
      [{ id: 'c1', razonSocial: 'Empresa', rut: '1-9', assignedExecutiveId: 'e1', isActive: true }],
      [{ id: 'e1', fullName: 'Ejecutiva', email: 'exec@example.com', isActive: true }],
      now,
    )

    expect(result.slaBuckets).toEqual({
      within3Days: 1,
      days4to7: 1,
      days8to30: 1,
      over30Days: 1,
    })
    expect(result.executiveSummary[0]).toEqual(expect.objectContaining({
      pendingDocs: 4,
      docsOver7Days: 2,
      docsOver30Days: 1,
    }))
  })
})
