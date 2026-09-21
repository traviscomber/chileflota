import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { authorizeInternalDocumentRequest, DOCUMENT_READ_ROLES } from '@/lib/document-route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_READ_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get('driver_id')
    const driverRut = searchParams.get('driver_rut')

    if ((!driverId || driverId === 'undefined') && (!driverRut || driverRut === 'undefined')) {
      console.log('[v0] Missing both driver_id and driver_rut parameters')
      return NextResponse.json({ error: 'driver_id or driver_rut required' }, { status: 400 })
    }

    console.log('[v0] Fetching documents for driver_id:', driverId, 'rut:', driverRut)

    const adminClient = await createAdminClient()

    // STEP 1: Resolve conductor UUID
    // First, try driver_id as if it were already a UUID
    let conductorUUID: string | null = null

    // Check if driverId looks like a UUID (contains hyphens in UUID format)
    const isUUID = driverId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(driverId)
    
    if (isUUID) {
      conductorUUID = driverId
      console.log('[v0] Using driver_id as UUID:', conductorUUID)
    } else if (driverRut) {
      // Resolve UUID from RUT
      const { data: conductorRow } = await adminClient
        .from('conductores')
        .select('id')
        .eq('rut', driverRut)
        .single()
      
      if (conductorRow?.id) {
        conductorUUID = conductorRow.id
        console.log('[v0] Resolved RUT', driverRut, 'to conductor UUID:', conductorUUID)
      }
    }

    if (!conductorUUID) {
      console.log('[v0] Could not resolve conductor UUID from driver_id:', driverId, 'rut:', driverRut)
      return NextResponse.json({ success: true, documents: [] }, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      })
    }

    // STEP 2: Query uploaded_documents using the resolved UUID
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
        )
      `)
      .eq('conductor_id', conductorUUID)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('[v0] Error querying uploaded_documents:', dbError.message)
      return NextResponse.json({ success: true, documents: [] }, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      })
    }

    console.log('[v0] Found', documents?.length || 0, 'documents for conductor_id:', conductorUUID)

    const statusMap: Record<string, string> = {
      'approved': 'aprobado',
      'validated': 'aprobado',
      'rejected': 'rechazado',
      'pending': 'pendiente',
      'expired': 'vencido',
      'aprobado': 'aprobado',
      'rechazado': 'rechazado',
      'pendiente': 'pendiente',
      'vencido': 'vencido',
    }

    const formattedDocs = (documents || []).map((doc: any) => {
      const rawStatus = (doc.validation_status || 'pending').toLowerCase()
      const estadoEspanol = statusMap[rawStatus] || 'pendiente'

      console.log('[v0] Formatting doc:', {
        id: doc.id,
        rawValidationStatus: doc.validation_status,
        rawStatusLower: rawStatus,
        estadoEspanol,
        willSendAsVerificationStatus: estadoEspanol,
      })

      return {
        id: doc.id,
        driver_rut: driverRut || '',
        file_name: doc.original_filename,
        original_filename: doc.original_filename,
        upload_date: doc.created_at,
        created_at: doc.created_at,
        document_type: doc.document_types?.name || doc.original_filename || 'Documento',
        document_type_code: doc.document_types?.code,
        verification_status: estadoEspanol,
        validation_status: doc.validation_status,
        rejection_reason: doc.rejection_reason || null,
        expiration_date: doc.expiration_date || null,
        size: 0,
        storage_path: '',
        public_url: doc.file_url || '',
      }
    })

    return NextResponse.json({ success: true, conductor_id: driverId, documents: formattedDocs }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })

  } catch (error) {
    console.error('[v0] Error in GET /api/company/documents/drivers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching documents' },
      { status: 500 }
    )
  }
}
