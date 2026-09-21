export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'
import { canonicalizeApprovedConductorDocuments, canonicalizeApprovedSubcontractorDocuments } from '@/lib/document-review-canonical'

const ALLOWED_ROLES = new Set<UserRole>(['super_admin', 'admin', 'administrador', 'ejecutiva', 'prevencionista'])

type FocusMode = 'company' | 'conductor'
type Focus = { mode: FocusMode; id: string } | null

function getFocus(request: Request): Focus {
  const url = new URL(request.url)
  const mode = url.searchParams.get('focus_mode')
  const id = url.searchParams.get('focus_id')
  if ((mode !== 'company' && mode !== 'conductor') || !id) return null
  return { mode, id }
}

async function resolveExecutiveStaffId(supabase: ReturnType<typeof createAdminClient>, email: string, authUserId: string) {
  const { data: exact } = await supabase
    .from('executive_staff')
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (exact?.id) return exact.id as string

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', authUserId)
    .maybeSingle()

  if (!profile?.full_name) return null

  const { data: matches } = await supabase
    .from('executive_staff')
    .select('id')
    .ilike('full_name', profile.full_name)
    .eq('is_active', true)
    .limit(2)

  return matches?.length === 1 ? matches[0].id as string : null
}

async function fetchRowsByIds(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  select: string,
  column: string,
  ids: string[],
) {
  const rows: any[] = []
  const chunkSize = 50

  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize)
    const { data, error } = await supabase.from(table).select(select).in(column, chunk)
    if (error) throw error
    rows.push(...(data || []))
  }

  return rows
}

