import { createAdminClient } from "@/lib/supabase/admin"
import { verifyAuth } from "@/lib/auth-middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveExecutiveCompanyIds } from "@/lib/executive-scope"
import { isDisplayRelevantAlert } from "@/lib/alerts/relevance"

export const dynamic = 'force-dynamic'
export const revalidate = 30

interface AlertLog {
  id: string
  alert_type?: string
  title: string
  message?: string
  description?: string
  priority?: string
  entity_type?: string
  is_read?: boolean
  is_resolved?: boolean
  action_url?: string
  ejecutiva_nombre?: string
  status?: string
  transportista_id?: string
  driver_id?: string
  document_id?: string
  document_type?: string
  entity_name?: string
  metadata?: Record<string, unknown>
  action_notes?: string | null
  actioned_by?: string | null
  actioned_at?: string | null
  created_at: string
}

interface LegacyAlert {
  id: string
  title: string
  message: string
  type?: string
  priority?: string
  category?: string
  is_read?: boolean
  is_dismissed?: boolean
  action_url?: string
  status?: string
  metadata?: Record<string, unknown>
  action_notes?: string | null
  actioned_by?: string | null
  actioned_at?: string | null
  created_at: string
}

interface TransportistaIdentity {
  id: string
  rut?: string | null
  razon_social?: string | null
  nombre_fantasia?: string | null
}

interface NormalizedAlert {
  id: string
  type: string
  title: string
  message: string
  description: string
  priority: string
  category: string
  is_read: boolean
  is_dismissed: boolean
  action_url?: string
  ejecutiva_asignada?: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
  source: string
  [key: string]: unknown
}

function getMetadataTransportistaId(metadata?: Record<string, unknown>) {
  const value = metadata?.transportista_id || metadata?.subcontractor_id
  return typeof value === 'string' && value ? value : undefined
}

function getOperationalPriorityScore(alert: NormalizedAlert) {
  const priorityScore = alert.priority === 'critical'
    ? 100
    : alert.priority === 'high'
      ? 70
      : alert.priority === 'medium'
        ? 40
        : 10

  const text = `${alert.type} ${alert.title} ${alert.message} ${alert.document_type || ''}`.toLowerCase()
  let score = priorityScore

  if (alert.type.toLowerCase() === 'error') score += 25
  if (alert.type.toLowerCase() === 'warning') score += 10
  if (/venc|expir|rechaz|bloque|incumpl|f30|f30-1/.test(text)) score += 20

  const ageHours = Math.max(0, (Date.now() - new Date(alert.created_at).getTime()) / 3_600_000)
  if (ageHours >= 48) score += 15
  else if (ageHours >= 24) score += 8

  return score
}

function isOperationalPriorityAlert(alert: NormalizedAlert) {
  const status = String(alert.status || '').toLowerCase()
  const type = String(alert.type || '').toLowerCase()

  if (status === 'resuelto' || status === 'actioned' || status === 'completado') return false
  if (type === 'success' || alert.is_dismissed) return false

  return ['critical', 'high', 'medium'].includes(alert.priority)
    || type === 'error'
    || type === 'warning'
}

