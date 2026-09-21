import fs from 'node:fs'
import path from 'node:path'
import { evaluateOperationalClearance } from '@/lib/operational-clearance'

const NOW = '2026-09-03T12:00:00Z'

describe('operational clearance', () => {
  it('blocks when a current document is rejected', () => {
    const decision = evaluateOperationalClearance({
      entityType: 'transportista',
      entityId: 'company-1',
      entityActive: true,
      evidenceComplete: false,
      now: NOW,
      documents: [{
        id: 'doc-1',
        label: 'F30',
        status: 'rejected',
        source: 'subcontractor_documents',
      }],
    })

    expect(decision.state).toBe('blocked')
    expect(decision.canOperate).toBe(false)
    expect(decision.reasons.some((reason) => reason.code === 'document_rejected')).toBe(true)
  })

  it('blocks when approved evidence is already expired', () => {
    const decision = evaluateOperationalClearance({
      entityType: 'transportista',
      entityId: 'company-1',
      entityActive: true,
      evidenceComplete: true,
      now: NOW,
      documents: [{
        id: 'doc-1',
        label: 'F30',
        status: 'approved',
        expiresAt: '2026-09-02',
        source: 'subcontractor_documents',
      }],
    })

    expect(decision.state).toBe('blocked')
    expect(decision.reasons[0]?.code).toBe('document_expired')
  })

  it('returns unverified instead of falsely declaring APTO when coverage is not certified', () => {
    const decision = evaluateOperationalClearance({
      entityType: 'transportista',
      entityId: 'company-1',
      entityActive: true,
      evidenceComplete: false,
      now: NOW,
      documents: [{
        id: 'doc-1',
        label: 'F30',
        status: 'approved',
        expiresAt: '2027-01-01',
        source: 'subcontractor_documents',
      }],
    })

    expect(decision.state).toBe('unverified')
    expect(decision.canOperate).toBeNull()
    expect(decision.reasons.some((reason) => reason.code === 'evidence_incomplete')).toBe(true)
  })

  it('returns at_risk only when coverage is complete and evidence expires soon', () => {
    const decision = evaluateOperationalClearance({
      entityType: 'transportista',
      entityId: 'company-1',
      entityActive: true,
      evidenceComplete: true,
      now: NOW,
      documents: [{
        id: 'doc-1',
        label: 'F30',
        status: 'approved',
        expiresAt: '2026-09-20',
        source: 'subcontractor_documents',
      }],
    })

    expect(decision.state).toBe('at_risk')
    expect(decision.canOperate).toBe(true)
  })

  it('returns cleared only with certified complete evidence and no risks', () => {
    const decision = evaluateOperationalClearance({
      entityType: 'transportista',
      entityId: 'company-1',
      entityActive: true,
      evidenceComplete: true,
      now: NOW,
      documents: [{
        id: 'doc-1',
        label: 'F30',
        status: 'approved',
        expiresAt: '2027-01-01',
        source: 'subcontractor_documents',
      }],
    })

    expect(decision.state).toBe('cleared')
    expect(decision.canOperate).toBe(true)
  })

  it('blocks a conductor with an expired license', () => {
    const decision = evaluateOperationalClearance({
      entityType: 'conductor',
      entityId: 'driver-1',
      entityActive: true,
      evidenceComplete: false,
      now: NOW,
      licenseExpiresAt: '2026-09-01',
      documents: [],
    })

    expect(decision.state).toBe('blocked')
    expect(decision.reasons.some((reason) => reason.code === 'license_expired')).toBe(true)
  })

  it('authenticates and authorizes before privileged read access in the endpoint', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/api/company/operational-clearance/route.ts'),
      'utf8',
    )

    const authIndex = source.indexOf('await verifyAuth(request)')
    const authorizationIndex = source.indexOf('await canViewOperationalClearance(')
    const adminIndex = source.indexOf('const admin = createAdminClient()')

    expect(authIndex).toBeGreaterThanOrEqual(0)
    expect(authorizationIndex).toBeGreaterThan(authIndex)
    expect(adminIndex).toBeGreaterThan(authorizationIndex)
    expect(source).toContain('evidenceComplete: false')
    expect(source).toContain('readOnly: true')
    expect(source).not.toContain('.insert(')
    expect(source).not.toContain('.update(')
    expect(source).not.toContain('.delete(')
  })
})
