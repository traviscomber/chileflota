import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeInternalDocumentRequest, DOCUMENT_WRITE_ROLES } from '@/lib/document-route-auth'

// Generador de código automático
function generateDocumentCode(
  companyCode: string,
  driverRut: string,
  documentType: string
): string {
  const typeMap: Record<string, string> = {
    'Licencia de Conducir': 'LIC',
    'Seguro': 'SEG',
    'Certificado': 'CERT',
    'Revisión Técnica': 'REV',
    'Antecedentes': 'ANT',
    'Permiso Especial': 'PER',
    'Documento': 'DOC'
  }

  const typeCode = typeMap[documentType] || 'DOC'
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()

  return `${companyCode}_${driverRut}_${typeCode}_${date}_${random}`
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { custom_code, expiration_date } = await request.json()
    const adminClient = createAdminClient()
    const documentId = params.id

    console.log('[v0] Updating document metadata:', { documentId, custom_code, expiration_date })

    // Obtener documento actual
    const { data: doc, error: getError } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (getError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    }

    // Si envían custom_code, usar ese
    if (custom_code) {
      updates.custom_code = custom_code
    }

    // Si envían expiration_date, validar y guardar
    if (expiration_date) {
      const expDate = new Date(expiration_date)
      if (isNaN(expDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expiration date' }, { status: 400 })
      }
      updates.expiration_date = expiration_date
    }

    // Actualizar documento
    const { data: updated, error: updateError } = await adminClient
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single()

    if (updateError) {
      console.error('[v0] Error updating document:', updateError)
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    console.log('[v0] Document updated:', updated.id)

    return NextResponse.json({
      success: true,
      document: updated,
      message: 'Document updated successfully'
    })
  } catch (error) {
    console.error('[v0] Error in PATCH /api/company/documents/[id]/rename:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}

// POST para generar código automático
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { company_code, driver_rut, document_type } = await request.json()
    const adminClient = createAdminClient()
    const documentId = params.id

    if (!company_code || !driver_rut || !document_type) {
      return NextResponse.json(
        { error: 'Missing required fields: company_code, driver_rut, document_type' },
        { status: 400 }
      )
    }

    // Generar código
    const generatedCode = generateDocumentCode(company_code, driver_rut, document_type)
    console.log('[v0] Generated document code:', generatedCode)

    // Verificar que no exista
    const { data: existing } = await adminClient
      .from('documents')
      .select('id')
      .eq('custom_code', generatedCode)
      .maybeSingle()

    let code = generatedCode
    if (existing) {
      // Si existe, agregar sufijo
      code = `${generatedCode}_DUP`
    }

    // Actualizar documento con el código
    const { data: updated, error: updateError } = await adminClient
      .from('documents')
      .update({ custom_code: code })
      .eq('id', documentId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      document: updated,
      generated_code: code
    })
  } catch (error) {
    console.error('[v0] Error generating code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    )
  }
}