function buildIdentityMetadata(
  metadata: Record<string, unknown> | undefined,
  transportistaId: string | undefined,
  transportistaMap: Map<string, TransportistaIdentity>,
) {
  const identity = transportistaId ? transportistaMap.get(transportistaId) : undefined
  const transportistaNombre = identity?.nombre_fantasia || identity?.razon_social || undefined

  return {
    ...(metadata || {}),
    ...(transportistaId ? { transportista_id: transportistaId } : {}),
    ...(transportistaNombre ? { transportista_nombre: transportistaNombre } : {}),
    ...(identity?.razon_social ? { transportista_razon_social: identity.razon_social } : {}),
    ...(identity?.rut ? { transportista_rut: identity.rut } : {}),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const priority = url.searchParams.get('priority')
    const isRead = url.searchParams.get('is_read')
    const ejecutiva = url.searchParams.get('ejecutiva')
    const status = url.searchParams.get('status')
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10), 1), 500)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)
    const mode = url.searchParams.get('mode')
    const priorityMode = mode === 'priority'
    const executiveCompanyIds = user.role === 'ejecutiva'
      ? await resolveExecutiveCompanyIds(supabase, user.email, user.id)
      : null

    if (user.role === 'ejecutiva' && executiveCompanyIds === null) {
      return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
    }

    let alertsLogQuery = supabase.from('alerts_log').select('*', { count: 'exact' })
    if (executiveCompanyIds) {
      if (executiveCompanyIds.length === 0) {
        return NextResponse.json({ alerts: [], total: 0, limit, offset, ejecutiva: null })
      }
      alertsLogQuery = alertsLogQuery.in('transportista_id', executiveCompanyIds)
    }
    if (ejecutiva) alertsLogQuery = alertsLogQuery.eq('ejecutiva_nombre', ejecutiva)
    if (type) alertsLogQuery = alertsLogQuery.eq('alert_type', type)
    if (priority) alertsLogQuery = alertsLogQuery.eq('priority', priority)
    if (status) alertsLogQuery = alertsLogQuery.eq('status', status)
    if (priorityMode && !status) alertsLogQuery = alertsLogQuery.eq('status', 'pendiente')
    if (priorityMode && !priority) alertsLogQuery = alertsLogQuery.in('priority', ['critical', 'high', 'medium'])
    if (isRead !== null && isRead !== '') alertsLogQuery = alertsLogQuery.eq('is_read', isRead === 'true')

    const { data: logAlerts = [], error: logError } = await alertsLogQuery
      .order('created_at', { ascending: false })
      .limit(priorityMode ? Math.max(limit * 10, 100) : limit * 2)

    if (logError) console.error('alerts_log query error:', logError)

    let legacyQuery = supabase.from('alerts').select('*', { count: 'exact' })
    if (type) legacyQuery = legacyQuery.eq('type', type)
    if (priority) legacyQuery = legacyQuery.eq('priority', priority)
    if (status) legacyQuery = legacyQuery.eq('status', status)
    if (priorityMode && !status) legacyQuery = legacyQuery.eq('status', 'pendiente')
    if (priorityMode && !priority) legacyQuery = legacyQuery.in('priority', ['critical', 'high', 'medium'])
    if (isRead !== null && isRead !== '') legacyQuery = legacyQuery.eq('is_read', isRead === 'true')

    const { data: rawLegacyAlerts = [], error: legacyError } = await legacyQuery
      .order('created_at', { ascending: false })
      .limit(priorityMode ? Math.max(limit * 10, 100) : limit * 2)

    if (legacyError) console.warn('legacy alerts query skipped:', legacyError.message)

    const transportistaIds = Array.from(new Set([
      ...(logAlerts as AlertLog[]).map((alert) => alert.transportista_id).filter(Boolean),
      ...(rawLegacyAlerts as LegacyAlert[]).map((alert) => getMetadataTransportistaId(alert.metadata)).filter(Boolean),
    ])) as string[]

    const transportistaMap = new Map<string, TransportistaIdentity>()
    if (transportistaIds.length > 0) {
      const { data: transportistas = [], error: transportistaError } = await supabase
        .from('transportistas')
        .select('id, rut, razon_social, nombre_fantasia')
        .in('id', transportistaIds)

      if (transportistaError) {
        console.warn('alerts transportista enrichment skipped:', transportistaError.message)
      } else {
        for (const transportista of transportistas as TransportistaIdentity[]) {
          transportistaMap.set(transportista.id, transportista)
        }
      }
    }

    const alerts: NormalizedAlert[] = (logAlerts as AlertLog[]).map((alert) => {
      const metadata = buildIdentityMetadata(alert.metadata, alert.transportista_id, transportistaMap)
      const transportistaNombre = metadata.transportista_nombre as string | undefined
      const transportistaRut = metadata.transportista_rut as string | undefined

      return {
        id: `log_${alert.id}`,
        type: alert.alert_type || 'info',
        title: alert.title,
        message: alert.message || alert.description || '',
        description: alert.description || alert.message || '',
        priority: alert.priority || 'medium',
        category: alert.entity_type || 'general',
        is_read: alert.is_read ?? false,
        is_dismissed: alert.is_resolved ?? false,
        action_url: alert.action_url,
        ejecutiva_asignada: alert.ejecutiva_nombre,
        status: alert.status || 'pendiente',
        transportista_id: alert.transportista_id,
        transportista_nombre: transportistaNombre,
        transportista_rut: transportistaRut,
        driver_id: alert.driver_id,
        document_id: alert.document_id,
        document_type: alert.document_type,
        entity_name: alert.entity_name,
        action_notes: alert.action_notes,
        actioned_by: alert.actioned_by,
        actioned_at: alert.actioned_at,
        metadata,
        created_at: alert.created_at,
        source: 'alerts_log',
      }
    })

    const legacyAlerts: NormalizedAlert[] = legacyError
      ? []
      : (rawLegacyAlerts as LegacyAlert[])
          .filter((alert) => {
            if (!executiveCompanyIds) return true
            const transportistaId = getMetadataTransportistaId(alert.metadata)
            return Boolean(transportistaId && executiveCompanyIds.includes(transportistaId))
          })
          .map((alert) => {
          const transportistaId = getMetadataTransportistaId(alert.metadata)
          const metadata = buildIdentityMetadata(alert.metadata, transportistaId, transportistaMap)

          return {
            id: alert.id,
            type: alert.type || 'info',
            title: alert.title,
            message: alert.message || '',
            description: alert.message || '',
            priority: alert.priority || 'normal',
            category: alert.category || 'system',
            is_read: alert.is_read ?? false,
            is_dismissed: alert.is_dismissed ?? false,
            action_url: alert.action_url,
            status: alert.status || 'pendiente',
            action_notes: alert.action_notes,
            actioned_by: alert.actioned_by,
            actioned_at: alert.actioned_at,
            transportista_id: transportistaId,
            transportista_nombre: metadata.transportista_nombre,
            transportista_rut: metadata.transportista_rut,
            metadata,
            created_at: alert.created_at,
            source: 'alerts_legacy',
          }
        })

    const combined = [...alerts, ...legacyAlerts]
      .filter((alert) => isDisplayRelevantAlert(alert))
      .filter((alert) => !ejecutiva || alert.ejecutiva_asignada === ejecutiva)
      .filter((alert) => !priorityMode || isOperationalPriorityAlert(alert))
      .sort((a, b) => {
        if (priorityMode) {
          const scoreDiff = getOperationalPriorityScore(b) - getOperationalPriorityScore(a)
          if (scoreDiff !== 0) return scoreDiff
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

    const paginated = combined.slice(offset, offset + limit).map((alert) => priorityMode
      ? { ...alert, priority_score: getOperationalPriorityScore(alert) }
      : alert)
    const response = NextResponse.json({
      alerts: paginated,
      total: combined.length,
      limit,
      offset,
      ejecutiva: ejecutiva || null,
      mode: priorityMode ? 'priority' : 'all',
    })

    response.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    response.headers.set('Content-Type', 'application/json')
    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('alerts API GET unexpected error:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { ids, is_read, is_dismissed } = body as { ids: string[], is_read?: boolean, is_dismissed?: boolean }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids es requerido" }, { status: 400 })
    }

    const logIds = ids.filter((id) => id.startsWith('log_')).map((id) => id.slice(4))
    const legacyIds = ids.filter((id) => !id.startsWith('log_'))
    let updatedCount = 0

    if (logIds.length > 0) {
      const logUpdate: Record<string, unknown> = {}
      if (is_read !== undefined) logUpdate.is_read = is_read
      if (is_dismissed !== undefined) logUpdate.is_resolved = is_dismissed

      const { data, error } = await supabase
        .from('alerts_log')
        .update(logUpdate)
        .in('id', logIds)
        .select('id')
      if (error) throw error
      updatedCount += data?.length || 0
    }

    if (legacyIds.length > 0) {
      const legacyUpdate: Record<string, unknown> = {}
      if (is_read !== undefined) legacyUpdate.is_read = is_read
      if (is_dismissed !== undefined) legacyUpdate.is_dismissed = is_dismissed

      const { data, error } = await supabase
        .from('alerts')
        .update(legacyUpdate)
        .in('id', legacyIds)
        .select('id')
      if (error) throw error
      updatedCount += data?.length || 0
    }

    return NextResponse.json({
      updated: updatedCount,
      message: `${updatedCount} alertas actualizadas`,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('alerts API PATCH error:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
