import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDocumentUploadAlerts } from '@/lib/document-alerts-generator'
import { extractDocumentMetadata } from '@/lib/ai-document-processor'
import { normalizeDocumentType, determineValidationStatus } from '@/lib/document-classification'
import { notifyExecutivas } from '@/lib/notifications-helper'
import { generateConductorFilePath } from '@/lib/utils/file-naming'
import { cookies } from 'next/headers'

// Set max duration for the route (30 seconds - Vercel free plan limit)
export const maxDuration = 30

// Map conductor document type codes to database UUIDs
const DOCUMENT_TYPE_MAPPING: Record<string, string> = {
  'CEDULA_IDENTIDAD': '3803861c-5ff3-40ba-a6d7-de8245bc3cd2',
  'LIC_CONDUCIR': '48e5d7a6-2c92-4616-8eed-e56a956e2c6a',
  'HOJA_VIDA': 'a53defca-5f31-4ef9-893e-e63ce07929f6',
  'CERT_ANTECEDENTES': '5370a5e6-9d20-4ee3-b19a-e54fdef1c952',
  'INHABILIDADES_MENORES': 'e17d797e-e9c3-4642-8f36-862a46b371dc',
  'CONTRATO_TRABAJO': '3b53c0a2-8607-4c2b-85cf-96a281797c6a',
  'CERT_AFP': 'c6b67a33-a1d8-4e62-bbe8-01c22e9ff8c0',
  'REVISION_TECNICA': '4c3d940c-93ae-4fc7-ab57-8a21b89746a6',
  'SOAP': '88386b93-cdb1-427a-bad0-fde2b6e720c8',
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { message: 'Server configuration missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Get conductor_id from cookies (set by login)
    const cookieStore = await cookies()
    const conductorId = cookieStore.get('conductor_id')?.value
    
    if (!conductorId) {
      return NextResponse.json(
        { message: 'No authorization - conductor not authenticated' },
        { status: 401 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string
    const rawDocumentDate = String(formData.get('documentDate') || '').trim()
    const rawDocumentPeriodMonth = String(formData.get('documentPeriodMonth') || '').trim()
    const rawDocumentPeriodYear = String(formData.get('documentPeriodYear') || '').trim()

    const fallbackDate = new Date()
    const documentDate = rawDocumentDate || fallbackDate.toISOString().slice(0, 10)
    const documentPeriodMonth = rawDocumentPeriodMonth
      ? Number(rawDocumentPeriodMonth)
      : Number(documentDate.slice(5, 7))
    const documentPeriodYear = rawDocumentPeriodYear
      ? Number(rawDocumentPeriodYear)
      : Number(documentDate.slice(0, 4))

    if (!file || !documentType) {
      return NextResponse.json(
        { message: 'Missing file or documentType' },
        { status: 400 }
      )
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(documentDate) ||
      !Number.isInteger(documentPeriodMonth) ||
      documentPeriodMonth < 1 ||
      documentPeriodMonth > 12 ||
      !Number.isInteger(documentPeriodYear) ||
      documentPeriodYear < 2020 ||
      documentPeriodYear > 2100
    ) {
      return NextResponse.json(
        { message: 'Invalid document period' },
        { status: 400 }
      )
    }

    const selectedDate = new Date(`${documentDate}T12:00:00Z`)
    if (Number.isNaN(selectedDate.getTime()) || selectedDate.getTime() > Date.now()) {
      return NextResponse.json(
        { message: 'Document date cannot be in the future' },
        { status: 400 }
      )
    }

    const derivedMonth = selectedDate.getUTCMonth() + 1
    const derivedYear = selectedDate.getUTCFullYear()
    if (derivedMonth !== documentPeriodMonth || derivedYear !== documentPeriodYear) {
      return NextResponse.json(
        { message: 'Document period does not match document date' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { message: 'File too large' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Get conductor info from conductores table using conductorId
    console.log('[v0] Step 1b: Looking up conductor with ID from cookie:', conductorId)
    const { data: conductor, error: conductorError } = await supabase
      .from('conductores')
      .select('*')
      .eq('id', conductorId)
      .single()

    if (conductorError || !conductor) {
      console.error('[v0] Conductor lookup failed for ID:', conductorId, 'error:', conductorError?.message)
      return NextResponse.json(
        { message: 'Conductor profile not found' },
        { status: 404 }
      )
    }

    console.log('[v0] Found conductor:', { id: conductor.id, rut: conductor.rut, nombre_completo: conductor.nombre_completo })

    // Get document type info - look up by ID
    const docTypeId = DOCUMENT_TYPE_MAPPING[documentType as keyof typeof DOCUMENT_TYPE_MAPPING]
    
    if (!docTypeId) {
      return NextResponse.json(
        { message: `Invalid document type: ${documentType}` },
        { status: 400 }
      )
    }

    const { data: docType, error: docTypeError } = await supabase
      .from('document_types')
      .select('*')
      .eq('id', docTypeId)
      .single()

    if (docTypeError || !docType) {
      return NextResponse.json(
        { message: 'Invalid document type' },
        { status: 400 }
      )
    }

    // Generate normalized file path using standardized naming convention
    // Format: conductor-documents/{conductorId}/{DOCTYPE}_{RUT}_{YYYYMMDD}_{HASH}.{ext}
    const documentTypeCode = Object.keys(DOCUMENT_TYPE_MAPPING).find(
      key => DOCUMENT_TYPE_MAPPING[key as keyof typeof DOCUMENT_TYPE_MAPPING] === docTypeId
    ) || 'UNKNOWN'
    
    const filePath = generateConductorFilePath(
      conductor.id,
      documentTypeCode,
      conductor.rut,
      file.name
    )

    console.log('[v0] Generated normalized file path:', filePath)

    // Upload file to storage
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { message: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // STEP 1: Process document with AI (async, 5-10 seconds)
    console.log('[v0] Starting AI document processing for conductor upload...')
    let aiExtraction = null
    let extractionError = null
    let validationStatus = 'pending'

    try {
      // Convert file to base64 for AI processing
      const buffer = Buffer.from(fileBuffer)
      const base64 = buffer.toString('base64')
      
      // Call AI document processor with error handling
      try {
        aiExtraction = await extractDocumentMetadata(base64, file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
        console.log('[v0] AI extraction successful:', { confidence: aiExtraction.confidence })
        
        // Determine validation status based on AI extraction
        if (aiExtraction.confidence >= 0.7) {
          const daysUntilExp = aiExtraction.expirationDate 
            ? Math.floor((new Date(aiExtraction.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null
          
          validationStatus = determineValidationStatus(
            aiExtraction.confidence,
            daysUntilExp,
            !!aiExtraction.documentNumber
          ) as string
        }
      } catch (aiError) {
        extractionError = aiError instanceof Error ? aiError.message : 'AI extraction failed'
        console.warn('[v0] AI extraction failed (non-blocking):', extractionError, aiError)
        // Continue with document upload — AI failure doesn't block the flow
        validationStatus = 'pending'
      }
    } catch (error) {
      console.error('[v0] Unexpected error in AI processing:', error)
      // Continue regardless
      validationStatus = 'pending'
    }

    // STEP 2: Test database connection and schema
    console.log('[v0] Step 2: Testing database connection and table schema')
    
    // First, just try a simple SELECT to verify table exists and we can read it
    const { data: testQuery, error: testError } = await supabase
      .from('uploaded_documents')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('[v0] Failed to query uploaded_documents table:', testError)
      return NextResponse.json(
        { 
          message: 'Cannot access uploaded_documents table',
          error: testError.message,
          details: testError.details,
        },
        { status: 500 }
      )
    }
    
    console.log('[v0] Table query successful, sample record:', testQuery?.[0])
    
    // STEP 3: Ensure validation_status is always in English (required by database schema)
    // This prevents validation errors from mismatched status values
    const validStatusValues = ['pending', 'approved', 'rejected']
    if (!validStatusValues.includes(validationStatus)) {
      console.warn('[v0] Invalid validation_status value detected, resetting to pending:', validationStatus)
      validationStatus = 'pending'
    }
    
    console.log('[v0] Final validation_status before insert:', validationStatus)

    // Build complete insert payload with all required fields
    const insertPayload: any = {
      conductor_id: conductor.id,
      document_type_id: docType.id,
      original_filename: file.name,
      file_url: publicUrl,
      validation_status: validationStatus,
      document_period_month: documentPeriodMonth,
      document_period_year: documentPeriodYear,
      document_period_start: `${documentPeriodYear}-${String(documentPeriodMonth).padStart(2, '0')}-01`,
      document_period_source: 'manual_document_date',
    }

    console.log('[v0] Insert payload - conductor.id:', conductor.id, 'conductor.rut:', conductor.rut, 'conductor.nombre_completo:', conductor.nombre_completo)
    console.log('[v0] Full insert payload:', insertPayload)

    const { data: uploadedDoc, error: dbError } = await supabase
      .from('uploaded_documents')
      .insert(insertPayload)
      .select()
      .single()

    console.log('[v0] Insert payload:', JSON.stringify(insertPayload, null, 2))
    console.log('[v0] Database insert response - Data:', uploadedDoc)
    console.log('[v0] Database insert response - Error:', dbError)

    if (dbError) {
      console.error('[v0] Database error inserting uploaded_documents:', {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: (dbError as any).hint,
        payload: insertPayload,
        validation_status_value: validationStatus,
        validation_status_type: typeof validationStatus,
      })
      // Try to clean up storage
      await supabase.storage.from('documents').remove([filePath])
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to save document record',
          error: dbError?.message || 'Unknown database error',
          details: dbError?.details,
          code: dbError?.code,
        },
        { status: 500 }
      )
    }

    // Create notification for conductor
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: conductor.id,
          title: 'Documento Subido',
          message: `Tu ${docType.name} ha sido procesado${validationStatus === 'approved' ? ' y aprobado.' : validationStatus === 'rejected' ? ' pero fue rechazado.' : ' y está en revisión.'}`,
          type: validationStatus === 'rejected' ? 'warning' : 'info',
          metadata: {
            document_id: uploadedDoc.id,
            document_type: documentType,
            validation_status: validationStatus,
            ai_confidence: aiExtraction?.confidence || 0,
          },
        })
    } catch (notifError) {
      console.warn('[v0] Failed to create notification (non-blocking):', notifError)
      // Continue regardless of notification failure
    }

    // STEP 3: Notify ejecutivas if document was auto-rejected by AI
    if (validationStatus === 'rejected' && aiExtraction) {
      console.log('[v0] Document auto-rejected by AI, notifying ejecutivas...')
      // Build full conductor name from parts
      const fullConductorName = [
        conductor.nombres,
        conductor.apellido_paterno,
        conductor.apellido_materno
      ].filter(Boolean).join(' ') || 'Conductor'
      
      await notifyExecutivas({
        type: 'status_change' as const,
        conductorName: fullConductorName,
        documentType: docType.name,
        oldStatus: 'pending',
        newStatus: 'rejected',
        documentId: uploadedDoc.id,
      }).catch(err => {
        console.error('[v0] Failed to notify ejecutivas:', err)
      })
    }

    // STEP 4: Initialize compliance tracking for conductor (first time)
    try {
      console.log('[v0] Initializing compliance tracking for conductor:', conductorId)
      const { data: existingCompliance } = await supabase
        .from('conductor_document_compliance')
        .select('id')
        .eq('conductor_id', conductorId)
        .limit(1)

      if (!existingCompliance || existingCompliance.length === 0) {
        // First document upload - initialize compliance records
        const { data: allRequirements } = await supabase
          .from('document_requirements')
          .select('id')
          .eq('applicable_to_conductor', true)
          .eq('is_active', true)

        if (allRequirements && allRequirements.length > 0) {
          const complianceRecords = allRequirements.map(req => ({
            conductor_id: conductorId,
            document_requirement_id: req.id,
            status: 'pending',
          }))

          await supabase
            .from('conductor_document_compliance')
            .insert(complianceRecords)
          
          console.log('[v0] Initialized compliance tracking for', allRequirements.length, 'document requirements')
        }
      }
    } catch (complianceError) {
      console.warn('[v0] Failed to initialize compliance (non-blocking):', complianceError)
    }

    // STEP 5: Try to find matching document requirement
    // Map old document codes to new requirement codes
    const docTypeCodeMapping: { [key: string]: string } = {
      'LICENCIA-CONDUCIR': 'CONDUCTOR_LICENSE',
      'LIC_CONDUCIR': 'CONDUCTOR_LICENSE',
      'CERTIFICADO-ANTECEDENTES': 'CONDUCTOR_BACKGROUND_CERTIFICATE',
      'CONTRATO_TRABAJO': 'CONDUCTOR_WORK_CONTRACT',
      'CEDULA-IDENTIDAD': 'CONDUCTOR_ID',
      'HOJA_VIDA': 'CONDUCTOR_RESUME',
      'HOJA-VIDA-CONDUCTOR': 'CONDUCTOR_RESUME',
      'REVISION-TECNICA': 'VEHICLE_INSPECTION',
      'DOCUMENTOS-CARGA': 'CONDUCTOR_WORK_CONTRACT', // fallback
      'CERTIFICADO-SALUD': 'CONDUCTOR_HEALTH_MONTHLY',
    }

    const matchingRequirementCode = docTypeCodeMapping[documentType] || null
    console.log('[v0] Document type mapping:', { oldCode: documentType, newCode: matchingRequirementCode })

    let matchingRequirement = null
    if (matchingRequirementCode) {
      const { data: req } = await supabase
        .from('document_requirements')
        .select('id')
        .eq('code', matchingRequirementCode)
        .single()
      
      matchingRequirement = req
    }

    // STEP 6: Update compliance status for this document
    try {
      console.log('[v0] Updating compliance status for matched requirement:', matchingRequirement?.id)
      
      if (matchingRequirement) {
        // Update or create compliance record
        const { error: updateError } = await supabase
          .from('conductor_document_compliance')
          .upsert({
            conductor_id: conductorId,
            document_requirement_id: matchingRequirement.id,
            status: validationStatus || 'pending',
            latest_document_id: uploadedDoc.id,
            submission_date: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
          }, {
            onConflict: 'conductor_id,document_requirement_id',
          })

        if (updateError) {
          console.error('[v0] Failed to update compliance status:', updateError)
        } else {
          console.log('[v0] Updated compliance status for requirement')
        }
      } else {
        console.warn('[v0] No matching document requirement found for document type:', documentType)
      }
    } catch (complianceError) {
      console.warn('[v0] Failed to update compliance status (non-blocking):', complianceError)
    }

    // STEP 7: Generate compliance alerts
    try {
      console.log('[v0] Creating compliance alert for document upload')
      
      if (matchingRequirement) {
        // Create alert in compliance_alerts table
        const alertMessage = validationStatus === 'approved' 
          ? `Documento aprobado automáticamente`
          : validationStatus === 'rejected'
          ? `Documento rechazado por validación automática`
          : `Documento enviado para revisión`

        await supabase
          .from('compliance_alerts')
          .insert({
            entity_type: 'conductor',
            entity_id: conductorId,
            alert_type: 'document_submitted',
            severity: validationStatus === 'rejected' ? 'high' : validationStatus === 'approved' ? 'low' : 'medium',
            title: `Documento Subido: ${docType.name}`,
            message: alertMessage,
            document_requirement_id: matchingRequirement.id,
            status: 'active',
          })

        console.log('[v0] Created compliance alert')
      } else {
        console.warn('[v0] Could not create compliance alert - no matching requirement')
      }
    } catch (alertError) {
      console.error('[v0] Failed to create compliance alert (non-blocking):', alertError)
    }

    // Also generate alerts for admins about the new document (legacy system)
    const conductorName = [
      conductor.nombres,
      conductor.apellido_paterno,
      conductor.apellido_materno
    ].filter(Boolean).join(' ') || 'Conductor'
    
    try {
      console.log('[v0] About to create alert with conductor name:', { 
        nombres: conductor.nombres,
        apellido_paterno: conductor.apellido_paterno,
        apellido_materno: conductor.apellido_materno,
        final: conductorName 
      })
      await generateDocumentUploadAlerts(
        uploadedDoc.id,
        docType.name,
        conductorName,
        'conductor',
        conductorId
      )
    } catch (alertError) {
      console.error('[v0] Failed to generate alerts (non-blocking):', alertError)
      // Continue regardless of alert generation failure
    }

    return NextResponse.json(
      {
        success: true,
        documentId: uploadedDoc.id,
        validationStatus,
        aiExtraction: aiExtraction ? {
          confidence: aiExtraction.confidence,
          documentType: aiExtraction.documentType,
          expirationDate: aiExtraction.expirationDate,
        } : null,
        message: `Documento subido ${validationStatus === 'approved' ? 'y aprobado automáticamente' : validationStatus === 'rejected' ? 'pero fue rechazado por IA' : 'y está en revisión'}`,
        // Sync event information for real-time UI updates
        syncEvent: {
          type: 'document_uploaded',
          conductorId: conductorId,
          documentId: uploadedDoc.id,
          timestamp: Date.now(),
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
