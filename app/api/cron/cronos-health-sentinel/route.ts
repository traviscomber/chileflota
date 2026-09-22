import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

type Severity = 'ok' | 'warning' | 'high' | 'critical'
type Health = 'healthy' | 'degraded' | 'stuck' | 'broken'

type Snapshot = {
  captured_at?: string
  max_connections?: number
  current_connections?: number
  active_connections?: number
  connection_ratio?: number | string
  blocked_queries?: number
  long_queries_30s?: number
  database_bytes?: number
  object_storage_bytes?: number
  stale_system_job_runs?: number
}

type Condition = {
  fingerprint: string
  severity: Exclude<Severity, 'ok'>
  title: string
  message: string
  metadata?: Record<string, unknown>
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function severityRank(value: Severity) {
  return { ok: 0, warning: 1, high: 2, critical: 3 }[value]
}

function healthForSeverity(severity: Severity): Health {
  if (severity === 'critical') return 'broken'
  if (severity === 'high') return 'stuck'
  if (severity === 'warning') return 'degraded'
  return 'healthy'
}

function classify(snapshot: Snapshot): { severity: Severity; health: Health; conditions: Condition[] } {
  const conditions: Condition[] = []
  const ratio = Number(snapshot.connection_ratio ?? 0)
  const connections = Number(snapshot.current_connections ?? 0)
  const maxConnections = Number(snapshot.max_connections ?? 0)
  const blocked = Number(snapshot.blocked_queries ?? 0)
  const longQueries = Number(snapshot.long_queries_30s ?? 0)
  const staleRuns = Number(snapshot.stale_system_job_runs ?? 0)

  if (ratio >= 0.95) {
    conditions.push({
      fingerprint: 'database.connection_pressure.critical',
      severity: 'critical',
      title: 'ChileFlota DB en presión crítica',
      message: `${connections}/${maxConnections} conexiones en uso (${Math.round(ratio * 100)}%).`,
      metadata: { connections, maxConnections, ratio },
    })
  } else if (ratio >= 0.85) {
    conditions.push({
      fingerprint: 'database.connection_pressure.high',
      severity: 'high',
      title: 'ChileFlota DB con presión alta',
      message: `${connections}/${maxConnections} conexiones en uso (${Math.round(ratio * 100)}%).`,
      metadata: { connections, maxConnections, ratio },
    })
  } else if (ratio >= 0.7) {
    conditions.push({
      fingerprint: 'database.connection_pressure.warning',
      severity: 'warning',
      title: 'ChileFlota DB con presión creciente',
      message: `${connections}/${maxConnections} conexiones en uso (${Math.round(ratio * 100)}%).`,
      metadata: { connections, maxConnections, ratio },
    })
  }

  if (blocked > 0) {
    conditions.push({
      fingerprint: 'database.blocked_queries',
      severity: blocked >= 3 ? 'critical' : 'high',
      title: 'Consultas bloqueadas en ChileFlota',
      message: `${blocked} consulta(s) bloqueada(s) detectada(s).`,
      metadata: { blocked },
    })
  }

  if (longQueries > 0) {
    conditions.push({
      fingerprint: 'database.long_queries',
      severity: longQueries >= 3 ? 'high' : 'warning',
      title: 'Consultas largas en ChileFlota',
      message: `${longQueries} consulta(s) activas por más de 30 segundos.`,
      metadata: { longQueries },
    })
  }

  if (staleRuns > 0) {
    conditions.push({
      fingerprint: 'cron.stale_runs',
      severity: staleRuns >= 3 ? 'high' : 'warning',
      title: 'Jobs Cronos stale',
      message: `${staleRuns} job(s) siguen running por más de 30 minutos.`,
      metadata: { staleRuns },
    })
  }

  const severity = conditions.reduce<Severity>(
    (worst, item) => severityRank(item.severity) > severityRank(worst) ? item.severity : worst,
    'ok',
  )

  return { severity, health: healthForSeverity(severity), conditions }
}

async function postWebhook(payload: Record<string, unknown>) {
  const url = process.env.HEALTH_ALERT_WEBHOOK_URL
  if (!url) return { sent: false, reason: 'not_configured' }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Health webhook returned HTTP ${response.status}`)
  }

  return { sent: true }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: rawSnapshot, error: snapshotError } = await supabase.rpc('cronos_health_snapshot')
  if (snapshotError) {
    return NextResponse.json({ error: snapshotError.message }, { status: 500 })
  }

  const snapshot = (rawSnapshot ?? {}) as Snapshot
  const classification = classify(snapshot)
  const reasons = classification.conditions.map((condition) => condition.message)

  const { error: checkError } = await supabase.from('system_health_checks').insert({
    health: classification.health,
    severity: classification.severity,
    metrics: snapshot,
    reasons,
  })
  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 })
  }

  const activeFingerprints = classification.conditions.map((condition) => condition.fingerprint)
  const opened: string[] = []
  const escalated: string[] = []

  for (const condition of classification.conditions) {
    const { data: existing, error: existingError } = await supabase
      .from('system_health_incidents')
      .select('id,severity,occurrences')
      .eq('fingerprint', condition.fingerprint)
      .eq('status', 'open')
      .maybeSingle()

    if (existingError) throw new Error(existingError.message)

    if (!existing) {
      const { error: insertError } = await supabase.from('system_health_incidents').insert({
        fingerprint: condition.fingerprint,
        severity: condition.severity,
        title: condition.title,
        message: condition.message,
        metadata: condition.metadata ?? {},
      })
      if (insertError) throw new Error(insertError.message)
      opened.push(condition.fingerprint)
    } else {
      const previousSeverity = existing.severity as Severity
      const didEscalate = severityRank(condition.severity) > severityRank(previousSeverity)
      const { error: updateError } = await supabase
        .from('system_health_incidents')
        .update({
          severity: didEscalate ? condition.severity : existing.severity,
          message: condition.message,
          occurrences: Number(existing.occurrences ?? 0) + 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: condition.metadata ?? {},
        })
        .eq('id', existing.id)
      if (updateError) throw new Error(updateError.message)
      if (didEscalate) escalated.push(condition.fingerprint)
    }
  }

  let openQuery = supabase
    .from('system_health_incidents')
    .select('id,fingerprint,title,severity')
    .eq('status', 'open')

  const { data: openIncidents, error: openError } = await openQuery
  if (openError) throw new Error(openError.message)

  const resolved = (openIncidents ?? []).filter((incident) => !activeFingerprints.includes(incident.fingerprint))
  for (const incident of resolved) {
    const now = new Date().toISOString()
    const { error: resolveError } = await supabase
      .from('system_health_incidents')
      .update({ status: 'resolved', resolved_at: now, last_seen_at: now, updated_at: now })
      .eq('id', incident.id)
    if (resolveError) throw new Error(resolveError.message)
  }

  const pauseRequired =
    classification.severity === 'critical' ||
    Number(snapshot.connection_ratio ?? 0) >= 0.85 ||
    Number(snapshot.blocked_queries ?? 0) > 0

  let shouldPause = pauseRequired
  if (!pauseRequired && classification.severity === 'ok') {
    const { data: recent } = await supabase
      .from('system_health_checks')
      .select('severity')
      .order('checked_at', { ascending: false })
      .limit(3)

    shouldPause = !((recent ?? []).length >= 3 && (recent ?? []).every((row) => row.severity === 'ok'))
  } else if (!pauseRequired) {
    const { data: currentFlag } = await supabase
      .from('system_runtime_flags')
      .select('enabled')
      .eq('key', 'background_processing_paused')
      .maybeSingle()
    shouldPause = Boolean(currentFlag?.enabled)
  }

  const pauseReason = shouldPause
    ? reasons[0] ?? 'Health Sentinel mantiene procesamiento de background pausado.'
    : 'Health Sentinel: 3 checks consecutivos saludables.'

  await supabase.from('system_runtime_flags').upsert({
    key: 'background_processing_paused',
    enabled: shouldPause,
    reason: pauseReason,
    metadata: {
      severity: classification.severity,
      captured_at: snapshot.captured_at ?? new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  })

  const alertEvents = [
    ...opened.map((fingerprint) => ({ type: 'opened', fingerprint })),
    ...escalated.map((fingerprint) => ({ type: 'escalated', fingerprint })),
    ...resolved.map((incident) => ({ type: 'resolved', fingerprint: incident.fingerprint })),
  ]

  if (alertEvents.length > 0) {
    const summary = classification.conditions.map((item) => item.message).join(' ') ||
      'El sistema volvió a estado saludable.'

    await supabase.from('alerts_log').insert({
      alert_type: 'system_health',
      title: classification.severity === 'ok'
        ? 'ChileFlota recuperado'
        : `ChileFlota Health Sentinel: ${classification.severity}`,
      description: summary,
      message: summary,
      priority: classification.severity === 'critical' ? 'critical'
        : classification.severity === 'high' ? 'high'
        : classification.severity === 'warning' ? 'medium'
        : 'low',
      entity_type: 'system',
      entity_name: 'ChileFlota',
      is_read: false,
      is_resolved: classification.severity === 'ok',
      status: classification.severity === 'ok' ? 'resolved' : 'active',
      metadata: { alertEvents, snapshot, backgroundProcessingPaused: shouldPause },
    })

    try {
      await postWebhook({
        system: 'ChileFlota',
        severity: classification.severity,
        health: classification.health,
        events: alertEvents,
        reasons,
        metrics: snapshot,
        backgroundProcessingPaused: shouldPause,
      })
    } catch (error) {
      console.error('[Cronos Health Sentinel] webhook error', error)
    }
  }

  return NextResponse.json({
    status: classification.health,
    severity: classification.severity,
    metrics: snapshot,
    conditions: classification.conditions,
    incidents: { opened, escalated, resolved: resolved.map((item) => item.fingerprint) },
    backgroundProcessingPaused: shouldPause,
    webhookConfigured: Boolean(process.env.HEALTH_ALERT_WEBHOOK_URL),
  })
}
