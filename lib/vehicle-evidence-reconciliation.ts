export type VehicleEvidenceState = 'verified_observed_fleet' | 'partial_observed_fleet' | 'no_fleet'

export interface VehicleEvidenceRow {
  vehicle_id: string
  has_document_fact: boolean
  has_prt_match: boolean
  confidence?: number | null
}

export interface VehicleEvidenceReconciliation {
  state: VehicleEvidenceState
  activeVehicles: number
  vehiclesWithObservedEvidence: number
  vehiclesWithoutObservedEvidence: number
  vehiclesWithPrtMatch: number
  documentCoverageRate: number | null
  prtCoverageRate: number | null
  averageConfidence: number | null
  canProveObservedFleetDocumentCoverage: boolean
  canProveObservedFleetPrtCoverage: boolean
  canProveCompleteOperationalCompliance: false
  canSatisfyOperationalClearanceAlone: false
  limitations: string[]
}

function finiteConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

export function reconcileVehicleEvidence(
  rows: readonly VehicleEvidenceRow[],
): VehicleEvidenceReconciliation {
  const activeVehicles = rows.length
  let vehiclesWithObservedEvidence = 0
  let vehiclesWithPrtMatch = 0
  const confidences: number[] = []

  for (const row of rows) {
    if (row.has_document_fact) vehiclesWithObservedEvidence += 1
    if (row.has_prt_match) vehiclesWithPrtMatch += 1

    const confidence = finiteConfidence(row.confidence)
    if (confidence !== null) confidences.push(confidence)
  }

  const vehiclesWithoutObservedEvidence = activeVehicles - vehiclesWithObservedEvidence
  const documentCoverageRate = activeVehicles > 0
    ? vehiclesWithObservedEvidence / activeVehicles
    : null
  const prtCoverageRate = activeVehicles > 0
    ? vehiclesWithPrtMatch / activeVehicles
    : null
  const averageConfidence = confidences.length > 0
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null

  let state: VehicleEvidenceState = 'no_fleet'
  if (activeVehicles > 0) {
    state = vehiclesWithObservedEvidence === activeVehicles && vehiclesWithPrtMatch === activeVehicles
      ? 'verified_observed_fleet'
      : 'partial_observed_fleet'
  }

  return {
    state,
    activeVehicles,
    vehiclesWithObservedEvidence,
    vehiclesWithoutObservedEvidence,
    vehiclesWithPrtMatch,
    documentCoverageRate,
    prtCoverageRate,
    averageConfidence,
    canProveObservedFleetDocumentCoverage:
      activeVehicles > 0 && vehiclesWithObservedEvidence === activeVehicles,
    canProveObservedFleetPrtCoverage:
      activeVehicles > 0 && vehiclesWithPrtMatch === activeVehicles,
    canProveCompleteOperationalCompliance: false,
    canSatisfyOperationalClearanceAlone: false,
    limitations: [
      'active_vehicle_registry_only',
      'observed_document_facts_only',
      'does_not_certify_all_required_vehicle_document_families',
      'does_not_certify_driver_or_company_requirements',
    ],
  }
}
