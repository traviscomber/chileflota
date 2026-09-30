export type ClearanceState = 'blocked' | 'at_risk' | 'cleared' | 'unverified'

export type ClearanceReasonCode =
  | 'entity_inactive'
  | 'license_expired'
  | 'license_expiring'
  | 'document_expired'
  | 'document_rejected'
  | 'document_pending'
  | 'document_expiring'
  | 'evidence_incomplete'

export interface ClearanceDocumentEvidence {
  id: string
  label: string
  status?: string | null
  expiresAt?: string | null
  source: 'subcontractor_documents' | 'uploaded_documents'
}

export interface ClearanceInput {
  entityType: 'transportista' | 'conductor'
  entityId: string
  entityActive: boolean
  evidenceComplete: boolean
  documents: ClearanceDocumentEvidence[]
  licenseExpiresAt?: string | null
  now?: string
  warningDays?: number
}

export interface ClearanceReason {
  code: ClearanceReasonCode
  severity: 'blocker' | 'risk' | 'info'
  message: string
  documentId?: string
  evidenceSource?: ClearanceDocumentEvidence['source']
  date?: string | null
}

export interface ClearanceDecision {
  state: ClearanceState
  canOperate: boolean | null
  reasons: ClearanceReason[]
  summary: {
    blockerCount: number
    riskCount: number
    documentCount: number
    evidenceComplete: boolean
  }
}

function normalizeStatus(value?: string | null): 'approved' | 'rejected' | 'pending' | 'unknown' {
  const normalized = (value || '').trim().toLowerCase()
  if (['approved', 'aprobado'].includes(normalized)) return 'approved'
  if (['rejected', 'rechazado'].includes(normalized)) return 'rejected'
  if (['pending', 'pendiente', ''].includes(normalized)) return 'pending'
  return 'unknown'
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function daysUntil(target: Date, now: Date): number {
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((targetDay - nowDay) / 86_400_000)
}

export function evaluateOperationalClearance(input: ClearanceInput): ClearanceDecision {
  const now = input.now ? new Date(input.now) : new Date()
  if (Number.isNaN(now.getTime())) throw new Error('now must be a valid timestamp')

  const warningDays = input.warningDays ?? 30
  if (!Number.isInteger(warningDays) || warningDays < 0) {
    throw new Error('warningDays must be a non-negative integer')
  }

  const reasons: ClearanceReason[] = []

  if (!input.entityActive) {
    reasons.push({
      code: 'entity_inactive',
      severity: 'blocker',
      message: 'La entidad está inactiva.',
    })
  }

  if (input.entityType === 'conductor') {
    const licenseDate = parseDate(input.licenseExpiresAt)
    if (!licenseDate) {
      reasons.push({
        code: 'evidence_incomplete',
        severity: 'info',
        message: 'No existe evidencia suficiente de vigencia de licencia.',
      })
    } else {
      const licenseDays = daysUntil(licenseDate, now)
      if (licenseDays < 0) {
        reasons.push({
          code: 'license_expired',
          severity: 'blocker',
          message: 'La licencia de conducir está vencida.',
          date: input.licenseExpiresAt,
        })
      } else if (licenseDays <= warningDays) {
        reasons.push({
          code: 'license_expiring',
          severity: 'risk',
          message: `La licencia vence en ${licenseDays} día(s).`,
          date: input.licenseExpiresAt,
        })
      }
    }
  }

  for (const document of input.documents) {
    const status = normalizeStatus(document.status)
    const expiration = parseDate(document.expiresAt)
    const expirationDays = expiration ? daysUntil(expiration, now) : null

    if (status === 'rejected') {
      reasons.push({
        code: 'document_rejected',
        severity: 'blocker',
        message: `${document.label}: documento rechazado.`,
        documentId: document.id,
        evidenceSource: document.source,
        date: document.expiresAt,
      })
      continue
    }

    if (status === 'pending' || status === 'unknown') {
      reasons.push({
        code: 'document_pending',
        severity: 'blocker',
        message: `${document.label}: documento pendiente de validación.`,
        documentId: document.id,
        evidenceSource: document.source,
        date: document.expiresAt,
      })
      continue
    }

    if (expirationDays !== null && expirationDays < 0) {
      reasons.push({
        code: 'document_expired',
        severity: 'blocker',
        message: `${document.label}: documento vencido.`,
        documentId: document.id,
        evidenceSource: document.source,
        date: document.expiresAt,
      })
      continue
    }

    if (expirationDays !== null && expirationDays <= warningDays) {
      reasons.push({
        code: 'document_expiring',
        severity: 'risk',
        message: `${document.label}: vence en ${expirationDays} día(s).`,
        documentId: document.id,
        evidenceSource: document.source,
        date: document.expiresAt,
      })
    }
  }

  if (!input.evidenceComplete) {
    reasons.push({
      code: 'evidence_incomplete',
      severity: 'info',
      message: 'La cobertura documental obligatoria aún no está certificada; no se puede declarar APTO.',
    })
  }

  const blockerCount = reasons.filter((reason) => reason.severity === 'blocker').length
  const riskCount = reasons.filter((reason) => reason.severity === 'risk').length

  let state: ClearanceState
  let canOperate: boolean | null

  if (blockerCount > 0) {
    state = 'blocked'
    canOperate = false
  } else if (!input.evidenceComplete) {
    state = 'unverified'
    canOperate = null
  } else if (riskCount > 0) {
    state = 'at_risk'
    canOperate = true
  } else {
    state = 'cleared'
    canOperate = true
  }

  return {
    state,
    canOperate,
    reasons,
    summary: {
      blockerCount,
      riskCount,
      documentCount: input.documents.length,
      evidenceComplete: input.evidenceComplete,
    },
  }
}
