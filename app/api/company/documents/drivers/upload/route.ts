import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allDriversData } from '@/lib/data/all-drivers'
import { triggerDocumentUploadedAlert } from '@/lib/operations/alert-triggers'
import {
  authorizeInternalDocumentRequest,
  createDocumentInternalAuthHeaders,
  DOCUMENT_WRITE_ROLES,
} from '@/lib/document-route-auth'

// Helper to trigger automatic AI analysis after upload
async function triggerAutoAnalysis(documentId: string) {
  try {
    console.log('[v0] Triggering automatic AI analysis for document:', documentId)
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/company/documents/${documentId}/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createDocumentInternalAuthHeaders(documentId),
      },
      body: JSON.stringify({ documentId }),
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('[v0] Auto-analysis completed:', result)
      return result
    } else {
      console.error('[v0] Auto-analysis failed with status:', response.status)
    }
  } catch (error) {
    console.error('[v0] Error triggering auto-analysis:', error)
  }
}

export const dynamic = 'force-dynamic'

const normalizeRUT = (rut: string | undefined) => {
  if (!rut) return ''
  return rut.trim().replace(/[.-]/g, '').toUpperCase()
}

export async function POST(request: NextRequest) {
  console.log('[v0] ==================== UPLOAD POST CALLED AT:', new Date().toISOString(), '====================')
  console.log('[v0] Upload endpoint called')
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    console.log('[v0] FormData entries:', Array.from(formData.entries()).map(([k, v]) => [k, v instanceof File ? `File(${v.name})` : v]))
    
    const file = formData.get('files') as File  // Hook sends 'files'
    const driverRut = formData.get('driverRut') as string
    const documentType = formData.get('category') as string  // Hook sends 'category'

    console.log('[v0] Upload request:', { driverRut, documentType, fileName: file?.name, fileSize: file?.size })

    // Validate inputs
    if (!file) {
      console.error('[v0] No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!driverRut) {
      console.error('[v0] No driver RUT provided')
      return NextResponse.json({ error: 'Driver RUT required' }, { status: 400 })
    }

    // Find driver
    const normalizedInputRut = normalizeRUT(driverRut)
    let drivers = null
    for (const localDriver of allDriversData) {
      if (normalizeRUT(localDriver.rut) === normalizedInputRut) {
        drivers = localDriver
        break
      }
    }

    if (!drivers?.id) {
      console.error('[v0] Driver not found:', driverRut)
      return NextResponse.json(
        { error: `Conductor con RUT ${driverRut} no encontrado en el sistema.` },
        { status: 404 }
      )
    }

    const driverId = drivers.id
    console.log('[v0] Found driver:', { driverId, rut: drivers.rut, name: `${drivers.nombres} ${drivers.apellido_paterno} ${drivers.apellido_materno}`.trim() })

    // Initialize Supabase
    const adminClient = await createAdminClient()

    // Upload to storage
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    const filePath = `drivers/${driverRut}/${timestamp}_${sanitizedFileName}`

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
      return NextResponse.json({ error: 'Error uploading to storage' }, { status: 500 })
    }

    console.log('[v0] File uploaded to storage successfully')

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from('documents')
      .getPublicUrl(filePath)

    const publicUrl = urlData?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${filePath}`
    console.log('[v0] Public URL:', publicUrl)

    // Insert to database
    const docData = {
      driver_id: String(driverId),
      file_name: file.name,
      document_type: documentType,
      file_url: publicUrl,
      status: 'pendiente'
    }
    
    console.log('[v0] Inserting document to database:', docData)

    const { data: insertResult, error: saveError } = await adminClient
      .from('driver_documents')
      .insert([docData])
      .select()

    if (saveError) {
      console.error('[v0] Database insert error:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details
      })
      // Don't return error - file is already in storage
    }
    
    const savedDoc = Array.isArray(insertResult) && insertResult.length > 0 ? insertResult[0] : null
    console.log('[v0] ✅ Document insert result:', { 
      success: !saveError, 
      id: savedDoc?.id,
      fileName: savedDoc?.file_name 
    })

    // Trigger automatic AI analysis (run in background, don't wait)
    if (savedDoc?.id) {
      triggerAutoAnalysis(savedDoc.id).catch(err => console.error('[v0] Background auto-analysis error:', err))
    }

    // Trigger alert
    try {
      await triggerDocumentUploadedAlert(
        driverId,
        file.name,
        `${drivers.nombres} ${drivers.apellido_paterno} ${drivers.apellido_materno}`.trim()
      )
    } catch (alertError) {
      console.error('[v0] Alert trigger error:', alertError)
    }

    return NextResponse.json({
      success: true,
      message: 'Documento subido exitosamente',
      documents: savedDoc ? [savedDoc] : []
    })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
