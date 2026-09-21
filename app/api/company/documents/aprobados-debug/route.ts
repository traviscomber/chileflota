export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { authorizeInternalDocumentRequest, DOCUMENT_DEBUG_ROLES } from '@/lib/document-route-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_DEBUG_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = createAdminClient()

    // Test different query approaches
    console.log('[v0] DEBUG: Testing different query approaches')

    // Approach 1: Basic select all
    const { data: all, count: allCount } = await supabase
      .from('subcontractor_documents')
      .select('id', { count: 'exact' })

    console.log('[v0] DEBUG: ALL subcontractor documents:', allCount, 'records')

    // Approach 2: Filter by approved
    const { data: approved } = await supabase
      .from('subcontractor_documents')
      .select('id')
      .eq('status', 'approved')

    console.log('[v0] DEBUG: Approved (status=approved):', approved?.length || 0)

    // Approach 3: Check what status values exist
    const { data: statuses } = await supabase
      .from('subcontractor_documents')
      .select('status')
      .neq('status', null)

    const statusCounts: { [key: string]: number } = {}
    statuses?.forEach(doc => {
      const s = doc.status || 'null'
      statusCounts[s] = (statusCounts[s] || 0) + 1
    })

    console.log('[v0] DEBUG: Status distribution:', statusCounts)

    // Approach 4: Check if there are RLS issues
    const { data: test, error: testError } = await supabase
      .from('subcontractor_documents')
      .select('id, status, file_name, created_at')
      .eq('status', 'approved')
      .limit(50)

    console.log('[v0] DEBUG: Limited query returned:', test?.length || 0, 'Error:', testError?.message)

    // Approach 5: Get total approved documents with and without limit
    const { data: allApproved1 } = await supabase
      .from('subcontractor_documents')
      .select('id')
      .eq('status', 'approved')

    const { data: allApproved2 } = await supabase
      .from('subcontractor_documents')
      .select('id')
      .eq('status', 'approved')
      .range(0, 1000)

    console.log('[v0] DEBUG: Query 1 (no range):', allApproved1?.length || 0)
    console.log('[v0] DEBUG: Query 2 (range 0-1000):', allApproved2?.length || 0)

    return NextResponse.json({
      debug: {
        total_records: allCount,
        approved_count: approved?.length || 0,
        status_distribution: statusCounts,
        limited_query: test?.length || 0,
        query1_no_range: allApproved1?.length || 0,
        query2_with_range: allApproved2?.length || 0,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error: any) {
    console.error('[v0] Debug error:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
