import fs from 'node:fs'
import path from 'node:path'
import {
  buildFeedbackEvidence,
  feedbackDocumentType,
  parseAiFeedbackRequest,
} from '@/lib/ai-feedback-safety'

const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111'

describe('AI feedback safety contract', () => {
  it('accepts only allowlisted document tables', () => {
    expect(() => parseAiFeedbackRequest({
      documentId: DOCUMENT_ID,
      documentTable: 'profiles',
      actualDocumentType: 'F30',
      isAccurate: false,
    })).toThrow()

    expect(feedbackDocumentType('subcontractor_documents')).toBe('subcontractor')
    expect(feedbackDocumentType('uploaded_documents')).toBe('conductor')
  })

  it('strips legacy client claims about the AI prediction', () => {
    const parsed = parseAiFeedbackRequest({
      documentId: DOCUMENT_ID,
      documentTable: 'subcontractor_documents',
      actualDocumentType: 'F30',
      isAccurate: false,
      aiDetectedType: 'FORGED_CLIENT_TYPE',
      aiExpirationDate: '2099-01-01',
      confidenceScore: 1,
      ejecutivaEmail: 'forged@example.com',
    }) as Record<string, unknown>

    expect(parsed.aiDetectedType).toBeUndefined()
    expect(parsed.aiExpirationDate).toBeUndefined()
    expect(parsed.confidenceScore).toBeUndefined()
    expect(parsed.ejecutivaEmail).toBeUndefined()
  })

  it('rebuilds AI before-state from trusted document evidence', () => {
    const request = parseAiFeedbackRequest({
      documentId: DOCUMENT_ID,
      documentTable: 'subcontractor_documents',
      actualDocumentType: 'F30',
      actualExpirationDate: '2026-10-01',
      isAccurate: false,
    })

    const evidence = buildFeedbackEvidence(request, {
      ai_document_type: 'DOCUMENTO',
      ai_expiration_date: '2026-09-01',
      ai_confidence: 0.91,
      ai_analyzed_at: '2026-09-03T18:00:00Z',
    })

    expect(evidence).toMatchObject({
      aiDetectedType: 'DOCUMENTO',
      actualDocumentType: 'F30',
      aiExpirationDate: '2026-09-01',
      actualExpirationDate: '2026-10-01',
      confidenceScore: 0.91,
      aiAnalyzedAt: '2026-09-03T18:00:00Z',
      isAccurate: false,
    })
  })

  it('normalizes the DD/MM/YYYY format used by the current review UI', () => {
    const parsed = parseAiFeedbackRequest({
      documentId: DOCUMENT_ID,
      documentTable: 'subcontractor_documents',
      actualDocumentType: 'F30',
      actualExpirationDate: '03/09/2026',
      isAccurate: false,
    })

    expect(parsed.actualExpirationDate).toBe('2026-09-03')
  })

  it('does not allow an inaccurate claim with no correction', () => {
    expect(() => parseAiFeedbackRequest({
      documentId: DOCUMENT_ID,
      documentTable: 'uploaded_documents',
      isAccurate: false,
    })).toThrow('Inaccurate feedback requires at least one corrected field')
  })

  it('validates corrected dates conservatively', () => {
    expect(() => parseAiFeedbackRequest({
      documentId: DOCUMENT_ID,
      documentTable: 'subcontractor_documents',
      actualExpirationDate: '31/02/2026',
      isAccurate: false,
    })).toThrow()
  })

  it('keeps service-role access after authentication and authorization in the route', () => {
    const routePath = path.join(
      process.cwd(),
      'app/api/company/ai-training/feedback/route.ts',
    )
    const source = fs.readFileSync(routePath, 'utf8')

    const verifyAuthIndex = source.indexOf('await verifyAuth(request)')
    const authorizationIndex = source.indexOf('await canChangeDocumentStatus(')
    const adminIndex = source.indexOf('const supabase = createAdminClient()')

    expect(verifyAuthIndex).toBeGreaterThanOrEqual(0)
    expect(authorizationIndex).toBeGreaterThan(verifyAuthIndex)
    expect(adminIndex).toBeGreaterThan(authorizationIndex)
    expect(source).not.toContain('Skip auth for feedback endpoint')
    expect(source).not.toContain('body.ejecutivaEmail')
    expect(source).not.toContain('.from(documentTable)')
  })
})
