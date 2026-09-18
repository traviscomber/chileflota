export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'
import { canonicalizeRejectedConductorDocuments, canonicalizeRejectedSubcontractorDocuments } from '@/lib/document-review-canonical'

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

async function fetchAllRejectedSubcontractorDocuments(supabase: ReturnType<typeof createAdminClient>) {
  const documents: any[] = []
  const pageSize = 1000
  for (let page = 0; ; page += 1) {
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select(`id,file_name,document_type_id,status,file_url,rejection_reason,reviewed_at,reviewed_by_ejecutiva,created_at,updated_at,uploaded_at,subcontractor_id,subcontractor_rut,document_period_month,document_period_year,document_period_start,version_number,supersedes_document_id,ai_document_type,ai_extracted_text,transportistas:subcontractor_id(id,razon_social,rut)`)
      .eq('status', 'rejected')
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

async function fetchAllApprovedConductorDocuments(supabase: ReturnType<typeof createAdminClient>) {
  const documents: any[] = []
  const pageSize = 1000
  for (let page = 0; ; page += 1) {
    const { data, error } = await supabase
      .from('uploaded_documents')
      .select('id,original_filename,document_type_id,validation_status,validated_at,created_at,updated_at,conductor_id,document_period_month,document_period_year,document_period_start,version_number')
      .eq('validation_status', 'approved')
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

async function fetchAllApprovedSubcontractorDocuments(supabase: ReturnType<typeof createAdminClient>) {
  const documents: any[] = []
  const pageSize = 1000
  for (let page = 0; ; page += 1) {
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select('id,file_name,document_type_id,status,reviewed_at,approved_at,created_at,updated_at,subcontractor_id,document_period_month,document_period_year,document_period_start,version_number,ai_document_type,ai_extracted_text')
      .eq('status', 'approved')
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

    const [conductorResult, approvedConductorResult, subDocs, approvedSubResult, conductorTypesResult, subcontractorTypesResult, executivesResult] = await Promise.all([
      supabase.from('uploaded_documents').select(`id,original_filename,document_type_id,validation_status,file_url,rejection_reason,validated_at,ejecutiva,created_at,updated_at,conductor_id,document_period_month,document_period_year,document_period_start,version_number,supersedes_document_id,conductores(id,nombres,apellido_paterno,rut,rut_proveedor)`).eq('validation_status', 'rejected').eq('is_current', true).order('updated_at', { ascending: false }),
      fetchAllApprovedConductorDocuments(supabase),
      fetchAllRejectedSubcontractorDocuments(supabase),
      fetchAllApprovedSubcontractorDocuments(supabase),
      supabase.from('document_types').select('id, code, name'),
      supabase.from('subcontractor_document_types').select('id, code, nombre'),
      supabase.from('executive_staff').select('id, full_name'),
    ])

    if (conductorResult.error) throw conductorResult.error
    if (conductorTypesResult.error) throw conductorTypesResult.error
    if (subcontractorTypesResult.error) throw subcontractorTypesResult.error
    if (executivesResult.error) throw executivesResult.error

    const conductorDocs = conductorResult.data || []
    const approvedConductorDocs = approvedConductorResult || []
    const approvedSubDocs = approvedSubResult || []
    const conductorTypeMap = new Map((conductorTypesResult.data || []).map((type) => [type.id, { code: type.code, nombre: type.name }]))
    const deprecatedCodes = new Set(['AFP', 'SALUD', 'MUTUAL', 'SEGURO_SOCIAL'])
    const subcontractorTypeMap = new Map((subcontractorTypesResult.data || []).filter((type) => !deprecatedCodes.has(type.code)).map((type) => [type.id, { code: type.code, nombre: type.nombre }]))
    const canonicalConductorDocs = canonicalizeRejectedConductorDocuments(conductorDocs, approvedConductorDocs)
    const canonicalSubDocs = canonicalizeRejectedSubcontractorDocuments(subDocs, approvedSubDocs, subcontractorTypeMap)
    const executiveMap = new Map((executivesResult.data || []).map((executive) => [executive.id, executive.full_name]))

    const providerRuts = [...new Set(canonicalConductorDocs.map((doc: any) => doc.conductores?.rut_proveedor).filter(Boolean))]
    const subcontractorIds = [...new Set(canonicalSubDocs.map((doc: any) => doc.subcontractor_id).filter(Boolean))]
    const [conductorCompaniesResult, subcontractorCompaniesResult] = await Promise.all([
      providerRuts.length ? supabase.from('transportistas').select('id, rut, razon_social, assigned_executive_id').in('rut', providerRuts) : Promise.resolve({ data: [], error: null }),
      subcontractorIds.length ? supabase.from('transportistas').select('id, rut, razon_social, assigned_executive_id').in('id', subcontractorIds) : Promise.resolve({ data: [], error: null }),
    ])
    if (conductorCompaniesResult.error) throw conductorCompaniesResult.error
    if (subcontractorCompaniesResult.error) throw subcontractorCompaniesResult.error

    const companyByRut = new Map((conductorCompaniesResult.data || []).map((company: any) => [company.rut, company]))
    const companyById = new Map((subcontractorCompaniesResult.data || []).map((company: any) => [company.id, company]))

    const normalizedConductor = canonicalConductorDocs.map((doc: any) => {
      const company: any = companyByRut.get(doc.conductores?.rut_proveedor)
      return {
        id: doc.id, original_filename: doc.original_filename, document_name: doc.original_filename, file_name: doc.original_filename,
        document_type_id: doc.document_type_id, validation_status: doc.validation_status, status: doc.validation_status,
        file_url: doc.file_url, rejection_reason: doc.rejection_reason, rejected_at: doc.validated_at || doc.updated_at,
        reviewed_at: doc.validated_at || doc.updated_at, created_at: doc.created_at, updated_at: doc.updated_at, uploaded_at: doc.created_at,
        document_period_month: doc.document_period_month, document_period_year: doc.document_period_year, document_period_start: doc.document_period_start,
        version_number: doc.version_number, supersedes_document_id: doc.supersedes_document_id, is_current: true,
        conductores: doc.conductores, transportistas: company || null, empresa_nombre: company?.razon_social || null, company_id: company?.id || null,
        ejecutiva: company?.assigned_executive_id ? executiveMap.get(company.assigned_executive_id) || doc.ejecutiva || 'Sin asignar' : doc.ejecutiva || 'Sin asignar',
        docType: conductorTypeMap.get(doc.document_type_id) || null, document_source: 'conductor',
      }
    })

    const normalizedSub = canonicalSubDocs.map((doc: any) => {
      const company: any = companyById.get(doc.subcontractor_id) || doc.transportistas || null
      return {
        id: doc.id, original_filename: doc.file_name, document_name: doc.file_name, file_name: doc.file_name,
        document_type_id: doc.document_type_id, status: doc.status, file_url: doc.file_url, rejection_reason: doc.rejection_reason,
        rejected_at: doc.reviewed_at || doc.updated_at, reviewed_at: doc.reviewed_at || doc.updated_at,
        created_at: doc.created_at, updated_at: doc.updated_at, uploaded_at: doc.uploaded_at,
        document_period_month: doc.document_period_month, document_period_year: doc.document_period_year, document_period_start: doc.document_period_start,
        version_number: doc.version_number, supersedes_document_id: doc.supersedes_document_id, is_current: true,
        subcontractor_id: doc.subcontractor_id, subcontractor_rut: doc.subcontractor_rut, transportistas: company,
        empresa_nombre: company?.razon_social || null, company_id: doc.subcontractor_id,
        ejecutiva: company?.assigned_executive_id ? executiveMap.get(company.assigned_executive_id) || doc.reviewed_by_ejecutiva || 'Sin asignar' : doc.reviewed_by_ejecutiva || 'Sin asignar',
        docType: subcontractorTypeMap.get(doc.document_type_id) || null, document_source: 'subcontractor',
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
    const allDocs = [...filteredConductor, ...filteredSub].sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())

    const response = NextResponse.json({ conductorDocs: filteredConductor, subDocs: filteredSub, allDocs, documents: allDocs, total: allDocs.length, scope: auth.user.role === 'ejecutiva' ? 'assigned_executive_canonical_current' : 'canonical_current', historyEndpoint: '/api/company/documents/history', timestamp: new Date().toISOString() })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Rejected documents endpoint error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
