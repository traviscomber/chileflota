import {
  buildHumanOverrideRecord,
  normalizeOverrideValue,
} from '@/lib/ai-human-override-lineage'

const AI_ANALYZED_AT = '2026-09-03T18:00:00-04:00'

describe('AI human override lineage', () => {
  it('records a real field correction with deterministic prediction evidence', () => {
    const input = {
      documentId: 'doc-123',
      documentSource: 'subcontractor_documents',
      fieldName: 'expiration_date',
      aiValue: '2026-09-03T12:00:00Z',
      humanValue: '2026-09-04',
      aiAnalyzedAt: AI_ANALYZED_AT,
      aiConfidence: 0.94,
      modelName: 'gpt-4o-mini',
      promptRevision: 'document-extraction-v1',
      reviewerId: 'reviewer-1',
      reviewerRole: 'ejecutiva',
      reviewedAt: '2026-09-03T20:00:00-04:00',
    }

    const first = buildHumanOverrideRecord(input)
    const second = buildHumanOverrideRecord(input)

    expect(first).not.toBeNull()
    expect(first?.ai_value).toBe('2026-09-03')
    expect(first?.human_value).toBe('2026-09-04')
    expect(first?.ai_analyzed_at).toBe('2026-09-03T22:00:00.000Z')
    expect(first?.reviewed_at).toBe('2026-09-04T00:00:00.000Z')
    expect(first?.idempotency_key).toHaveLength(64)
    expect(second?.idempotency_key).toBe(first?.idempotency_key)
  })

  it('changes the evidence key when the AI prediction event changes', () => {
    const base = {
      documentId: 'doc-123',
      documentSource: 'subcontractor_documents',
      fieldName: 'document_type',
      aiValue: 'DOCUMENTO',
      humanValue: 'F30',
      reviewerId: 'reviewer-1',
      modelName: 'gpt-4o-mini',
    }

    const first = buildHumanOverrideRecord({ ...base, aiAnalyzedAt: '2026-09-03T18:00:00Z' })
    const second = buildHumanOverrideRecord({ ...base, aiAnalyzedAt: '2026-09-03T19:00:00Z' })

    expect(first?.idempotency_key).not.toBe(second?.idempotency_key)
  })

  it('does not create an override when normalized AI and human values agree', () => {
    expect(buildHumanOverrideRecord({
      documentId: 'doc-123',
      documentSource: 'uploaded_documents',
      fieldName: 'document_number',
      aiValue: ' ABC   123 ',
      humanValue: 'ABC 123',
      aiAnalyzedAt: AI_ANALYZED_AT,
      reviewerId: 'reviewer-1',
    })).toBeNull()
  })

  it('rejects non-evaluable fields such as extracted text', () => {
    expect(() => buildHumanOverrideRecord({
      documentId: 'doc-123',
      documentSource: 'subcontractor_documents',
      fieldName: 'ai_extracted_text',
      aiValue: 'full OCR text',
      humanValue: 'edited full OCR text',
      aiAnalyzedAt: AI_ANALYZED_AT,
      reviewerId: 'reviewer-1',
    })).toThrow('Unsupported override field')
  })

  it('rejects unknown document sources', () => {
    expect(() => buildHumanOverrideRecord({
      documentId: 'doc-123',
      documentSource: 'some_legacy_table',
      fieldName: 'document_type',
      aiValue: 'DOCUMENTO',
      humanValue: 'F30',
      aiAnalyzedAt: AI_ANALYZED_AT,
      reviewerId: 'reviewer-1',
    })).toThrow('Unsupported document source')
  })

  it('rejects invalid model confidence rather than converting it to accuracy', () => {
    expect(() => buildHumanOverrideRecord({
      documentId: 'doc-123',
      documentSource: 'subcontractor_documents',
      fieldName: 'document_type',
      aiValue: 'DOCUMENTO',
      humanValue: 'F30',
      aiAnalyzedAt: AI_ANALYZED_AT,
      aiConfidence: 1.2,
      reviewerId: 'reviewer-1',
    })).toThrow('aiConfidence must be between 0 and 1')
  })

  it('requires an explicit reviewer identity', () => {
    expect(() => buildHumanOverrideRecord({
      documentId: 'doc-123',
      documentSource: 'subcontractor_documents',
      fieldName: 'document_type',
      aiValue: 'DOCUMENTO',
      humanValue: 'F30',
      aiAnalyzedAt: AI_ANALYZED_AT,
      reviewerId: ' ',
    })).toThrow('reviewerId is required')
  })

  it('requires the exact AI prediction timestamp for changed values', () => {
    expect(() => buildHumanOverrideRecord({
      documentId: 'doc-123',
      documentSource: 'subcontractor_documents',
      fieldName: 'document_type',
      aiValue: 'DOCUMENTO',
      humanValue: 'F30',
      aiAnalyzedAt: 'not-a-date',
      reviewerId: 'reviewer-1',
    })).toThrow('aiAnalyzedAt must be a valid timestamp')
  })

  it('keeps non-ISO values visible instead of guessing a date', () => {
    expect(normalizeOverrideValue('expiration_date', '03/09/2026')).toBe('03/09/2026')
  })
})
