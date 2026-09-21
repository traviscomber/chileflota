import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSupabaseError } from '@/lib/supabase/error-utils'
import { authorizeInternalDocumentRequest, DOCUMENT_READ_ROLES } from '@/lib/document-route-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_READ_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('conductores')
      .select('id, rut, nombres, apellido_paterno')
      .limit(10)
      .order('apellido_paterno', { ascending: true })

    if (error) {
      logSupabaseError('[v0] Error fetching recent drivers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch drivers', details: error.message },
        { status: 500 }
      )
    }

    const drivers = (data || []).map(d => ({
      id: d.id,
      rut: d.rut,
      nombre: `${d.nombres} ${d.apellido_paterno || ''}`.trim()
    }))

    return NextResponse.json({
      drivers,
      total: drivers.length
    })
  } catch (error) {
    logSupabaseError('[v0] Error in recent-drivers:', error)
    return NextResponse.json(
      { error: 'Server error', details: String(error) },
      { status: 500 }
    )
  }
}
