import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'
import { getExecutiveScope, type ExecutiveScopeMode } from '@/lib/executive-coverage-scope'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type FocusMode = 'company' | 'conductor'
type Focus = {
  mode: FocusMode
  id: string
}

const ALLOWED_ROLES = new Set<UserRole>(['super_admin', 'admin', 'administrador', 'ejecutiva', 'prevencionista'])
const PAGE_SIZE = 1000

function getFocus(request: Request): Focus | null {
  const url = new URL(request.url)
  const mode = url.searchParams.get('focus_mode')
  const id = url.searchParams.get('focus_id')

  if ((mode !== 'company' && mode !== 'conductor') || !id) return null
  return { mode, id }
}

async function resolveExecutiveStaffId(admin: ReturnType<typeof createAdminClient>, email: string, authUserId: string) {
  const { data: exact } = await admin
    .from('executive_staff')
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (exact?.id) return exact.id as string

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', authUserId)
    .maybeSingle()

  if (!profile?.full_name) return null

  const { data: matches } = await admin
    .from('executive_staff')
    .select('id')
    .ilike('full_name', profile.full_name)
    .eq('is_active', true)
    .limit(2)

  return matches?.length === 1 ? matches[0].id as string : null
}

async function fetchAllPages<T>(buildPage: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1)
    if (error) throw error

    const page = (data || []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request as any)
    if (!auth.user) {
      return NextResponse.json({ error: auth.error || 'No autenticado', success: false }, { status: 401 })
    }
    if (!ALLOWED_ROLES.has(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado', success: false }, { status: 403 })
    }

    const supabase = await createClient()
    const admin = createAdminClient()
    const focus = getFocus(request)
    const currentPeriod = getCurrentChilePeriod()
    const requestedExecutiveScope = getExecutiveScope(request)

    let executiveStaffId: string | null = null
    let executiveCompanyIds: Set<string> | null = null
    let executiveCompanyRuts: string[] = []
    let executiveConductorIds: string[] = []
    let allActiveCompanyIds: Set<string> | null = null
    let effectiveExecutiveScope: ExecutiveScopeMode = auth.user.role === 'ejecutiva' ? requestedExecutiveScope.mode : 'all'
    let selectedExecutiveId: string | null = null

    if (auth.user.role === 'ejecutiva') {
      executiveStaffId = await resolveExecutiveStaffId(admin, auth.user.email, auth.user.id)
      if (!executiveStaffId) {
        return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa', success: false }, { status: 403 })
      }

      let portfolioExecutiveId = executiveStaffId

      if (requestedExecutiveScope.mode === 'executive') {
        const { data: selectedExecutive, error: selectedExecutiveError } = await admin
          .from('executive_staff')
          .select('id')
          .eq('id', requestedExecutiveScope.executiveId)
          .eq('is_active', true)
          .maybeSingle()

        if (selectedExecutiveError) throw selectedExecutiveError
        if (!selectedExecutive?.id) {
          return NextResponse.json({ error: 'La ejecutiva seleccionada no está activa', success: false }, { status: 400 })
        }

        portfolioExecutiveId = selectedExecutive.id
        selectedExecutiveId = selectedExecutive.id
      } else if (requestedExecutiveScope.mode === 'all') {
        const { data: activeCompanies, error: activeCompaniesError } = await admin
          .from('transportistas')
          .select('id')
          .eq('is_active', true)

        if (activeCompaniesError) throw activeCompaniesError
        allActiveCompanyIds = new Set((activeCompanies || []).map((company: any) => company.id))
      }

      if (requestedExecutiveScope.mode !== 'all') {
        const { data: assignedCompanies, error: assignedCompaniesError } = await admin
          .from('transportistas')
          .select('id, rut')
          .eq('assigned_executive_id', portfolioExecutiveId)
          .eq('is_active', true)

        if (assignedCompaniesError) throw assignedCompaniesError

        executiveCompanyIds = new Set((assignedCompanies || []).map((company: any) => company.id))
        executiveCompanyRuts = (assignedCompanies || []).map((company: any) => company.rut).filter(Boolean)

        const assignedCompanyIds = Array.from(executiveCompanyIds)
        const [conductorsByCompanyId, conductorsByProviderRut] = await Promise.all([
          assignedCompanyIds.length > 0
            ? admin.from('conductores').select('id').in('transportista_id', assignedCompanyIds)
            : Promise.resolve({ data: [], error: null }),
          executiveCompanyRuts.length > 0
            ? admin.from('conductores').select('id').in('rut_proveedor', executiveCompanyRuts)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (conductorsByCompanyId.error) throw conductorsByCompanyId.error
        if (conductorsByProviderRut.error) throw conductorsByProviderRut.error

        executiveConductorIds = [...new Set([
          ...(conductorsByCompanyId.data || []).map((conductor: any) => conductor.id),
          ...(conductorsByProviderRut.data || []).map((conductor: any) => conductor.id),
        ])]
      }
    }

    const assignedCompanyIdList = executiveCompanyIds ? Array.from(executiveCompanyIds) : []

    const conductorPromise = executiveCompanyIds && executiveConductorIds.length === 0
      ? Promise.resolve([] as any[])
      : fetchAllPages<any>((from, to) => {
          let query: any = supabase
            .from('uploaded_documents')
            .select(`
              id,
              original_filename,
              document_type_id,
              validation_status,
              file_url,
              created_at,
              updated_at,
              document_period_month,
              document_period_year,
              document_period_start,
              conductor_id,
              version_number,
              is_current,
              conductores (
                id,
                nombres,
                apellido_paterno,
                rut,
                rut_proveedor,
                transportista_id
              )
            `)
            .eq('is_current', true)
            .or('validation_status.eq.pending,validation_status.is.null')
            .order('created_at', { ascending: false })
            .range(from, to)

          if (executiveCompanyIds) query = query.in('conductor_id', executiveConductorIds)
          return query
        })

    const subPromise = executiveCompanyIds && assignedCompanyIdList.length === 0
      ? Promise.resolve([] as any[])
      : fetchAllPages<any>((from, to) => {
          let query: any = supabase
            .from('subcontractor_documents')
            .select(`
              id,
              file_name,
              document_type_id,
              status,
              file_url,
              created_at,
              updated_at,
              uploaded_at,
              subcontractor_id,
              subcontractor_rut,
              reviewed_by_ejecutiva,
              uploaded_by_ejecutiva,
              document_period_month,
              document_period_year,
              document_period_start,
              version_number,
              is_current
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .range(from, to)

          if (executiveCompanyIds) query = query.in('subcontractor_id', assignedCompanyIdList)
          return query
        })

    const [
      conductorDocs,
      rawSubDocs,
      conductorTypesResult,
      subTypesResult,
      executivesResult,
    ] = await Promise.all([
      conductorPromise,
      subPromise,
      supabase.from('document_types').select('id, code, name'),
      supabase.from('subcontractor_document_types').select('id, code, nombre, periodicidad'),
      supabase.from('executive_staff').select('id, full_name, email, is_active').order('full_name'),
    ])

    if (conductorTypesResult.error) throw conductorTypesResult.error
    if (subTypesResult.error) throw subTypesResult.error
    if (executivesResult.error) throw executivesResult.error

    const conductorTypeMap = new Map(
      (conductorTypesResult.data || []).map((item) => [item.id, { code: item.code, nombre: item.name }]),
    )

    const deprecatedCodes = new Set(['AFP', 'SALUD', 'MUTUAL', 'SEGURO_SOCIAL'])
    const subTypeMap = new Map(
      (subTypesResult.data || [])
        .filter((item) => !deprecatedCodes.has(item.code))
        .map((item) => [item.id, { code: item.code, nombre: item.nombre, periodicidad: item.periodicidad }]),
    )

    const executiveNameMap = new Map(
      (executivesResult.data || []).map((item) => [item.id, item.full_name]),
    )

    // Review queue semantics are intentionally simple:
    // every subcontractor upload whose own status is pending requires review.
    // Legacy is_current/version chains do not decide visibility here.
    const subDocs = rawSubDocs

    const providerRuts = [...new Set(conductorDocs.map((doc: any) => doc.conductores?.rut_proveedor).filter(Boolean))]
    const directCompanyIds = [...new Set(conductorDocs.map((doc: any) => doc.conductores?.transportista_id).filter(Boolean))]
    const subIds = [...new Set(subDocs.map((doc: any) => doc.subcontractor_id).filter(Boolean))]
    const subRuts = [...new Set(subDocs.map((doc: any) => doc.subcontractor_rut).filter(Boolean))]

    const [providerCompaniesResult, directCompaniesResult, subCompaniesByIdResult, subCompaniesByRutResult] = await Promise.all([
      providerRuts.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('rut', providerRuts)
        : Promise.resolve({ data: [], error: null }),
      directCompanyIds.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('id', directCompanyIds)
        : Promise.resolve({ data: [], error: null }),
      subIds.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('id', subIds)
        : Promise.resolve({ data: [], error: null }),
      subRuts.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('rut', subRuts)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (providerCompaniesResult.error) throw providerCompaniesResult.error
    if (directCompaniesResult.error) throw directCompaniesResult.error
    if (subCompaniesByIdResult.error) throw subCompaniesByIdResult.error
    if (subCompaniesByRutResult.error) throw subCompaniesByRutResult.error

    const companyByRut = new Map([
      ...(providerCompaniesResult.data || []).map((item: any) => [item.rut, item] as const),
      ...(subCompaniesByRutResult.data || []).map((item: any) => [item.rut, item] as const),
    ])
    const companyByDirectId = new Map((directCompaniesResult.data || []).map((item: any) => [item.id, item]))
    const companyById = new Map((subCompaniesByIdResult.data || []).map((item: any) => [item.id, item]))

    const normalizedConductorDocs = conductorDocs.map((doc: any) => {
      const company = companyByDirectId.get(doc.conductores?.transportista_id) || companyByRut.get(doc.conductores?.rut_proveedor)
      return {
        id: doc.id,
        original_filename: doc.original_filename,
        document_name: doc.original_filename,
        file_name: doc.original_filename,
        document_type_id: doc.document_type_id,
        validation_status: doc.validation_status,
        status: doc.validation_status || 'pending',
        file_url: doc.file_url,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        uploaded_at: doc.created_at,
        document_period_month: doc.document_period_month,
        document_period_year: doc.document_period_year,
        document_period_start: doc.document_period_start,
        version_number: doc.version_number,
        is_current: true,
        conductores: doc.conductores,
        docType: conductorTypeMap.get(doc.document_type_id) || null,
        transportistas: company || null,
        empresa_nombre: company?.razon_social || company?.nombre_fantasia || null,
        company_id: company?.id || null,
        ejecutiva: company?.assigned_executive_id
          ? executiveNameMap.get(company.assigned_executive_id) || 'Sin asignar'
          : 'Sin asignar',
        document_source: 'conductor',
      }
    })

    const normalizedSubDocs = subDocs.map((doc: any) => {
      const company = companyById.get(doc.subcontractor_id) || companyByRut.get(doc.subcontractor_rut)
      return {
        id: doc.id,
        file_name: doc.file_name,
        document_name: doc.file_name,
        original_filename: doc.file_name,
        document_type_id: doc.document_type_id,
        status: doc.status,
        file_url: doc.file_url,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        uploaded_at: doc.uploaded_at,
        subcontractor_id: doc.subcontractor_id,
        subcontractor_rut: doc.subcontractor_rut,
        reviewed_by_ejecutiva: doc.reviewed_by_ejecutiva,
        uploaded_by_ejecutiva: doc.uploaded_by_ejecutiva,
        document_period_month: doc.document_period_month,
        document_period_year: doc.document_period_year,
        document_period_start: doc.document_period_start,
        version_number: doc.version_number,
        is_current: doc.is_current === true,
        transportistas: company || null,
        empresa_nombre: company?.razon_social || company?.nombre_fantasia || null,
        docType: subTypeMap.get(doc.document_type_id) || null,
        company_id: company?.id || doc.subcontractor_id,
        ejecutiva: company?.assigned_executive_id
          ? executiveNameMap.get(company.assigned_executive_id) || 'Sin asignar'
          : 'Sin asignar',
        document_source: 'subcontractor',
      }
    })

    const effectiveCompanyScope = executiveCompanyIds || allActiveCompanyIds
    const scopedConductorDocs = effectiveCompanyScope
      ? normalizedConductorDocs.filter((doc: any) => doc.company_id && effectiveCompanyScope.has(doc.company_id))
      : normalizedConductorDocs
    const scopedSubDocs = effectiveCompanyScope
      ? normalizedSubDocs.filter((doc: any) => doc.company_id && effectiveCompanyScope.has(doc.company_id))
      : normalizedSubDocs

    const filteredConductorDocs = focus
      ? scopedConductorDocs.filter((doc: any) =>
          focus.mode === 'conductor' ? doc.conductores?.id === focus.id : doc.company_id === focus.id,
        )
      : scopedConductorDocs

    const filteredSubDocs = focus
      ? scopedSubDocs.filter((doc: any) => focus.mode === 'company' && doc.company_id === focus.id)
      : scopedSubDocs

    const pendingRequirementSlots = new Set(
      filteredSubDocs.map((doc: any) => [
        doc.company_id,
        doc.document_type_id,
        doc.document_period_year,
        doc.document_period_month,
      ].join(':')),
    ).size

    return NextResponse.json({
      conductorDocs: filteredConductorDocs,
      subDocs: filteredSubDocs,
      scope: auth.user.role === 'ejecutiva'
        ? (effectiveExecutiveScope === 'mine' ? 'assigned_executive_pending_submissions' : 'coverage_pending_submissions')
        : 'pending_submissions',
      executiveStaffId,
      reviewScope: auth.user.role === 'ejecutiva'
        ? {
            mode: effectiveExecutiveScope,
            actorExecutiveStaffId: executiveStaffId,
            selectedExecutiveId,
            canCover: true,
            availableExecutives: (executivesResult.data || [])
              .filter((item: any) => item.is_active === true)
              .map((item: any) => ({ id: item.id, nombre: item.full_name, email: item.email })),
          }
        : { mode: 'all', canCover: false, availableExecutives: [] },
      diagnostics: auth.user.role === 'ejecutiva'
        ? {
            assignedCompanies: executiveCompanyIds?.size || 0,
            assignedConductors: executiveConductorIds.length,
            rawConductorPending: conductorDocs.length,
            rawSubcontractorPending: rawSubDocs.length,
            visibleConductorPending: filteredConductorDocs.length,
            visibleSubcontractorPending: filteredSubDocs.length,
            requirementSlots: pendingRequirementSlots,
            extraDocumentsBeyondOnePerRequirement: Math.max(0, filteredSubDocs.length - pendingRequirementSlots),
            reviewSemantics: 'submission_status',
            pagination: { pageSize: PAGE_SIZE, complete: true },
          }
        : undefined,
      companyResolution: 'canonical_transportistas_after_auth',
      success: true,
    })
  } catch (error) {
    console.error('[v0] Error fetching current pending documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending documents', success: false },
      { status: 500 },
    )
  }
}
