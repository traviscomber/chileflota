export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get all pending certificates with their uploaded documents
    const { data: documents, error } = await supabase
      .from('certificates')
      .select(`
        id,
        certificate_type,
        status,
        created_at,
        file_url,
        uploaded_document_id,
        uploaded_documents!uploaded_document_id(
          conductor_id,
          conductores!conductor_id(
            nombres,
            apellido_paterno
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Format response
    const formatted = documents?.map((doc: any) => {
      const conductor = doc.uploaded_documents?.conductores
      const conductorName = conductor 
        ? `${conductor.nombres} ${conductor.apellido_paterno}`
        : 'Desconocido'
      
      return {
        id: doc.id,
        conductor_name: conductorName,
        document_type: doc.certificate_type,
        status: doc.status,
        created_at: doc.created_at,
        file_url: doc.file_url,
      }
    }) || []

    return NextResponse.json(formatted, { status: 200 })
  } catch (error) {
    console.error('Error fetching pending documents:', error)
    return NextResponse.json(
      { error: 'Error al obtener documentos pendientes' },
      { status: 500 }
    )
  }
}
