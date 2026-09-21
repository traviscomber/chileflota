import fs from 'node:fs'
import path from 'node:path'
import { reconcileVehicleEvidence } from '@/lib/vehicle-evidence-reconciliation'

describe('vehicle evidence reconciliation', () => {
  it('returns no fleet without claiming compliance', () => {
    const result = reconcileVehicleEvidence([])

    expect(result.state).toBe('no_fleet')
    expect(result.activeVehicles).toBe(0)
    expect(result.documentCoverageRate).toBeNull()
    expect(result.prtCoverageRate).toBeNull()
    expect(result.canProveCompleteOperationalCompliance).toBe(false)
    expect(result.canSatisfyOperationalClearanceAlone).toBe(false)
  })

  it('verifies only the observed active fleet evidence', () => {
    const result = reconcileVehicleEvidence([
      { vehicle_id: 'a', has_document_fact: true, has_prt_match: true, confidence: 0.9 },
      { vehicle_id: 'b', has_document_fact: true, has_prt_match: true, confidence: 0.8 },
    ])

    expect(result.state).toBe('verified_observed_fleet')
    expect(result.activeVehicles).toBe(2)
    expect(result.vehiclesWithObservedEvidence).toBe(2)
    expect(result.vehiclesWithPrtMatch).toBe(2)
    expect(result.documentCoverageRate).toBe(1)
    expect(result.prtCoverageRate).toBe(1)
    expect(result.averageConfidence).toBeCloseTo(0.85)
    expect(result.canProveObservedFleetDocumentCoverage).toBe(true)
    expect(result.canProveObservedFleetPrtCoverage).toBe(true)
    expect(result.canProveCompleteOperationalCompliance).toBe(false)
  })

  it('surfaces one missing active vehicle as partial evidence', () => {
    const result = reconcileVehicleEvidence([
      { vehicle_id: 'a', has_document_fact: true, has_prt_match: true, confidence: 0.9 },
      { vehicle_id: 'b', has_document_fact: false, has_prt_match: false, confidence: null },
    ])

    expect(result.state).toBe('partial_observed_fleet')
    expect(result.vehiclesWithObservedEvidence).toBe(1)
    expect(result.vehiclesWithoutObservedEvidence).toBe(1)
    expect(result.documentCoverageRate).toBe(0.5)
    expect(result.prtCoverageRate).toBe(0.5)
    expect(result.canProveObservedFleetDocumentCoverage).toBe(false)
  })

  it('ignores invalid confidence values', () => {
    const result = reconcileVehicleEvidence([
      { vehicle_id: 'a', has_document_fact: true, has_prt_match: true, confidence: 1.2 },
      { vehicle_id: 'b', has_document_fact: true, has_prt_match: true, confidence: Number.NaN },
    ])

    expect(result.averageConfidence).toBeNull()
  })

  it('keeps the API read-only and orders auth before privileged reads', () => {
    const routePath = path.join(
      process.cwd(),
      'app/api/company/vehicle-evidence-reconciliation/route.ts',
    )
    const source = fs.readFileSync(routePath, 'utf8')

    const authIndex = source.indexOf('await verifyAuth(request)')
    const authorizationIndex = source.indexOf('await canReadVehicleEvidence(')
    const dataClientIndex = source.indexOf('const supabase = createAdminClient()')

    expect(authIndex).toBeGreaterThanOrEqual(0)
    expect(authorizationIndex).toBeGreaterThan(authIndex)
    expect(dataClientIndex).toBeGreaterThan(authorizationIndex)
    expect(source).not.toContain('.insert(')
    expect(source).not.toContain('.update(')
    expect(source).not.toContain('.delete(')
    expect(source).not.toContain('.upsert(')
  })

  it('does not authorize transportista reads from cookie-carried organization_id', () => {
    const authorizationPath = path.join(
      process.cwd(),
      'lib/vehicle-evidence-authorization.ts',
    )
    const source = fs.readFileSync(authorizationPath, 'utf8')

    expect(source).toContain("actor.role === 'transportista'")
    expect(source).toContain('Vehicle evidence self-service requiere identidad organizacional server-side')
    expect(source).not.toContain('actor.organization_id === transportistaId')
  })
})
