import fs from 'node:fs'
import path from 'node:path'
import { reconcilePayrollEvidence } from '@/lib/payroll-evidence-reconciliation'

describe('payroll evidence reconciliation', () => {
  it('returns no evidence without claiming workforce completeness', () => {
    const result = reconcilePayrollEvidence([])

    expect(result.state).toBe('no_evidence')
    expect(result.observedWorkers).toBe(0)
    expect(result.pairCoverageRate).toBeNull()
    expect(result.canProveObservedWorkerPairCoverage).toBe(false)
    expect(result.canProveWorkforceCompleteness).toBe(false)
    expect(result.canSatisfyOperationalClearanceAlone).toBe(false)
  })

  it('verifies only the observed liquidation-previred pair', () => {
    const result = reconcilePayrollEvidence([
      { has_liquidation: true, has_previred: true, reconciliation_confidence: 0.8 },
      { has_liquidation: true, has_previred: true, reconciliation_confidence: 0.9 },
    ])

    expect(result.state).toBe('verified_pair')
    expect(result.observedWorkers).toBe(2)
    expect(result.matchedWorkers).toBe(2)
    expect(result.pairCoverageRate).toBe(1)
    expect(result.averageConfidence).toBeCloseTo(0.85)
    expect(result.canProveObservedWorkerPairCoverage).toBe(true)
    expect(result.canProveWorkforceCompleteness).toBe(false)
    expect(result.limitations).toContain('no_canonical_workforce_universe')
  })

  it('surfaces partial evidence instead of averaging it into a pass', () => {
    const result = reconcilePayrollEvidence([
      { has_liquidation: true, has_previred: true, reconciliation_confidence: 0.9 },
      { has_liquidation: true, has_previred: false, reconciliation_confidence: 0.7 },
      { has_liquidation: false, has_previred: true, reconciliation_confidence: 0.8 },
    ])

    expect(result.state).toBe('partial_pair')
    expect(result.matchedWorkers).toBe(1)
    expect(result.liquidationOnlyWorkers).toBe(1)
    expect(result.previredOnlyWorkers).toBe(1)
    expect(result.pairCoverageRate).toBeCloseTo(1 / 3)
    expect(result.canProveObservedWorkerPairCoverage).toBe(false)
  })

  it('ignores malformed confidence values rather than converting them to evidence', () => {
    const result = reconcilePayrollEvidence([
      { has_liquidation: true, has_previred: true, reconciliation_confidence: 1.2 },
      { has_liquidation: true, has_previred: true, reconciliation_confidence: Number.NaN },
    ])

    expect(result.state).toBe('verified_pair')
    expect(result.averageConfidence).toBeNull()
  })

  it('keeps the API read-only and creates the data client after auth and authorization', () => {
    const routePath = path.join(
      process.cwd(),
      'app/api/company/payroll-evidence-reconciliation/route.ts',
    )
    const source = fs.readFileSync(routePath, 'utf8')

    const authIndex = source.indexOf('await verifyAuth(request)')
    const authorizationIndex = source.indexOf('await canReadPayrollEvidence(')
    const dataClientIndex = source.indexOf('const supabase = createAdminClient()')

    expect(authIndex).toBeGreaterThanOrEqual(0)
    expect(authorizationIndex).toBeGreaterThan(authIndex)
    expect(dataClientIndex).toBeGreaterThan(authorizationIndex)
    expect(source).not.toContain('.insert(')
    expect(source).not.toContain('.update(')
    expect(source).not.toContain('.delete(')
    expect(source).not.toContain('.upsert(')
  })

  it('does not authorize transportista payroll reads from cookie-carried organization_id', () => {
    const authorizationPath = path.join(
      process.cwd(),
      'lib/payroll-evidence-authorization.ts',
    )
    const source = fs.readFileSync(authorizationPath, 'utf8')

    expect(source).toContain("actor.role === 'transportista'")
    expect(source).toContain('Payroll self-service requiere identidad organizacional server-side')
    expect(source).not.toContain('actor.organization_id === transportistaId')
  })
})
