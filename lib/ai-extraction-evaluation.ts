export interface AiEvaluationSample {
  humanReviewed: boolean
  aiDocumentType?: string | null
  canonicalDocumentType?: string | null
  aiExpirationDate?: string | null
  canonicalExpirationDate?: string | null
  aiConfidence?: number | null
}

export interface AiEvaluationResult {
  reviewedSamples: number
  type: {
    specificPredictionCount: number
    coverage: number | null
  }
  expiration: {
    comparableCount: number
    exactMatchCount: number
    exactAgreement: number | null
  }
  confidence: {
    observedCount: number
    average: number | null
    label: 'model_confidence_not_accuracy'
  }
  readiness: {
    canClaimFieldAccuracy: false
    hasFieldOverrideLineage: false
    blockers: string[]
  }
}

const GENERIC_DOCUMENT_TYPES = new Set([
  '',
  'documento',
  'document',
  'unknown',
  'desconocido',
  'null',
])

function normalize(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null
  const match = value.trim().match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] || null
}

export function isSpecificAiDocumentType(value?: string | null): boolean {
  return !GENERIC_DOCUMENT_TYPES.has(normalize(value))
}

export function evaluateAiExtractionEvidence(samples: AiEvaluationSample[]): AiEvaluationResult {
  const reviewed = samples.filter((sample) => sample.humanReviewed)
  const specificPredictionCount = reviewed.filter((sample) => isSpecificAiDocumentType(sample.aiDocumentType)).length

  let comparableCount = 0
  let exactMatchCount = 0
  const confidenceValues: number[] = []

  for (const sample of reviewed) {
    const aiDate = normalizeDate(sample.aiExpirationDate)
    const canonicalDate = normalizeDate(sample.canonicalExpirationDate)
    if (aiDate && canonicalDate) {
      comparableCount += 1
      if (aiDate === canonicalDate) exactMatchCount += 1
    }

    if (typeof sample.aiConfidence === 'number' && Number.isFinite(sample.aiConfidence)) {
      confidenceValues.push(sample.aiConfidence)
    }
  }

  const blockers = [
    'field_level_human_override_lineage_missing',
    'review_status_is_not_field_level_ground_truth',
  ]
  if (comparableCount === 0) blockers.push('no_comparable_expiration_ground_truth')

  return {
    reviewedSamples: reviewed.length,
    type: {
      specificPredictionCount,
      coverage: reviewed.length > 0 ? specificPredictionCount / reviewed.length : null,
    },
    expiration: {
      comparableCount,
      exactMatchCount,
      exactAgreement: comparableCount > 0 ? exactMatchCount / comparableCount : null,
    },
    confidence: {
      observedCount: confidenceValues.length,
      average:
        confidenceValues.length > 0
          ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
          : null,
      label: 'model_confidence_not_accuracy',
    },
    readiness: {
      canClaimFieldAccuracy: false,
      hasFieldOverrideLineage: false,
      blockers,
    },
  }
}