async function fetchAllApproved(supabase: ReturnType<typeof createAdminClient>, table: 'uploaded_documents' | 'subcontractor_documents') {
  const documents: any[] = []
  const pageSize = 1000
  for (let page = 0; ; page += 1) {
    const query = table === 'uploaded_documents'
      ? supabase.from(table).select('id,original_filename,document_type_id,validation_status,file_url,validated_at,ejecutiva,created_at,updated_at,conductor_id,document_period_month,document_period_year,document_period_start,version_number,supersedes_document_id').eq('validation_status', 'approved')
      : supabase.from(table).select('id,file_name,document_type_id,status,file_url,approved_at,reviewed_by_ejecutiva,reviewed_at,created_at,updated_at,uploaded_at,subcontractor_id,subcontractor_rut,document_period_month,document_period_year,document_period_start,version_number,supersedes_document_id,ai_document_type,ai_extracted_text').eq('status', 'approved')

    const { data, error } = await query
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    documents.push(...data)
    if (data.length < pageSize) break
  }
  return documents
}

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request as any)
    if (!auth.user) {
      return NextResponse.json({ error: auth.error || 'No autenticado' }, { status: 401 })
    }
    if (!ALLOWED_ROLES.has(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const focus = getFocus(request)
    let executiveCompanyIds: Set<string> | null = null

    if (auth.user.role === 'ejecutiva') {
      const executiveStaffId = await resolveExecutiveStaffId(supabase, auth.user.email, auth.user.id)
      if (!executiveStaffId) {
        return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
      }

      const { data: assignedCompanies, error: assignedCompaniesError } = await supabase
        .from('transportistas')
        .select('id')
        .eq('assigned_executive_id', executiveStaffId)
        .eq('is_active', true)

      if (assignedCompaniesError) throw assignedCompaniesError
      executiveCompanyIds = new Set((assignedCompanies || []).map((company: any) => company.id))
    }

    const [conductorDocs, subDocs, conductorTypesResult, subcontractorTypesResult, executivesResult] = await Promise.all([
      fetchAllApproved(supabase, 'uploaded_documents'),
      fetchAllApproved(supabase, 'subcontractor_documents'),
      supabase.from('document_types').select('id, code, name'),
      supabase.from('subcontractor_document_types').select('id, code, nombre'),
      supabase.from('executive_staff').select('id, full_name, email'),
    ])

    if (conductorTypesResult.error) throw conductorTypesResult.error
    if (subcontractorTypesResult.error) throw subcontractorTypesResult.error
    if (executivesResult.error) throw executivesResult.error

    const conductorTypeMap = new Map((conductorTypesResult.data || []).map((type: any) => [type.id, { code: type.code, nombre: type.name }]))
    const deprecatedCodes = new Set(['AFP', 'SALUD', 'MUTUAL', 'SEGURO_SOCIAL'])
    const subcontractorTypeMap = new Map((subcontractorTypesResult.data || []).filter((type: any) => !deprecatedCodes.has(type.code)).map((type: any) => [type.id, { code: type.code, nombre: type.nombre }]))

    const canonicalConductorDocs = canonicalizeApprovedConductorDocuments(conductorDocs)
    const canonicalSubDocs = canonicalizeApprovedSubcontractorDocuments(subDocs, subcontractorTypeMap)

    const conductorIds = [...new Set(canonicalConductorDocs.map((doc: any) => doc.conductor_id).filter(Boolean))]
    const subcontractorIds = [...new Set(canonicalSubDocs.map((doc: any) => doc.subcontractor_id).filter(Boolean))]

    const [conductors, subcontractors] = await Promise.all([
      conductorIds.length
        ? fetchRowsByIds(supabase, 'conductores', 'id,nombres,apellido_paterno,rut,rut_proveedor', 'id', conductorIds)
        : Promise.resolve([]),
      subcontractorIds.length
        ? fetchRowsByIds(supabase, 'transportistas', 'id,rut,razon_social,assigned_executive_id', 'id', subcontractorIds)
        : Promise.resolve([]),
    ])

    const conductorMap = new Map(conductors.map((conductor: any) => [conductor.id, conductor]))
    const providerRuts = [...new Set(conductors.map((conductor: any) => conductor.rut_proveedor).filter(Boolean))]
    const conductorCompanies = providerRuts.length
      ? await fetchRowsByIds(supabase, 'transportistas', 'id,rut,razon_social,assigned_executive_id', 'rut', providerRuts)
      : []

    const companyByRut = new Map(conductorCompanies.map((company: any) => [company.rut, company]))
    const companyById = new Map(subcontractors.map((company: any) => [company.id, company]))
    const executiveById = new Map((executivesResult.data || []).map((executive: any) => [executive.id, executive.full_name]))
    const executiveByEmail = new Map((executivesResult.data || []).filter((executive: any) => executive.email).map((executive: any) => [executive.email.toLowerCase(), executive.full_name]))
    const normalizedConductor = canonicalConductorDocs.map((doc: any) => {
      const conductor: any = conductorMap.get(doc.conductor_id)
      const company: any = companyByRut.get(conductor?.rut_proveedor)
      return {
        id: doc.id,
        original_filename: doc.original_filename,
        document_name: doc.original_filename,
        file_name: doc.original_filename,
        document_type_id: doc.document_type_id,
        validation_status: doc.validation_status,
        status: doc.validation_status,
        file_url: doc.file_url,
        validated_at: doc.validated_at || doc.updated_at,
        approved_at: doc.validated_at || doc.updated_at,
        reviewed_at: doc.validated_at || doc.updated_at,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        uploaded_at: doc.created_at,
        document_period_month: doc.document_period_month,
        document_period_year: doc.document_period_year,
        document_period_start: doc.document_period_start,
        version_number: doc.version_number,
        supersedes_document_id: doc.supersedes_document_id,
        is_current: true,
        conductores: conductor || null,
        transportistas: company || null,
        empresa_nombre: company?.razon_social || null,
        company_id: company?.id || null,
        ejecutiva: company?.assigned_executive_id ? executiveById.get(company.assigned_executive_id) || doc.ejecutiva || 'Sin asignar' : doc.ejecutiva || 'Sin asignar',
        docType: conductorTypeMap.get(doc.document_type_id) || null,
        document_source: 'conductor',
      }
    })

    const normalizedSub = canonicalSubDocs.map((doc: any) => {
      const company: any = companyById.get(doc.subcontractor_id)
      const reviewer = doc.reviewed_by_ejecutiva
      const resolvedReviewer = reviewer ? executiveByEmail.get(String(reviewer).toLowerCase()) || reviewer : null
      return {
        id: doc.id,
        original_filename: doc.file_name,
        document_name: doc.file_name,
        file_name: doc.file_name,
        document_type_id: doc.document_type_id,
        status: doc.status,
        file_url: doc.file_url,
        approved_at: doc.approved_at || doc.reviewed_at || doc.updated_at,
        reviewed_at: doc.reviewed_at || doc.approved_at || doc.updated_at,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        uploaded_at: doc.uploaded_at,
        document_period_month: doc.document_period_month,
        document_period_year: doc.document_period_year,
        document_period_start: doc.document_period_start,
        version_number: doc.version_number,
        supersedes_document_id: doc.supersedes_document_id,
        is_current: true,
        subcontractor_id: doc.subcontractor_id,
        subcontractor_rut: doc.subcontractor_rut,
        transportistas: company || null,
        empresa_nombre: company?.razon_social || null,
        company_id: doc.subcontractor_id,
        ejecutiva: company?.assigned_executive_id ? executiveById.get(company.assigned_executive_id) || resolvedReviewer || 'Sin asignar' : resolvedReviewer || 'Sin asignar',
        docType: subcontractorTypeMap.get(doc.document_type_id) || null,
        document_source: 'subcontractor',
      }
    })

    const scopedConductor = executiveCompanyIds
      ? normalizedConductor.filter((document: any) => document.company_id && executiveCompanyIds!.has(document.company_id))
      : normalizedConductor
    const scopedSub = executiveCompanyIds
      ? normalizedSub.filter((document: any) => document.company_id && executiveCompanyIds!.has(document.company_id))
      : normalizedSub

    const filterByFocus = (document: any) => !focus || (focus.mode === 'conductor' ? document.conductores?.id === focus.id : document.company_id === focus.id)
    const filteredConductor = scopedConductor.filter(filterByFocus)
    const filteredSub = scopedSub.filter(filterByFocus)
    const allDocs = [...filteredConductor, ...filteredSub].sort((a, b) => new Date(b.reviewed_at || b.updated_at || 0).getTime() - new Date(a.reviewed_at || a.updated_at || 0).getTime())

    const response = NextResponse.json({
      conductorDocs: filteredConductor,
      subDocs: filteredSub,
      allDocs,
      documents: allDocs,
      total: allDocs.length,
      scope: auth.user.role === 'ejecutiva' ? 'assigned_executive_canonical_current' : 'canonical_current',
      historyEndpoint: '/api/company/documents/history',
      timestamp: new Date().toISOString(),
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Approved documents endpoint error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
