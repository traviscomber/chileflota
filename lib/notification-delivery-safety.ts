import { createHash } from 'crypto'

export type NotificationDeliveryType = 'email' | 'sms' | 'both'

export interface NotificationDeliveryCapability {
  requested: boolean
  ready: boolean
  provider: string
  providerImplemented: boolean
  ledgerReady: boolean
  reasons: string[]
  policy: {
    duplicateWindowMinutes: number
    recipientHourlyLimit: number
  }
}

interface IdempotencyInput {
  userId: string
  type: NotificationDeliveryType
  templateId: string
  variables: Record<string, string>
  contact: {
    email?: string
    phone?: string
  }
}

const IMPLEMENTED_PROVIDERS = new Set<string>()

export const NOTIFICATION_DELIVERY_POLICY = {
  duplicateWindowMinutes: 24 * 60,
  recipientHourlyLimit: 5,
} as const

function normalizeEmail(email?: string): string {
  return (email || '').trim().toLowerCase()
}

function normalizePhone(phone?: string): string {
  return (phone || '').replace(/[^0-9+]/g, '')
}

function stableVariables(variables: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, String(value)])
  )
}

export function getNotificationDeliveryCapability(): NotificationDeliveryCapability {
  const requested = process.env.NOTIFICATION_DELIVERY_ENABLED === 'true'
  const provider = (process.env.NOTIFICATION_DELIVERY_PROVIDER || 'none').trim().toLowerCase()
  const ledgerReady = process.env.NOTIFICATION_DELIVERY_LEDGER_READY === 'true'
  const providerImplemented = IMPLEMENTED_PROVIDERS.has(provider)
  const reasons: string[] = []

  if (!requested) reasons.push('delivery_disabled')
  if (!ledgerReady) reasons.push('delivery_ledger_not_ready')
  if (!providerImplemented) reasons.push('delivery_provider_not_implemented')

  return {
    requested,
    ready: requested && ledgerReady && providerImplemented,
    provider,
    providerImplemented,
    ledgerReady,
    reasons,
    policy: { ...NOTIFICATION_DELIVERY_POLICY },
  }
}

export function buildNotificationIdempotencyKey(input: IdempotencyInput): string {
  const canonicalPayload = JSON.stringify({
    userId: input.userId,
    type: input.type,
    templateId: input.templateId,
    variables: stableVariables(input.variables),
    contact: {
      email: normalizeEmail(input.contact.email),
      phone: normalizePhone(input.contact.phone),
    },
  })

  return createHash('sha256').update(canonicalPayload).digest('hex')
}

export function buildRecipientFingerprint(contact: IdempotencyInput['contact']): string {
  const canonicalRecipient = `${normalizeEmail(contact.email)}|${normalizePhone(contact.phone)}`
  return createHash('sha256').update(canonicalRecipient).digest('hex')
}
