import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeInternalDocumentRequest, DOCUMENT_WRITE_ROLES } from '@/lib/document-route-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('[v0] ==================== DOCUMENT UPLOAD POST ====================')
  console.log('[v0] Upload endpoint called at:', new Date().toISOString())
  
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await request.formData()
    console.log('[v0] FormData entries:', Array.from(formData.entries()).map(([k, v]) => [k, v instanceof File ? `File(${v.name})` : v]))
    
    // Get file from formData - should be first file in form
    let file: File | null = null
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        file = value
        break
      }
    }

    const conductorId = formData.get('conductor_id') as string
    const documentTypeId = formData.get('document_type_id') as string
    const originalFilename = formData.get('original_filename') as string

    console.log('[v0] Upload request:', { 
      conductorId, 
      documentTypeId,
      fileName: file?.name,
      originalFilename,
      fileSize: file?.size 
    })

    // Validate inputs
    if (!file) {
      console.error('[v0] No file provided in FormData')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!conductorId) {
      console.error('[v0] No conductor_id provided')
      return NextResponse.json({ error: 'Conductor ID required' }, { status: 400 })
    }

    // Initialize Supabase admin client
    const adminClient = await createAdminClient()

    // Upload file to Supabase Storage
    const timestamp = Date.now()
    const sanitizedFileName = (originalFilename || file.name).replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    const filePath = `conductors/${conductorId}/${timestamp}_${sanitizedFileName}`

    console.log('[v0] Uploading to storage:', filePath)

    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError, data: uploadData } = await adminClient.storage
      .from('documents')
      .upload(filePath, fileBuffer, { 
        contentType: file.type,
        upsert: true 
      })

    if (uploadError) {
      console.error('[v0] Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Error uploading file to storage' }, { status: 500 })
    }

    console.log('[v0] File uploaded to storage successfully')

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from('documents')
      .getPublicUrl(filePath)

    const publicUrl = urlData?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${filePath}`
    console.log('[v0] Public URL generated:', publicUrl)

    // Get conductor's ejecutiva (through subcontratistas)
    const { data: conductor } = await adminClient
      .from('conductores')
      .select('rut_proveedor')
      .eq('id', conductorId)
      .single()

    let ejecutiva: string | null = null
    
    if (conductor?.rut_proveedor) {
      const { data: subcontratista } = await adminClient
        .from('subcontratistas')
        .select('ejecutiva')
        .eq('rut', conductor.rut_proveedor)
        .single()
      
      if (subcontratista?.ejecutiva) {
        ejecutiva = subcontratista.ejecutiva
        console.log('[v0] Found ejecutiva for conductor:', ejecutiva)
      }
    }

    // Insert into uploaded_documents table
    const docData: any = {
      conductor_id: conductorId,
      original_filename: originalFilename || file.name,
      file_url: publicUrl,
      storage_path: filePath,
      validation_status: 'pending',
      vision_status: 'pending'
    }
    
    // Add document_type_id if provided
    if (documentTypeId && documentTypeId !== 'unknown') {
      docData.document_type_id = documentTypeId
    }
    
    // Add ejecutiva if found
    if (ejecutiva) {
      docData.ejecutiva = ejecutiva
    }
    
    console.log('[v0] Inserting document to database:', docData)

    const { data: insertResult, error: saveError } = await adminClient
      .from('uploaded_documents')
      .insert([docData])
      .select()

    if (saveError) {
      console.error('[v0] Database insert error:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details
      })
      return NextResponse.json({ 
        error: 'Error saving document to database',
        details: saveError.message 
      }, { status: 500 })
    }
    
    const savedDoc = Array.isArray(insertResult) && insertResult.length > 0 ? insertResult[0] : null
    console.log('[v0] ✅ Document saved successfully:', { 
      id: savedDoc?.id,
      fileName: savedDoc?.original_filename,
      status: savedDoc?.validation_status
    })

    return NextResponse.json({
      success: true,
      message: 'Documento subido exitosamente',
      document: savedDoc
    })
  } catch (error) {
    console.error('[v0] Upload endpoint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
