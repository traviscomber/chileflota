import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function resolveExecutiveConductorIds(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  authUserId: string,
) {
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
    .select('rut')
    .eq('assigned_executive_id', executiveStaffId)
    .eq('is_active', true)

  if (companiesError) throw companiesError
  const ruts = (companies || []).map((row) => row.rut).filter(Boolean)
  if (ruts.length === 0) return []

  const { data: conductors, error: conductorsError } = await supabase
    .from('conductores')
    .select('id')
    .in('rut_proveedor', ruts)

  if (conductorsError) throw conductorsError
  return (conductors || []).map((row) => row.id).filter(Boolean)
}

/**
 * GET /api/company/documents/all
 * Returns ALL documents from all drivers (for dashboard statistics)
 * No parameters required
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const executiveConductorIds = user.role === 'ejecutiva'
      ? await resolveExecutiveConductorIds(adminClient, user.email, user.id)
      : null

    if (user.role === 'ejecutiva' && executiveConductorIds === null) {
      return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
    }

    if (executiveConductorIds && executiveConductorIds.length === 0) {
      return NextResponse.json(
        { success: true, documents: [], scope: 'assigned_executive_current' },
        { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } },
      )
    }

    let query: any = adminClient
      .from('uploaded_documents')
      .select(`
        id,
        conductor_id,
        original_filename,
        document_type_id,
        file_url,
        validation_status,
        rejection_reason,
        created_at,
        expiration_date,
        document_types (
          id,
          code,
          name
        ),
        conductores (
          id,
          nombres,
          apellido_paterno,
          rut,
          rut_proveedor
        )
      `)
      .eq('is_current', true)
      .order('created_at', { ascending: false })

    if (executiveConductorIds) query = query.in('conductor_id', executiveConductorIds)

    const { data: documents, error: dbError } = await query

    if (dbError) {
      console.error('[v0] Error querying current uploaded_documents:', dbError.message)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Map to response format
    const mappedDocs = (documents || []).map((doc: any) => {
      const docType = doc.document_types
      const conductor = doc.conductores

      return {
        id: doc.id,
        original_filename: doc.original_filename,
        document_type: docType?.name || docType?.code || 'Unknown',
        file_url: doc.file_url,
        validation_status: doc.validation_status || 'pending',
        rejection_reason: doc.rejection_reason,
        created_at: doc.created_at,
        expiration_date: doc.expiration_date,
        conductores: conductor,
        document_types: docType,
      }
    })

    return NextResponse.json({
      success: true,
      documents: mappedDocs,
      scope: user.role === 'ejecutiva' ? 'assigned_executive_current' : 'current',
    }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/company/documents/all:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
