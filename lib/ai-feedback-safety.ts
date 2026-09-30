import { z } from 'zod'

export const AI_FEEDBACK_TABLES = [
  'subcontractor_documents',
  'uploaded_documents',
] as const

export type AiFeedbackTable = (typeof AI_FEEDBACK_TABLES)[number]

function canonicalDate(value: string): string | null {
  const text = value.trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  const candidate = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : dmy
      ? `${dmy[3]}-${dmy[2]}-${dmy[1]}`
      : null

  if (!candidate) return null
  const date = new Date(`${candidate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10) === candidate ? candidate : null
}

const correctionDate = z.string().trim().min(1).transform((value, ctx) => {
  const normalized = canonicalDate(value)
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected a valid YYYY-MM-DD or DD/MM/YYYY date',
    })
    return z.NEVER
  }
  return normalized
})

// Unknown legacy fields are stripped. In particular, client-supplied AI prediction
// values/confidence are ignored and later reconstructed from the trusted document row.
const AiFeedbackRequestSchema = z.object({
  documentId: z.string().uuid(),
  documentTable: z.enum(AI_FEEDBACK_TABLES),
  actualDocumentType: z.string().trim().min(1).max(200).nullable().optional(),
  actualExpirationDate: correctionDate.nullable().optional(),
  feedback: z.string().trim().max(2000).nullable().optional(),
  isAccurate: z.boolean(),
}).superRefine((value, ctx) => {
  if (!value.isAccurate && value.actualDocumentType === undefined && value.actualExpirationDate === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Inaccurate feedback requires at least one corrected field',
      path: ['isAccurate'],
    })
  }
})

export type AiFeedbackRequest = z.infer<typeof AiFeedbackRequestSchema>

export interface TrustedAiSnapshot {
  ai_document_type: string | null
  ai_expiration_date: string | null
  ai_confidence: number | null
  ai_analyzed_at?: string | null
}

export interface FeedbackEvidence {
  aiDetectedType: string | null
  actualDocumentType: string | null
  aiExpirationDate: string | null
  actualExpirationDate: string | null
  confidenceScore: number | null
  aiAnalyzedAt: string | null
  isAccurate: boolean
}

export function parseAiFeedbackRequest(body: unknown): AiFeedbackRequest {
  return AiFeedbackRequestSchema.parse(body)
}

export function feedbackDocumentType(table: AiFeedbackTable): 'subcontractor' | 'conductor' {
  return table === 'subcontractor_documents' ? 'subcontractor' : 'conductor'
}

export function buildFeedbackEvidence(
  request: AiFeedbackRequest,
  snapshot: TrustedAiSnapshot,
): FeedbackEvidence {
  const currentType = snapshot.ai_document_type?.trim() || null
  const currentExpiration = snapshot.ai_expiration_date || null

  if (request.isAccurate) {
    return {
      aiDetectedType: currentType,
      actualDocumentType: currentType,
      aiExpirationDate: currentExpiration,
      actualExpirationDate: currentExpiration,
      confidenceScore: snapshot.ai_confidence,
      aiAnalyzedAt: snapshot.ai_analyzed_at || null,
      isAccurate: true,
    }
  }

  return {
    aiDetectedType: currentType,
    actualDocumentType: request.actualDocumentType ?? currentType,
    aiExpirationDate: currentExpiration,
    actualExpirationDate: request.actualExpirationDate === undefined
      ? currentExpiration
      : request.actualExpirationDate,
    confidenceScore: snapshot.ai_confidence,
    aiAnalyzedAt: snapshot.ai_analyzed_at || null,
    isAccurate: false,
  }
}
