export type PayrollPairState = 'verified_pair' | 'partial_pair' | 'no_evidence'

export interface PayrollEvidenceRow {
  has_liquidation: boolean | null
  has_previred: boolean | null
  reconciliation_confidence?: number | null
}

export interface PayrollEvidenceReconciliation {
  state: PayrollPairState
  observedWorkers: number
  matchedWorkers: number
  liquidationOnlyWorkers: number
  previredOnlyWorkers: number
  pairCoverageRate: number | null
  averageConfidence: number | null
  canProveObservedWorkerPairCoverage: boolean
  canProveWorkforceCompleteness: false
  canSatisfyOperationalClearanceAlone: false
  limitations: string[]
}

function finiteConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

export function reconcilePayrollEvidence(
  rows: readonly PayrollEvidenceRow[],
): PayrollEvidenceReconciliation {
  let matchedWorkers = 0
  let liquidationOnlyWorkers = 0
  let previredOnlyWorkers = 0
  const confidences: number[] = []

  for (const row of rows) {
    const hasLiquidation = row.has_liquidation === true
    const hasPrevired = row.has_previred === true

    if (hasLiquidation && hasPrevired) matchedWorkers += 1
    else if (hasLiquidation) liquidationOnlyWorkers += 1
    else if (hasPrevired) previredOnlyWorkers += 1

    const confidence = finiteConfidence(row.reconciliation_confidence)
    if (confidence !== null) confidences.push(confidence)
  }

  const observedWorkers = matchedWorkers + liquidationOnlyWorkers + previredOnlyWorkers
  const pairCoverageRate = observedWorkers > 0 ? matchedWorkers / observedWorkers : null
  const averageConfidence = confidences.length > 0
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null

  let state: PayrollPairState = 'no_evidence'
  if (observedWorkers > 0) {
    state = matchedWorkers === observedWorkers ? 'verified_pair' : 'partial_pair'
  }

  return {
    state,
    observedWorkers,
    matchedWorkers,
    liquidationOnlyWorkers,
    previredOnlyWorkers,
    pairCoverageRate,
    averageConfidence,
    canProveObservedWorkerPairCoverage: state === 'verified_pair',
    // Pair reconciliation only knows workers observed in liquidation/Previred.
    // Until a canonical workforce universe (for example F30/contracts) is linked,
    // it cannot prove that an entirely missing worker does not exist.
    canProveWorkforceCompleteness: false,
    canSatisfyOperationalClearanceAlone: false,
    limitations: [
      'observed_workers_only',
      'no_canonical_workforce_universe',
      'does_not_certify_f30_or_contract_coverage',
    ],
  }
}
