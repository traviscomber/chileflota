export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { authorizeInternalDocumentRequest, DOCUMENT_DEBUG_ROLES } from '@/lib/document-route-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_DEBUG_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const rut = searchParams.get('rut')

    console.log('[v0] Debug: Getting documents for RUT:', rut)

    if (!rut) {
      // Get ALL documents if no RUT specified
      const { data: allDocs, count } = await adminClient
        .from('uploaded_documents')
        .select('id, conductor_id, original_filename, validation_status, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(20)

      console.log('[v0] Total documents in table:', count)

      return NextResponse.json({
        total_count: count,
        sample_documents: allDocs,
      })
    }

    // Get documents for specific RUT
    const { data: docs, count } = await adminClient
      .from('uploaded_documents')
      .select('*', { count: 'exact' })
      .eq('conductor_id', rut)
      .order('created_at', { ascending: false })

    console.log('[v0] Documents for RUT', rut, ':', count)

    return NextResponse.json({
      rut,
      count,
      documents: docs,
    })
  } catch (error) {
    console.error('[v0] Debug error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
