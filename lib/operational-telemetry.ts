import { createAdminClient } from '@/lib/supabase/admin'

export const OPERATIONAL_TELEMETRY_SCHEMA_VERSION = 1 as const

export type OperationalEventName =
  | 'document_uploaded'
  | 'ai_analysis_completed'
  | 'document_approved'
  | 'document_rejected'

export type OperationalEntityType = 'document'

export interface OperationalTelemetryEvent {
  eventName: OperationalEventName
  actorProfileId?: string | null
  actorRole?: string | null
  entityType: OperationalEntityType
  entityId: string
  source: string
  correlationId?: string | null
  metadata?: Record<string, unknown>
}

export interface OperationalTelemetryResult {
  emitted: boolean
  reason?: 'disabled' | 'invalid_event' | 'persistence_failed'
}

const ALLOWED_METADATA_KEYS = new Set([
  'document_type',
  'previous_status',
  'new_status',
  'analysis_provider',
  'analysis_version',
  'has_human_override',
])

const SENSITIVE_KEY_PATTERN = /(email|phone|telefono|nombre|name|rut|content|text|reason|file|filename|url|address|direccion|token|secret|password)/i

export function isOperationalTelemetryEnabled(): boolean {
  return process.env.OPERATIONAL_TELEMETRY_ENABLED === 'true'
}

export function sanitizeOperationalMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!metadata) return {}

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key) || SENSITIVE_KEY_PATTERN.test(key)) continue

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value
    }
  }

  return sanitized
}

function isValidEvent(event: OperationalTelemetryEvent): boolean {
  return Boolean(
    event.eventName &&
      event.entityType === 'document' &&
      event.entityId?.trim() &&
      event.source?.trim()
  )
}

/**
 * Product telemetry is intentionally separate from security/audit logs.
 *
 * Safety contract:
 * - disabled unless OPERATIONAL_TELEMETRY_ENABLED=true;
 * - never blocks the business workflow;
 * - accepts only a small non-PII metadata allowlist;
 * - persistence failures are reported as a result and a non-PII warning.
 */
export async function emitOperationalEvent(
  event: OperationalTelemetryEvent
): Promise<OperationalTelemetryResult> {
  if (!isOperationalTelemetryEnabled()) {
    return { emitted: false, reason: 'disabled' }
  }

  if (!isValidEvent(event)) {
    return { emitted: false, reason: 'invalid_event' }
  }

  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient.from('operational_events').insert({
      event_name: event.eventName,
      occurred_at: new Date().toISOString(),
      actor_profile_id: event.actorProfileId || null,
      actor_role: event.actorRole || null,
      entity_type: event.entityType,
      entity_id: event.entityId,
      source: event.source,
      correlation_id: event.correlationId || null,
      metadata: sanitizeOperationalMetadata(event.metadata),
      schema_version: OPERATIONAL_TELEMETRY_SCHEMA_VERSION,
    })

    if (error) {
      console.warn('[telemetry] operational event persistence failed', {
        eventName: event.eventName,
        entityType: event.entityType,
        source: event.source,
        code: error.code,
      })
      return { emitted: false, reason: 'persistence_failed' }
    }

    return { emitted: true }
  } catch (error) {
    console.warn('[telemetry] operational event persistence failed', {
      eventName: event.eventName,
      entityType: event.entityType,
      source: event.source,
      errorType: error instanceof Error ? error.name : 'unknown',
    })
    return { emitted: false, reason: 'persistence_failed' }
  }
}
