import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSupabaseError } from '@/lib/supabase/error-utils'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: documentTypes, error } = await supabase
      .from('subcontractor_document_types')
      .select('id, code, nombre, periodicidad, es_obligatorio')
      .order('nombre', { ascending: true })

    if (error) {
      logSupabaseError('[v0] Error fetching document types:', error)
      return NextResponse.json(
        { error: 'Error al obtener tipos de documentos' },
        { status: 500 }
      )
    }

    // Filter out deprecated types that have been replaced
    // AFP → PLANILLAS_IMPOSICIONES, SALUD → CERT_AFIL_MUTUAL, 
    // MUTUAL → CERT_TASAS_MUTUAL, SEGURO_SOCIAL → PLANILLAS_IMPOSICIONES
    const deprecatedCodes = ['AFP', 'SALUD', 'MUTUAL', 'SEGURO_SOCIAL']
    const activeTypes = documentTypes?.filter(dt => !deprecatedCodes.includes(dt.code)) || []

    return NextResponse.json({
      success: true,
      documentTypes: activeTypes,
    })

  } catch (error) {
    logSupabaseError('[v0] Error in document types endpoint:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
