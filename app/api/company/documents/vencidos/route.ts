import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { authorizeInternalDocumentRequest, DOCUMENT_READ_ROLES } from '@/lib/document-route-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/company/documents/vencidos
 * Returns documents that are already expired (vencidos)
 * Used for critical renewal workflow
 */
export async function GET(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_READ_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const adminClient = await createAdminClient()

    console.log('[v0] Fetching expired documents')

    // Calculate cutoff: documents expired up to today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // STEP: Query documents with expiration_date before today
    const { data: documents, error: dbError } = await adminClient
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
          rut
        )
      `)
      .lt('expiration_date', today.toISOString().split('T')[0])
      .eq('validation_status', 'approved')
      .order('expiration_date', { ascending: true })

    if (dbError) {
      console.error('[v0] Error querying expired documents:', dbError.message)
      return NextResponse.json({ success: true, documents: [] }, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      })
    }

    // Map to response format with days overdue
    const mappedDocs = (documents || []).map((doc: any) => {
      const expirationDate = new Date(doc.expiration_date)
      const daysOverdue = Math.ceil((today.getTime() - expirationDate.getTime()) / (1000 * 60 * 60 * 24))
      const docType = doc.document_types
      const conductor = doc.conductores

      return {
        id: doc.id,
        original_filename: doc.original_filename,
        document_type: docType?.name || docType?.code || 'Unknown',
        file_url: doc.file_url,
        validation_status: doc.validation_status || 'pending',
        created_at: doc.created_at,
        expiration_date: doc.expiration_date,
        days_overdue: daysOverdue,
        conductores: conductor,
        document_types: docType,
      }
    })

    console.log('[v0] Returned', mappedDocs.length, 'expired documents')

    return NextResponse.json({ success: true, documents: mappedDocs }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/company/documents/vencidos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expired documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
