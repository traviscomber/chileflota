import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeDocumentPeriod } from '@/lib/document-period'

export const maxDuration = 60

type DocumentVerification = {
  advanced: boolean
  confidence: number | null
  plate: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const { id } = params
    const formData = await request.formData()

    const file = formData.get('file') as File
    const documentTypeId = formData.get('documentTypeId') as string
    const subcontractorRut = formData.get('subcontractorRut') as string
    const periodMonth = formData.get('documentPeriodMonth') || formData.get('periodMonth')
    const periodYear = formData.get('documentPeriodYear') || formData.get('periodYear')
    const documentPeriod = normalizeDocumentPeriod(periodMonth as string | null, periodYear as string | null)

    if (!file || !documentTypeId || !subcontractorRut || !id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data: docType, error: docTypeError } = await supabase
      .from('subcontractor_document_types')
      .select('id, code, periodicidad')
      .eq('id', documentTypeId)
      .single()

    if (docTypeError || !docType) {
      return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })
    }

    // Every upload is an independent review submission.
    // Operational review state is driven by status (pending/approved/rejected),
    // not by version chains or is_current.
    const fileExtension = file.name.split('.').pop() || 'pdf'
    const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`
    const fileName = `${id}/${safeFileName}`

    try {
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some((bucket: any) => bucket.name === 'subcontractor-documents')
      if (!bucketExists) {
        await supabase.storage.createBucket('subcontractor-documents', {
          public: true,
          fileSizeLimit: 52428800,
        })
      }
    } catch (bucketError) {
      console.log('[documents] bucket check:', bucketError)
    }

    const buffer = await file.arrayBuffer()
    if (buffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'El archivo llegó vacío al servidor. Verifica que el archivo no esté corrupto.' },
        { status: 400 }
      )
    }

    const uint8Array = new Uint8Array(buffer)
    const { error: uploadError } = await supabase.storage
      .from('subcontractor-documents')
      .upload(fileName, uint8Array, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir el archivo: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('subcontractor-documents')
      .getPublicUrl(fileName)

    const now = new Date()
    const expiresAt = new Date(now)
    if (docType.periodicidad === 'Mensual') expiresAt.setMonth(expiresAt.getMonth() + 1)
    else if (docType.periodicidad === 'Trimestral') expiresAt.setMonth(expiresAt.getMonth() + 3)
    else if (docType.periodicidad === 'Anual') expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    const insertPayload = {
      subcontractor_id: id,
      subcontractor_rut: subcontractorRut,
      document_type_id: documentTypeId,
      file_url: publicUrl,
      file_name: file.name,
      status: 'pending',
      uploaded_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      ...(documentPeriod || {}),
    }

    const { data: newDocument, error: saveError } = await supabase
      .from('subcontractor_documents')
      .insert(insertPayload)
      .select()
      .single()

    if (saveError && documentPeriod && /document_period/i.test(saveError.message || '')) {
      return NextResponse.json(
        { error: 'La base de datos aun no tiene habilitado el periodo documental. Aplica la migracion 014 antes de subir documentos.' },
        { status: 503 }
      )
    }

    if (saveError) {
      console.error('[documents] save error', {
        subcontractorId: id,
        documentTypeId,
        error: saveError.message,
      })
      return NextResponse.json({ error: 'Error al guardar el documento' }, { status: 500 })
    }

    const { error: alertError } = await supabase
      .from('subcontractor_document_alerts')
      .insert({
        subcontractor_id: id,
        document_id: newDocument.id,
        alert_type: 'pending_review',
        message: `Nuevo documento ${docType.code} subido - Pendiente de revisión`,
      })

    if (alertError) console.warn('[documents] could not create alert:', alertError)

    return NextResponse.json({
      success: true,
      document: newDocument,
      supersededDocumentId: null,
      message: `Documento subido exitosamente. Se vencerá el ${expiresAt.toLocaleDateString('es-CL')}`,
    })
  } catch (error) {
    console.error('[documents] upload error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    const { data: documents, error: docsError } = await supabase
      .from('subcontractor_documents')
      .select(`
        id,
        subcontractor_id,
        subcontractor_rut,
        document_type_id,
        file_url,
        file_name,
        status,
        uploaded_at,
        expires_at,
        rejection_reason,
        created_at,
        updated_at,
        document_period_month,
        document_period_year,
        document_period_start,
        document_type:subcontractor_document_types(code, nombre, periodicidad)
      `)
      .eq('subcontractor_id', id)
      .order('uploaded_at', { ascending: false })

    if (docsError) {
      console.error('[documents] fetch error:', docsError)
      return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 })
    }

    const documentIds = (documents ?? []).map((document) => document.id)
    const verificationByDocumentId = new Map<string, DocumentVerification>()

    if (documentIds.length > 0) {
      const { data: verificationFacts, error: verificationError } = await supabase
        .from('vehicle_document_facts')
        .select('document_id, prt_matched, confidence, plate_normalized, updated_at')
        .in('document_id', documentIds)
        .eq('prt_matched', true)
        .order('updated_at', { ascending: false })

      if (verificationError) {
        console.error('[documents] verification facts error:', verificationError)
        return NextResponse.json({ error: 'Error al obtener validación avanzada' }, { status: 500 })
      }

      for (const fact of verificationFacts ?? []) {
        if (verificationByDocumentId.has(fact.document_id)) continue
        const confidence = Number(fact.confidence ?? 0)
        verificationByDocumentId.set(fact.document_id, {
          advanced: true,
          confidence: Number.isFinite(confidence) ? confidence : null,
          plate: fact.plate_normalized ?? null,
        })
      }
    }

    const documentsWithVerification = (documents ?? []).map((document) => ({
      ...document,
      verification: verificationByDocumentId.get(document.id) ?? null,
    }))

    const { data: documentTypes, error: typesError } = await supabase
      .from('subcontractor_document_types')
      .select('id, code, nombre, periodicidad, es_obligatorio')
      .eq('es_obligatorio', true)
      .order('nombre', { ascending: true })

    if (typesError) {
      return NextResponse.json({ error: 'Error al obtener tipos de documento' }, { status: 500 })
    }

    const summary = {
      totalDocumentsUploaded: documentsWithVerification.length,
      totalRequirements: documentTypes?.length || 0,
      approvedDocuments: documentsWithVerification.filter((document) => document.status === 'approved').length,
      pendingDocuments: documentsWithVerification.filter((document) => document.status === 'pending').length,
      expiredDocuments: documentsWithVerification.filter((document) => document.status === 'expired').length,
      rejectedDocuments: documentsWithVerification.filter((document) => document.status === 'rejected').length,
      advancedValidatedDocuments: documentsWithVerification.filter((document) => document.verification?.advanced === true).length,
    }

    return NextResponse.json({
      success: true,
      subcontractorId: id,
      documents: documentsWithVerification,
      requirements: documentTypes || [],
      summary,
    })
  } catch (error) {
    console.error('[documents] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
