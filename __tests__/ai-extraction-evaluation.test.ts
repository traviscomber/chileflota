import {
  evaluateAiExtractionEvidence,
  isSpecificAiDocumentType,
} from '@/lib/ai-extraction-evaluation'

describe('AI extraction evaluation contract', () => {
  it('does not treat generic DOCUMENTO as a useful type prediction', () => {
    expect(isSpecificAiDocumentType('DOCUMENTO')).toBe(false)
    expect(isSpecificAiDocumentType(' documento ')).toBe(false)
    expect(isSpecificAiDocumentType('Certificado de Antecedentes')).toBe(true)
  })

  it('separates model confidence from measured field agreement', () => {
    const result = evaluateAiExtractionEvidence([
      {
        humanReviewed: true,
        aiDocumentType: 'DOCUMENTO',
        canonicalDocumentType: 'F30',
        aiExpirationDate: '2026-10-15',
        canonicalExpirationDate: '2026-10-15T00:00:00Z',
        aiConfidence: 0.99,
      },
      {
        humanReviewed: true,
        aiDocumentType: 'Certificado de Antecedentes',
        canonicalDocumentType: 'Cert. Antecedentes',
        aiExpirationDate: null,
        canonicalExpirationDate: '2026-12-01',
        aiConfidence: 0.97,
      },
    ])

    expect(result.reviewedSamples).toBe(2)
    expect(result.type.specificPredictionCount).toBe(1)
    expect(result.type.coverage).toBe(0.5)
    expect(result.expiration.comparableCount).toBe(1)
    expect(result.expiration.exactMatchCount).toBe(1)
    expect(result.expiration.exactAgreement).toBe(1)
    expect(result.confidence.average).toBeCloseTo(0.98)
    expect(result.confidence.label).toBe('model_confidence_not_accuracy')
    expect(result.readiness.canClaimFieldAccuracy).toBe(false)
  })

  it('never promotes approval/review state into field-level ground truth', () => {
    const result = evaluateAiExtractionEvidence([
      {
        humanReviewed: true,
        aiDocumentType: 'F30',
        aiConfidence: 1,
      },
    ])

    expect(result.expiration.comparableCount).toBe(0)
    expect(result.expiration.exactAgreement).toBeNull()
    expect(result.readiness.blockers).toContain('field_level_human_override_lineage_missing')
    expect(result.readiness.blockers).toContain('review_status_is_not_field_level_ground_truth')
    expect(result.readiness.blockers).toContain('no_comparable_expiration_ground_truth')
  })

  it('ignores unreviewed samples when reporting evidence coverage', () => {
    const result = evaluateAiExtractionEvidence([
      {
        humanReviewed: false,
        aiDocumentType: 'F30',
        aiExpirationDate: '2026-10-15',
        canonicalExpirationDate: '2026-10-15',
        aiConfidence: 0.99,
      },
    ])

    expect(result.reviewedSamples).toBe(0)
    expect(result.type.coverage).toBeNull()
    expect(result.expiration.comparableCount).toBe(0)
    expect(result.confidence.observedCount).toBe(0)
  })
})
