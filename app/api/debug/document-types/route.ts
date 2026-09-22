export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/client'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    if (!supabase) {
      return Response.json({
        error: 'Error de conexión a base de datos',
      }, { status: 500 })
    }
    
    // Test document_types fetch
    const { data: docTypes, error: docTypesError } = await supabase
      .from('document_types')
      .select('count', { count: 'exact' })
    
    if (docTypesError) {
      return Response.json({
        error: 'Failed to fetch document_types',
        details: docTypesError,
      }, { status: 500 })
    }

    // Fetch actual records
    const { data: records, error: recordsError } = await supabase
      .from('document_types')
      .select('*')
      .eq('is_active', true)
      .limit(5)

    if (recordsError) {
      return Response.json({
        error: 'Failed to fetch document_types records',
        details: recordsError,
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      count: records?.length || 0,
      records: records,
    })
  } catch (error) {
    console.error('[v0] Debug API error:', error)
    return Response.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
