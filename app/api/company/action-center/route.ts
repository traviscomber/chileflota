export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth } from '@/lib/auth-middleware'
import { LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES } from '@/lib/pending-document-semantics'

type ActionKind = 'expired' | 'rejected' | 'pending' | 'expiring'
type EntityType = 'subcontractor' | 'driver'

type SubcontractorDocumentRow = {
  id: string
  subcontractor_id: string | null
  document_type_id: string | null
  file_name: string | null
  status: string | null
  rejection_reason: string | null
  expires_at: string | null
  created_at: string | null
  updated_at: string | null
  ai_confidence: number | string | null
}

type DriverDocumentRow = {
  id: string
  conductor_id: string | null
  original_filename: string | null
  document_type: string | null
  validation_status: string | null
  rejection_reason: string | null
  expiration_date: string | null
  created_at: string | null
  updated_at: string | null
  extraction_confidence: number | string | null
  confidence_score: number | null
}

type ActionItem = {
  id: string
  entityType: EntityType
  entityId: string | null
  entityName: string
  entityRut: string | null
  documentType: string
  fileName: string | null
  state: ActionKind
  status: string | null
  expiresAt: string | null
  daysUntilExpiry: number | null
  rejectionReason: string | null
  confidence: number | null
  nextAction: string
  href: string
}

const DEFAULT_BUCKET_LIMIT = 12
const FULL_QUEUE_LIMIT = 50
const ACTION_KINDS: ActionKind[] = ['expired', 'rejected', 'pending', 'expiring']

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function daysUntil(value: string | null, today: Date) {
  if (!value) return null
  const target = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(target.getTime())) return null
  const start = new Date(`${dateOnly(today)}T00:00:00.000Z`)
  return Math.round((target.getTime() - start.getTime()) / 86400000)
}

function confidenceValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function nextActionFor(kind: ActionKind) {
  if (kind === 'expired') return 'Ver vencidos'
  if (kind === 'rejected') return 'Corregir y volver a cargar'
  if (kind === 'pending') return 'Revisar documento'
  return 'Ver renovaciones'
}

function hrefFor(kind: ActionKind) {
  if (kind === 'expired') return '/dashboard/company/action-center?state=expired'
  if (kind === 'rejected') return '/dashboard/company/documentos/rechazados'
  if (kind === 'pending') return '/dashboard/company/documentos/pendientes'
  return '/dashboard/company/action-center?state=expiring'
}

function actionRank(kind: ActionKind) {
  if (kind === 'expired') return 4
  if (kind === 'rejected') return 3
  if (kind === 'pending') return 2
  return 1
}

function compareItems(a: ActionItem, b: ActionItem) {
  const rankDelta = actionRank(b.state) - actionRank(a.state)
  if (rankDelta !== 0) return rankDelta
  if (a.state === 'expired' || a.state === 'expiring') {
    return (a.daysUntilExpiry ?? 99999) - (b.daysUntilExpiry ?? 99999)
  }
  return a.entityName.localeCompare(b.entityName, 'es')
}

