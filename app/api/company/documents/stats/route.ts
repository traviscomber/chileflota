export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth } from '@/lib/auth-middleware'
import { countActionableSubcontractorPending } from '@/lib/pending-document-semantics'

type TransportistaCertificationFlags = {
  ariztia: boolean | null
  lts: boolean | null
  rendic: boolean | null
  interpolar: boolean | null
}

type LegacyDocumentRow = {
  original_filename: string | null
  validation_status: string | null
  processed_at: string | null
  ai_processed_at: string | null
  ai_analyzed_at: string | null
  vision_processed_at: string | null
}

type ExecutiveScope = {
  executiveStaffId: string
  companyIds: string[]
  companyRuts: string[]
  conductorIds: string[]
}

function normalizeFilename(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function legacyWasProcessed(doc: LegacyDocumentRow) {
  return Boolean(
    doc.validation_status === 'approved' ||
      doc.validation_status === 'rejected' ||
      doc.processed_at ||
      doc.ai_processed_at ||
      doc.ai_analyzed_at ||
      doc.vision_processed_at,
  )
}

async function resolveExecutiveScope(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  authUserId: string,
): Promise<ExecutiveScope | null> {
  const { data: exact } = await supabase
    .from('executive_staff')
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  let executiveStaffId = exact?.id as string | undefined

  if (!executiveStaffId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', authUserId)
      .maybeSingle()

    if (profile?.full_name) {
      const { data: matches } = await supabase
        .from('executive_staff')
        .select('id')
        .ilike('full_name', profile.full_name)
        .eq('is_active', true)
        .limit(2)

      if (matches?.length === 1) executiveStaffId = matches[0].id as string
    }
  }

  if (!executiveStaffId) return null

  const { data: companies, error: companiesError } = await supabase
    .from('transportistas')
    .select('id,rut')
    .eq('assigned_executive_id', executiveStaffId)
    .eq('is_active', true)

  if (companiesError) throw companiesError

  const companyIds = (companies || []).map((row) => row.id).filter(Boolean)
  const companyRuts = (companies || []).map((row) => row.rut).filter(Boolean) as string[]

  let conductorIds: string[] = []
  if (companyRuts.length > 0) {
    const { data: conductores, error: conductoresError } = await supabase
      .from('conductores')
      .select('id')
      .in('rut_proveedor', companyRuts)

    if (conductoresError) throw conductoresError
    conductorIds = (conductores || []).map((row) => row.id).filter(Boolean)
  }

  return { executiveStaffId, companyIds, companyRuts, conductorIds }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const executiveScope = user.role === 'ejecutiva'
      ? await resolveExecutiveScope(supabase, user.email, user.id)
      : null

    if (user.role === 'ejecutiva' && !executiveScope) {
      return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
    }

    const scopeQuery = (query: any, kind: 'conductor' | 'subcontractor') => {
      if (!executiveScope) return query
      const ids = kind === 'conductor' ? executiveScope.conductorIds : executiveScope.companyIds
      if (ids.length === 0) return null
      return query.in(kind === 'conductor' ? 'conductor_id' : 'subcontractor_id', ids)
    }

    const runCount = async (
      table: string,
      kind: 'conductor' | 'subcontractor',
      configure?: (query: any) => any,
      currentOnly = true,
    ) => {
      let query: any = supabase.from(table).select('id', { count: 'exact', head: true })
      if (currentOnly) query = query.eq('is_current', true)
      if (configure) query = configure(query)
      query = scopeQuery(query, kind)
      if (!query) return 0
      const { count, error } = await query
      if (error) throw error
      return count || 0
    }

    const countByStatus = (
      table: string,
      kind: 'conductor' | 'subcontractor',
      statusColumn: string,
      status: string,
    ) => runCount(table, kind, (query) => query.eq(statusColumn, status))

    const countPending = (
      table: string,
      kind: 'conductor' | 'subcontractor',
      statusColumn: string,
    ) => runCount(
      table,
      kind,
      (query) => kind === 'conductor'
        ? query.or(`${statusColumn}.eq.pending,${statusColumn}.is.null`)
        : query.eq(statusColumn, 'pending'),
    )

    const countCanonicalProcessed = async (applyScope = true) => {
      let query: any = supabase
        .from('subcontractor_documents')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.approved,status.eq.rejected,ai_analyzed_at.not.is.null,reviewed_at.not.is.null,f30_validated_at.not.is.null')

      if (applyScope) {
        query = scopeQuery(query, 'subcontractor')
        if (!query) return 0
      }

      const { count, error } = await query
      if (error) throw error
      return count || 0
    }

    let legacyDocumentsQuery: any = supabase
      .from('uploaded_documents')
      .select('original_filename,validation_status,processed_at,ai_processed_at,ai_analyzed_at,vision_processed_at')
    legacyDocumentsQuery = scopeQuery(legacyDocumentsQuery, 'conductor')

    const globalLegacyDocumentsQuery = supabase
      .from('uploaded_documents')
      .select('original_filename,validation_status,processed_at,ai_processed_at,ai_analyzed_at,vision_processed_at')

    let transportistasQuery: any = supabase
      .from('transportistas')
      .select('ariztia,lts,rendic,interpolar')
    if (executiveScope) {
      transportistasQuery = executiveScope.companyIds.length > 0
        ? transportistasQuery.in('id', executiveScope.companyIds)
        : null
    }

    const [
      conductorTotal,
      conductorManaged,
      conductorApproved,
      conductorRejected,
      conductorPending,
      subcontractorTotal,
      subcontractorManaged,
      subcontractorApproved,
      subcontractorRejected,
      subcontractorPending,
      actionablePendingGlobal,
      canonicalProcessed,
      globalCanonicalProcessed,
      legacyDocumentsResult,
      globalLegacyDocumentsResult,
      transportistasResult,
    ] = await Promise.all([
      runCount('uploaded_documents', 'conductor'),
      runCount('uploaded_documents', 'conductor', undefined, false),
      countByStatus('uploaded_documents', 'conductor', 'validation_status', 'approved'),
      countByStatus('uploaded_documents', 'conductor', 'validation_status', 'rejected'),
      countPending('uploaded_documents', 'conductor', 'validation_status'),
      runCount('subcontractor_documents', 'subcontractor'),
      runCount('subcontractor_documents', 'subcontractor', undefined, false),
      countByStatus('subcontractor_documents', 'subcontractor', 'status', 'approved'),
      countByStatus('subcontractor_documents', 'subcontractor', 'status', 'rejected'),
      countPending('subcontractor_documents', 'subcontractor', 'status'),
      executiveScope ? Promise.resolve(null) : countActionableSubcontractorPending(supabase),
      countCanonicalProcessed(),
      countCanonicalProcessed(false),
      legacyDocumentsQuery || Promise.resolve({ data: [], error: null }),
      globalLegacyDocumentsQuery,
      transportistasQuery || Promise.resolve({ data: [], error: null }),
    ])

    if (legacyDocumentsResult.error) throw legacyDocumentsResult.error
    if (globalLegacyDocumentsResult.error) throw globalLegacyDocumentsResult.error
    if (transportistasResult.error) throw transportistasResult.error

    const legacyDocuments = (legacyDocumentsResult.data || []) as LegacyDocumentRow[]
    const legacyFilenames = Array.from(
      new Set(legacyDocuments.map((doc) => doc.original_filename).filter((name): name is string => Boolean(name))),
    )

    let canonicalLegacyFilenameKeys = new Set<string>()
    if (legacyFilenames.length > 0) {
      let canonicalMatchesQuery: any = supabase
        .from('subcontractor_documents')
        .select('file_name')
        .in('file_name', legacyFilenames)
      canonicalMatchesQuery = scopeQuery(canonicalMatchesQuery, 'subcontractor')

      if (canonicalMatchesQuery) {
        const { data: canonicalMatches, error: canonicalMatchesError } = await canonicalMatchesQuery
        if (canonicalMatchesError) throw canonicalMatchesError
        canonicalLegacyFilenameKeys = new Set(
          (canonicalMatches || [])
            .map((row: any) => normalizeFilename(row.file_name))
            .filter(Boolean),
        )
      }
    }

    const uniqueLegacyDocuments = legacyDocuments.filter((doc) => {
      const key = normalizeFilename(doc.original_filename)
      return !key || !canonicalLegacyFilenameKeys.has(key)
    })
    const uniqueLegacyProcessed = uniqueLegacyDocuments.filter(legacyWasProcessed).length

    const globalLegacyDocuments = (globalLegacyDocumentsResult.data || []) as LegacyDocumentRow[]
    const globalLegacyFilenames = Array.from(
      new Set(globalLegacyDocuments.map((doc) => doc.original_filename).filter((name): name is string => Boolean(name))),
    )

    let globalCanonicalLegacyFilenameKeys = new Set<string>()
    if (globalLegacyFilenames.length > 0) {
      const { data: globalCanonicalMatches, error: globalCanonicalMatchesError } = await supabase
        .from('subcontractor_documents')
        .select('file_name')
        .in('file_name', globalLegacyFilenames)

      if (globalCanonicalMatchesError) throw globalCanonicalMatchesError
      globalCanonicalLegacyFilenameKeys = new Set(
        (globalCanonicalMatches || [])
          .map((row: any) => normalizeFilename(row.file_name))
          .filter(Boolean),
      )
    }

    const globalUniqueLegacyDocuments = globalLegacyDocuments.filter((doc) => {
      const key = normalizeFilename(doc.original_filename)
      return !key || !globalCanonicalLegacyFilenameKeys.has(key)
    })
    const globalUniqueLegacyProcessed = globalUniqueLegacyDocuments.filter(legacyWasProcessed).length

    const lifetimeRegistered = subcontractorManaged + uniqueLegacyDocuments.length
    const lifetimeProcessed = canonicalProcessed + uniqueLegacyProcessed
    const lifetimeAwaitingProcessing = Math.max(lifetimeRegistered - lifetimeProcessed, 0)
    const globalLifetimeProcessed = globalCanonicalProcessed + globalUniqueLegacyProcessed

    const certificationFlags = (transportistasResult.data || []) as TransportistaCertificationFlags[]
    const totalCertifications = certificationFlags.reduce((total, transportista) => {
      return total + [transportista.ariztia, transportista.lts, transportista.rendic, transportista.interpolar]
        .filter(Boolean).length
    }, 0)

    const stats = {
      conductores: {
        total: conductorTotal,
        processed: conductorManaged,
        pendientes: conductorPending,
        aprobados: conductorApproved,
        rechazados: conductorRejected,
        vencidos: 0,
      },
      subcontratistas: {
        total: subcontractorTotal,
        processed: subcontractorManaged,
        pendientes: subcontractorPending,
        aprobados: subcontractorApproved,
        rechazados: subcontractorRejected,
        vencidos: 0,
      },
      lifetime: {
        registered: lifetimeRegistered,
        processed: lifetimeProcessed,
        awaitingProcessing: lifetimeAwaitingProcessing,
        legacyUnique: uniqueLegacyDocuments.length,
        legacyMigrationDuplicatesExcluded: legacyDocuments.length - uniqueLegacyDocuments.length,
        globalProcessed: globalLifetimeProcessed,
      },
      certificaciones: {
        total: totalCertifications,
        vigentes: totalCertifications,
        porVencer: 0,
        vencidas: 0,
      },
      attentionRequired: actionablePendingGlobal,
      scope: executiveScope
        ? {
            mode: 'assigned_executive',
            executiveStaffId: executiveScope.executiveStaffId,
            assignedCompanies: executiveScope.companyIds.length,
            assignedConductors: executiveScope.conductorIds.length,
          }
        : { mode: 'role_default' },
    }

    const response = NextResponse.json({ stats, timestamp: new Date().toISOString() })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Stats API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
