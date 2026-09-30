import { createHash } from 'node:crypto'

export const AI_OVERRIDE_FIELDS = [
  'document_type',
  'expiration_date',
  'issuance_date',
  'document_number',
] as const

export const AI_OVERRIDE_SOURCES = [
  'subcontractor_documents',
  'uploaded_documents',
] as const

export type AiOverrideField = (typeof AI_OVERRIDE_FIELDS)[number]
export type AiOverrideSource = (typeof AI_OVERRIDE_SOURCES)[number]

export interface HumanOverrideInput {
  documentId: string
  documentSource: string
  fieldName: string
  aiValue: unknown
  humanValue: unknown
  aiAnalyzedAt: string
  aiConfidence?: number | null
  modelName?: string | null
  promptRevision?: string | null
  reviewerId: string
  reviewerRole?: string | null
  reviewedAt?: string
}

export interface HumanOverrideRecord {
  document_id: string
  document_source: AiOverrideSource
  field_name: AiOverrideField
  ai_value: string | null
  human_value: string | null
  ai_analyzed_at: string
  ai_confidence: number | null
  model_name: string | null
  prompt_revision: string | null
  reviewer_id: string
  reviewer_role: string | null
  reviewed_at: string
  idempotency_key: string
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/\s+/g, ' ')
  return text.length > 0 ? text : null
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value)
  if (!text) return null

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (!match) return text

  const [, year, month, day] = match
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return text

  const canonical = date.toISOString().slice(0, 10)
  return canonical === `${year}-${month}-${day}` ? canonical : text
}

export function normalizeOverrideValue(fieldName: AiOverrideField, value: unknown): string | null {
  if (fieldName === 'expiration_date' || fieldName === 'issuance_date') {
    return normalizeDate(value)
  }

  return normalizeText(value)
}

function isOverrideField(value: string): value is AiOverrideField {
  return (AI_OVERRIDE_FIELDS as readonly string[]).includes(value)
}

function isOverrideSource(value: string): value is AiOverrideSource {
  return (AI_OVERRIDE_SOURCES as readonly string[]).includes(value)
}

function normalizeConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('aiConfidence must be between 0 and 1')
  }
  return value
}

function normalizeRequiredIdentity(value: string, label: string): string {
  const normalized = normalizeText(value)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function normalizeRequiredTimestamp(value: string, label: string): string {
  const normalized = normalizeRequiredIdentity(value, label)
  const timestamp = new Date(normalized)
  if (Number.isNaN(timestamp.getTime())) throw new Error(`${label} must be a valid timestamp`)
  return timestamp.toISOString()
}

export function buildHumanOverrideRecord(input: HumanOverrideInput): HumanOverrideRecord | null {
  const documentId = normalizeRequiredIdentity(input.documentId, 'documentId')
  const reviewerId = normalizeRequiredIdentity(input.reviewerId, 'reviewerId')

  if (!isOverrideSource(input.documentSource)) {
    throw new Error(`Unsupported document source: ${input.documentSource}`)
  }

  if (!isOverrideField(input.fieldName)) {
    throw new Error(`Unsupported override field: ${input.fieldName}`)
  }

  const aiValue = normalizeOverrideValue(input.fieldName, input.aiValue)
  const humanValue = normalizeOverrideValue(input.fieldName, input.humanValue)

  // Lineage records corrections, not approvals or unchanged confirmations.
  if (aiValue === humanValue) return null

  const aiAnalyzedAt = normalizeRequiredTimestamp(input.aiAnalyzedAt, 'aiAnalyzedAt')
  const reviewedAt = input.reviewedAt
    ? normalizeRequiredTimestamp(input.reviewedAt, 'reviewedAt')
    : new Date().toISOString()
  const modelName = normalizeText(input.modelName)
  const promptRevision = normalizeText(input.promptRevision)

  const idempotencyMaterial = [
    documentId,
    input.documentSource,
    input.fieldName,
    aiAnalyzedAt,
    aiValue ?? '<null>',
    humanValue ?? '<null>',
    modelName ?? '<unknown-model>',
    promptRevision ?? '<unknown-prompt>',
    reviewerId,
  ].join('|')

  return {
    document_id: documentId,
    document_source: input.documentSource,
    field_name: input.fieldName,
    ai_value: aiValue,
    human_value: humanValue,
    ai_analyzed_at: aiAnalyzedAt,
    ai_confidence: normalizeConfidence(input.aiConfidence),
    model_name: modelName,
    prompt_revision: promptRevision,
    reviewer_id: reviewerId,
    reviewer_role: normalizeText(input.reviewerRole),
    reviewed_at: reviewedAt,
    idempotency_key: createHash('sha256').update(idempotencyMaterial).digest('hex'),
  }
}