function balancedQueue(items: ActionItem[], limit: number) {
  const quotas: Record<ActionKind, number> = { expired: 4, rejected: 3, pending: 2, expiring: 3 }
  const selected: ActionItem[] = []
  const selectedIds = new Set<string>()

  for (const kind of ACTION_KINDS) {
    items
      .filter((item) => item.state === kind)
      .sort(compareItems)
      .slice(0, quotas[kind])
      .forEach((item) => {
        if (selected.length < limit && !selectedIds.has(item.id)) {
          selected.push(item)
          selectedIds.add(item.id)
        }
      })
  }

  if (selected.length < limit) {
    items
      .filter((item) => !selectedIds.has(item.id))
      .sort(compareItems)
      .slice(0, limit - selected.length)
      .forEach((item) => selected.push(item))
  }

  return selected
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const today = new Date()
    const todayValue = dateOnly(today)
    const in30DaysValue = dateOnly(addDays(today, 30))
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 12)
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 12, 4), FULL_QUEUE_LIMIT)
    const requestedState = request.nextUrl.searchParams.get('state')
    const selectedState = ACTION_KINDS.includes(requestedState as ActionKind)
      ? (requestedState as ActionKind)
      : null
    const bucketLimit = selectedState ? FULL_QUEUE_LIMIT : DEFAULT_BUCKET_LIMIT

    const { data: multiInstanceTypes, error: typeError } = await supabase
      .from('subcontractor_document_types')
      .select('id')
      .in('code', [...LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES])
    if (typeError) throw typeError
    const legacyMultiInstanceTypeIds = (multiInstanceTypes || []).map((row: { id: string }) => row.id)

    const subBase = () => supabase
      .from('subcontractor_documents')
      .select('id,subcontractor_id,document_type_id,file_name,status,rejection_reason,expires_at,created_at,updated_at,ai_confidence')
      .eq('is_current', true)

    const driverBase = () => supabase
      .from('uploaded_documents')
      .select('id,conductor_id,original_filename,document_type,validation_status,rejection_reason,expiration_date,created_at,updated_at,extraction_confidence,confidence_score')
      .eq('is_current', true)

    const countCurrent = async (
      table: 'subcontractor_documents' | 'uploaded_documents',
      configure: (query: any) => any,
    ) => {
      let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('is_current', true)
      query = configure(query)
      const { count, error } = await query
      if (error) throw error
      return count || 0
    }

    const legacyPendingQuery = legacyMultiInstanceTypeIds.length
      ? supabase
          .from('subcontractor_documents')
          .select('id,subcontractor_id,document_type_id,file_name,status,rejection_reason,expires_at,created_at,updated_at,ai_confidence')
          .eq('is_current', false)
          .eq('status', 'pending')
          .in('document_type_id', legacyMultiInstanceTypeIds)
          .order('created_at', { ascending: true })
          .limit(bucketLimit)
      : Promise.resolve({ data: [], error: null })

    const legacyPendingCountQuery = legacyMultiInstanceTypeIds.length
      ? supabase
          .from('subcontractor_documents')
          .select('id', { count: 'exact', head: true })
          .eq('is_current', false)
          .eq('status', 'pending')
          .in('document_type_id', legacyMultiInstanceTypeIds)
      : Promise.resolve({ count: 0, error: null })

    const [
      subRejectedResult,
      subExpiredResult,
      subCurrentPendingResult,
      subExpiringResult,
      subLegacyPendingResult,
      driverRejectedResult,
      driverExpiredResult,
      driverPendingResult,
      driverExpiringResult,
      subRejectedCount,
      subExpiredCount,
      subCurrentPendingCount,
      subExpiringCount,
      subLegacyPendingCountResult,
      driverRejectedCount,
      driverExpiredCount,
      driverPendingCount,
      driverExpiringCount,
    ] = await Promise.all([
      subBase().eq('status', 'rejected').order('updated_at', { ascending: true }).limit(bucketLimit),
      subBase().eq('status', 'approved').lt('expires_at', todayValue).order('expires_at', { ascending: true }).limit(bucketLimit),
      subBase().eq('status', 'pending').order('created_at', { ascending: true }).limit(bucketLimit),
      subBase().eq('status', 'approved').gte('expires_at', todayValue).lte('expires_at', in30DaysValue).order('expires_at', { ascending: true }).limit(bucketLimit),
      legacyPendingQuery,
      driverBase().eq('validation_status', 'rejected').order('updated_at', { ascending: true }).limit(bucketLimit),
      driverBase().eq('validation_status', 'approved').lt('expiration_date', todayValue).order('expiration_date', { ascending: true }).limit(bucketLimit),
      driverBase().eq('validation_status', 'pending').order('created_at', { ascending: true }).limit(bucketLimit),
      driverBase().eq('validation_status', 'approved').gte('expiration_date', todayValue).lte('expiration_date', in30DaysValue).order('expiration_date', { ascending: true }).limit(bucketLimit),
      countCurrent('subcontractor_documents', (query) => query.eq('status', 'rejected')),
      countCurrent('subcontractor_documents', (query) => query.eq('status', 'approved').lt('expires_at', todayValue)),
      countCurrent('subcontractor_documents', (query) => query.eq('status', 'pending')),
      countCurrent('subcontractor_documents', (query) => query.eq('status', 'approved').gte('expires_at', todayValue).lte('expires_at', in30DaysValue)),
      legacyPendingCountQuery,
      countCurrent('uploaded_documents', (query) => query.eq('validation_status', 'rejected')),
      countCurrent('uploaded_documents', (query) => query.eq('validation_status', 'approved').lt('expiration_date', todayValue)),
      countCurrent('uploaded_documents', (query) => query.eq('validation_status', 'pending')),
      countCurrent('uploaded_documents', (query) => query.eq('validation_status', 'approved').gte('expiration_date', todayValue).lte('expiration_date', in30DaysValue)),
    ])

    const queryResults = [
      subRejectedResult,
      subExpiredResult,
      subCurrentPendingResult,
      subExpiringResult,
      subLegacyPendingResult,
      driverRejectedResult,
      driverExpiredResult,
      driverPendingResult,
      driverExpiringResult,
    ]
    const firstQueryError = queryResults.find((result: any) => result.error)?.error
    if (firstQueryError) throw firstQueryError
    if ((subLegacyPendingCountResult as any).error) throw (subLegacyPendingCountResult as any).error

    const subPendingRows = [
      ...((subCurrentPendingResult.data || []) as SubcontractorDocumentRow[]),
      ...(((subLegacyPendingResult as any).data || []) as SubcontractorDocumentRow[]),
    ]

    const subBuckets: Array<{ kind: ActionKind; rows: SubcontractorDocumentRow[] }> = [
      { kind: 'rejected', rows: (subRejectedResult.data || []) as SubcontractorDocumentRow[] },
      { kind: 'expired', rows: (subExpiredResult.data || []) as SubcontractorDocumentRow[] },
      { kind: 'pending', rows: subPendingRows },
      { kind: 'expiring', rows: (subExpiringResult.data || []) as SubcontractorDocumentRow[] },
    ]
    const driverBuckets: Array<{ kind: ActionKind; rows: DriverDocumentRow[] }> = [
      { kind: 'rejected', rows: (driverRejectedResult.data || []) as DriverDocumentRow[] },
      { kind: 'expired', rows: (driverExpiredResult.data || []) as DriverDocumentRow[] },
      { kind: 'pending', rows: (driverPendingResult.data || []) as DriverDocumentRow[] },
      { kind: 'expiring', rows: (driverExpiringResult.data || []) as DriverDocumentRow[] },
    ]

    const subcontractorIds = Array.from(new Set(
      subBuckets.flatMap((bucket) => bucket.rows.map((row) => row.subcontractor_id).filter(Boolean)),
    )) as string[]
    const driverIds = Array.from(new Set(
      driverBuckets.flatMap((bucket) => bucket.rows.map((row) => row.conductor_id).filter(Boolean)),
    )) as string[]
    const documentTypeIds = Array.from(new Set(
      subBuckets.flatMap((bucket) => bucket.rows.map((row) => row.document_type_id).filter(Boolean)),
    )) as string[]

    const [transportistasResult, driversResult, documentTypesResult] = await Promise.all([
      subcontractorIds.length
        ? supabase.from('transportistas').select('id,razon_social,rut').in('id', subcontractorIds)
        : Promise.resolve({ data: [], error: null }),
      driverIds.length
        ? supabase.from('drivers').select('id,first_name,last_name,rut').in('id', driverIds)
        : Promise.resolve({ data: [], error: null }),
      documentTypeIds.length
        ? supabase.from('subcontractor_document_types').select('id,nombre,code').in('id', documentTypeIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const lookupError = transportistasResult.error || driversResult.error || documentTypesResult.error
    if (lookupError) throw lookupError

    const transportistas = new Map((transportistasResult.data || []).map((row: any) => [row.id, row]))
    const drivers = new Map((driversResult.data || []).map((row: any) => [row.id, row]))
    const documentTypes = new Map((documentTypesResult.data || []).map((row: any) => [row.id, row]))
    const items: ActionItem[] = []

    for (const { kind, rows } of subBuckets) {
      for (const row of rows) {
        const company: any = row.subcontractor_id ? transportistas.get(row.subcontractor_id) : null
        const documentType: any = row.document_type_id ? documentTypes.get(row.document_type_id) : null
        items.push({
          id: `subcontractor:${row.id}`,
          entityType: 'subcontractor',
          entityId: row.subcontractor_id,
          entityName: company?.razon_social || 'Subcontratista sin nombre',
          entityRut: company?.rut || null,
          documentType: documentType?.nombre || documentType?.code || 'Documento',
          fileName: row.file_name,
          state: kind,
          status: row.status,
          expiresAt: row.expires_at,
          daysUntilExpiry: daysUntil(row.expires_at, today),
          rejectionReason: row.rejection_reason,
          confidence: confidenceValue(row.ai_confidence),
          nextAction: nextActionFor(kind),
          href: hrefFor(kind),
        })
      }
    }

    for (const { kind, rows } of driverBuckets) {
      for (const row of rows) {
        const driver: any = row.conductor_id ? drivers.get(row.conductor_id) : null
        const driverName = [driver?.first_name, driver?.last_name].filter(Boolean).join(' ').trim()
        items.push({
          id: `driver:${row.id}`,
          entityType: 'driver',
          entityId: row.conductor_id,
          entityName: driverName || row.original_filename || 'Conductor sin identificar',
          entityRut: driver?.rut || null,
          documentType: row.document_type || 'Documento de conductor',
          fileName: row.original_filename,
          state: kind,
          status: row.validation_status,
          expiresAt: row.expiration_date,
          daysUntilExpiry: daysUntil(row.expiration_date, today),
          rejectionReason: row.rejection_reason,
          confidence: confidenceValue(row.extraction_confidence ?? row.confidence_score),
          nextAction: nextActionFor(kind),
          href: hrefFor(kind),
        })
      }
    }

    const subLegacyPendingCount = Number((subLegacyPendingCountResult as any).count || 0)
    const counts = {
      expired: subExpiredCount + driverExpiredCount,
      rejected: subRejectedCount + driverRejectedCount,
      pending: subCurrentPendingCount + subLegacyPendingCount + driverPendingCount,
      expiring: subExpiringCount + driverExpiringCount,
    }
    const totalActionable = counts.expired + counts.rejected + counts.pending + counts.expiring
    const visibleItems = selectedState
      ? items.filter((item) => item.state === selectedState).sort(compareItems).slice(0, limit)
      : balancedQueue(items, limit)

    const response = NextResponse.json({
      summary: {
        totalActionable,
        ...counts,
        selectedState,
        generatedAt: new Date().toISOString(),
      },
      items: visibleItems,
    })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[action-center] Failed to build operational queue:', message)
    return NextResponse.json({ error: 'No fue posible cargar el centro de acción.' }, { status: 500 })
  }
}
