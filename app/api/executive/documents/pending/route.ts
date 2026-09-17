export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth } from '@/lib/auth-middleware'

const LEGACY_MULTI_INSTANCE_CODES = new Set([
  'LIQUIDACION_SUELDO',
  'HOJA_VIDA',
  'CERT_ANTECEDENTES',
  'COMPROBANTE_PAGO',
  'PLANILLAS_IMPOSICIONES',
  'FOTO_PATENTES',
])

async function resolveExecutiveStaffId(request: NextRequest, email: string, authUserId: string) {
  const admin = createAdminClient()
  const cookieId = request.cookies.get('user_id')?.value

  if (cookieId) {
    const { data } = await admin
      .from('executive_staff')
      .select('id')
      .eq('id', cookieId)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  const { data: byEmail } = await admin
    .from('executive_staff')
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (byEmail?.id) return byEmail.id as string

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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user) {
      return NextResponse.json({ error: auth.error || 'No autenticado' }, { status: 401 })
    }

    if (!['ejecutiva', 'admin', 'administrador', 'super_admin'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const admin = createAdminClient()
    const executiveStaffId = await resolveExecutiveStaffId(request, auth.user.email, auth.user.id)

    if (!executiveStaffId && auth.user.role === 'ejecutiva') {
      return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
    }

    let companyQuery = admin
      .from('transportistas')
      .select('id, rut, razon_social, nombre_fantasia')
      .eq('is_active', true)

    if (auth.user.role === 'ejecutiva') {
      companyQuery = companyQuery.eq('assigned_executive_id', executiveStaffId)
    }

    const { data: companies, error: companiesError } = await companyQuery
    if (companiesError) throw companiesError

    const companyIds = (companies ?? []).map((company: any) => company.id)
    if (companyIds.length === 0) return NextResponse.json([], { status: 200 })

    const [{ data: types, error: typesError }, { data: rawDocuments, error: documentsError }] = await Promise.all([
      admin
        .from('subcontractor_document_types')
        .select('id, code, nombre'),
      admin
        .from('subcontractor_documents')
        .select('id, subcontractor_id, subcontractor_rut, document_type_id, file_url, file_name, status, uploaded_at, created_at, is_current, version_number')
        .in('subcontractor_id', companyIds)
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: false }),
    ])

    if (typesError) throw typesError
    if (documentsError) throw documentsError

    const companyById = new Map((companies ?? []).map((company: any) => [company.id, company]))
    const typeById = new Map((types ?? []).map((type: any) => [type.id, type]))

    const documents = (rawDocuments ?? [])
      .filter((doc: any) => {
        if (doc.is_current === true) return true
        const code = typeById.get(doc.document_type_id)?.code
        return Boolean(code && LEGACY_MULTI_INSTANCE_CODES.has(code))
      })
      .map((doc: any) => {
        const company = companyById.get(doc.subcontractor_id)
        const type = typeById.get(doc.document_type_id)
        const companyName = company?.razon_social || company?.nombre_fantasia || doc.subcontractor_rut || 'Empresa sin resolver'

        return {
          id: doc.id,
          source: 'subcontractor_documents',
          company_id: company?.id || doc.subcontractor_id,
          company_name: companyName,
          company_rut: company?.rut || doc.subcontractor_rut,
          conductor_name: companyName,
          document_type: type?.nombre || type?.code || 'Documento',
          document_type_code: type?.code || null,
          file_name: doc.file_name,
          status: doc.status,
          created_at: doc.uploaded_at || doc.created_at,
          file_url: doc.file_url,
          is_current: doc.is_current === true,
          version_number: doc.version_number,
        }
      })

    return NextResponse.json(documents, { status: 200 })
  } catch (error) {
    console.error('Error fetching executive pending documents:', error)
    return NextResponse.json(
      { error: 'Error al obtener documentos pendientes' },
      { status: 500 },
    )
  }
}
