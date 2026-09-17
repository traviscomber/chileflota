import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type FocusMode = 'company' | 'conductor'

type Focus = {
  mode: FocusMode
  id: string
}

const ALLOWED_ROLES = new Set<UserRole>(['super_admin', 'admin', 'administrador', 'ejecutiva', 'prevencionista'])

const LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES = new Set([
  'LIQUIDACION_SUELDO',
  'HOJA_VIDA',
  'CERT_ANTECEDENTES',
  'COMPROBANTE_PAGO',
  'PLANILLAS_IMPOSICIONES',
  'FOTO_PATENTES',
])

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

    let executiveStaffId: string | null = null
    let executiveCompanyIds: Set<string> | null = null
    let executiveCompanyRuts: string[] = []
    let executiveConductorIds: string[] = []

    if (auth.user.role === 'ejecutiva') {
      executiveStaffId = await resolveExecutiveStaffId(admin, auth.user.email, auth.user.id)
      if (!executiveStaffId) {
        return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa', success: false }, { status: 403 })
      }

      const { data: assignedCompanies, error: assignedCompaniesError } = await admin
        .from('transportistas')
        .select('id, rut')
        .eq('assigned_executive_id', executiveStaffId)
        .eq('is_active', true)

      if (assignedCompaniesError) throw assignedCompaniesError

      executiveCompanyIds = new Set((assignedCompanies || []).map((company: any) => company.id))
      executiveCompanyRuts = (assignedCompanies || []).map((company: any) => company.rut).filter(Boolean)

      if (executiveCompanyRuts.length > 0) {
        const { data: executiveConductors, error: executiveConductorsError } = await admin
          .from('conductores')
          .select('id')
          .in('rut_proveedor', executiveCompanyRuts)

        if (executiveConductorsError) throw executiveConductorsError
        executiveConductorIds = (executiveConductors || []).map((conductor: any) => conductor.id)
      }
    }

    const conductorBaseQuery = supabase
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
          rut_proveedor
        )
      `)
      .eq('is_current', true)
      .or('validation_status.eq.pending,validation_status.is.null')
      .order('created_at', { ascending: false })
      .limit(10000)

    const subBaseQuery = supabase
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
      .limit(10000)

    const conductorPromise = executiveCompanyIds
      ? executiveConductorIds.length > 0
        ? conductorBaseQuery.in('conductor_id', executiveConductorIds)
        : Promise.resolve({ data: [], error: null })
      : conductorBaseQuery

    const assignedCompanyIdList = executiveCompanyIds ? Array.from(executiveCompanyIds) : []
    const subPromise = executiveCompanyIds
      ? assignedCompanyIdList.length > 0
        ? subBaseQuery.in('subcontractor_id', assignedCompanyIdList)
        : Promise.resolve({ data: [], error: null })
      : subBaseQuery

    const [conductorResult, subResult, conductorTypesResult, subTypesResult, executivesResult] = await Promise.all([
      conductorPromise,
      subPromise,
      supabase.from('document_types').select('id, code, name'),
      supabase.from('subcontractor_document_types').select('id, code, nombre'),
      supabase.from('executive_staff').select('id, full_name'),
    ])

    if (conductorResult.error) throw conductorResult.error
    if (subResult.error) throw subResult.error
    if (conductorTypesResult.error) throw conductorTypesResult.error
    if (subTypesResult.error) throw subTypesResult.error
    if (executivesResult.error) throw executivesResult.error

    const conductorDocs = conductorResult.data || []
    const rawSubDocs = subResult.data || []

    const conductorTypeMap = new Map(
      (conductorTypesResult.data || []).map((item) => [item.id, { code: item.code, nombre: item.name }]),
    )

    const deprecatedCodes = new Set(['AFP', 'SALUD', 'MUTUAL', 'SEGURO_SOCIAL'])
    const subTypeMap = new Map(
      (subTypesResult.data || [])
        .filter((item) => !deprecatedCodes.has(item.code))
        .map((item) => [item.id, { code: item.code, nombre: item.nombre }]),
    )

    const executiveNameMap = new Map(
      (executivesResult.data || []).map((item) => [item.id, item.full_name]),
    )

    const subDocs = rawSubDocs.filter((doc: any) => {
      if (doc.is_current === true) return true
      const typeCode = subTypeMap.get(doc.document_type_id)?.code
      return Boolean(typeCode && LEGACY_MULTI_INSTANCE_SUBCONTRACTOR_CODES.has(typeCode))
    })

    const providerRuts = [...new Set(conductorDocs.map((doc: any) => doc.conductores?.rut_proveedor).filter(Boolean))]
    const subIds = [...new Set(subDocs.map((doc: any) => doc.subcontractor_id).filter(Boolean))]
    const subRuts = [...new Set(subDocs.map((doc: any) => doc.subcontractor_rut).filter(Boolean))]

    const [providerCompaniesResult, subCompaniesByIdResult, subCompaniesByRutResult] = await Promise.all([
      providerRuts.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('rut', providerRuts)
        : Promise.resolve({ data: [], error: null }),
      subIds.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('id', subIds)
        : Promise.resolve({ data: [], error: null }),
      subRuts.length > 0
        ? admin.from('transportistas').select('id, rut, razon_social, nombre_fantasia, assigned_executive_id').in('rut', subRuts)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (providerCompaniesResult.error) throw providerCompaniesResult.error
    if (subCompaniesByIdResult.error) throw subCompaniesByIdResult.error
    if (subCompaniesByRutResult.error) throw subCompaniesByRutResult.error

    const companyByRut = new Map([
      ...(providerCompaniesResult.data || []).map((item: any) => [item.rut, item] as const),
      ...(subCompaniesByRutResult.data || []).map((item: any) => [item.rut, item] as const),
    ])
    const companyById = new Map((subCompaniesByIdResult.data || []).map((item: any) => [item.id, item]))

    const normalizedConductorDocs = conductorDocs.map((doc: any) => {
      const company = companyByRut.get(doc.conductores?.rut_proveedor)
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

    const scopedConductorDocs = executiveCompanyIds
      ? normalizedConductorDocs.filter((doc: any) => doc.company_id && executiveCompanyIds!.has(doc.company_id))
      : normalizedConductorDocs
    const scopedSubDocs = executiveCompanyIds
      ? normalizedSubDocs.filter((doc: any) => doc.company_id && executiveCompanyIds!.has(doc.company_id))
      : normalizedSubDocs

    const filteredConductorDocs = focus
      ? scopedConductorDocs.filter((doc: any) =>
          focus.mode === 'conductor' ? doc.conductores?.id === focus.id : doc.company_id === focus.id,
        )
      : scopedConductorDocs

    const filteredSubDocs = focus
      ? scopedSubDocs.filter((doc: any) => focus.mode === 'company' && doc.company_id === focus.id)
      : scopedSubDocs

    return NextResponse.json({
      conductorDocs: filteredConductorDocs,
      subDocs: filteredSubDocs,
      scope: auth.user.role === 'ejecutiva'
        ? 'assigned_executive_current_plus_legacy_multi_instance_pending'
        : 'current_plus_legacy_multi_instance_pending',
      executiveStaffId,
      diagnostics: auth.user.role === 'ejecutiva'
        ? {
            assignedCompanies: executiveCompanyIds?.size || 0,
            assignedConductors: executiveConductorIds.length,
            rawConductorPending: conductorDocs.length,
            rawSubcontractorPending: rawSubDocs.length,
            visibleConductorPending: filteredConductorDocs.length,
            visibleSubcontractorPending: filteredSubDocs.length,
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
