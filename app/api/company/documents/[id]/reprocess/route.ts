import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  extractDocumentMetadata,
  extractDocumentFromPdfBuffer,
  extractDocumentFromText,
} from '@/lib/ai-document-processor'
import { extractText } from 'unpdf'
import { generateAIAnalysisAlerts } from '@/lib/document-alerts-generator'
import { parseF30Document } from '@/lib/f30-parser'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function classifyAnalysisAvailabilityError(error: unknown): {
  unavailable: boolean
  reason?: string
  retryable?: boolean
} {
  const candidate = error as any
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = String(candidate?.code ?? candidate?.error?.code ?? '')
  const status = Number(candidate?.status ?? candidate?.statusCode ?? 0)

  if (
    status === 429 ||
    code === 'credit_balance_exhausted' ||
    code === 'insufficient_quota' ||
    /no credits remaining|insufficient quota|credit balance exhausted/i.test(message)
  ) {
    return { unavailable: true, reason: 'ai_quota_unavailable', retryable: false }
  }

  if (
    status === 429 ||
    code === 'rate_limit_exceeded' ||
    /rate limit|too many requests/i.test(message)
  ) {
    return { unavailable: true, reason: 'ai_rate_limited', retryable: true }
  }

  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    /service unavailable|temporarily unavailable|gateway timeout/i.test(message)
  ) {
    return { unavailable: true, reason: 'ai_service_unavailable', retryable: true }
  }

  return { unavailable: false }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const documentId = params.id
    const requestBody = await request.json().catch(() => ({}))
    const source = typeof requestBody?.source === 'string' ? requestBody.source : null
    const isF30Backfill = source === 'f30_backfill'
    const adminClient = createAdminClient()

    let doc: any = null
    let docTable = ''

    const { data: subDoc } = await adminClient
      .from('subcontractor_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (subDoc) {
      doc = subDoc
      docTable = 'subcontractor_documents'
    } else {
      const { data: uploadedDoc } = await adminClient
        .from('uploaded_documents')
        .select('*')
        .eq('id', documentId)
        .single()
      if (uploadedDoc) {
        doc = uploadedDoc
        docTable = 'uploaded_documents'
      }
    }

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (!doc.file_url) return NextResponse.json({ error: 'Document has no file URL' }, { status: 400 })

    const fileResponse = await fetch(doc.file_url)
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch document from storage' }, { status: 500 })
    }

    const buffer = await fileResponse.arrayBuffer()
    const analyzedAt = new Date().toISOString()

    if (buffer.byteLength === 0) {
      if (docTable === 'subcontractor_documents') {
        await adminClient
          .from('subcontractor_documents')
          .update({
            f30_status: 'empty_file',
            f30_details: {
              detected: false,
              warnings: ['empty_file', 'reload_required'],
              error: 'Archivo vacío o corrupto. Debe volver a cargarse.',
              fileSizeBytes: 0,
            },
            f30_validated_at: analyzedAt,
            ai_warnings: ['empty_file', 'reload_required'],
            ai_analyzed_at: analyzedAt,
          })
          .eq('id', documentId)
      }

      return NextResponse.json({
        success: true,
        saved: true,
        documentId,
        documentTable: docTable,
        f30: { status: 'empty_file' },
        analysis: null,
        usedOcrFallback: false,
        message: 'Archivo vacío o corrupto; se requiere recarga',
      })
    }

    const fileUrl = doc.file_url.toLowerCase()
    const isPdf = fileUrl.endsWith('.pdf') || fileUrl.includes('.pdf?')

    let aiExtraction: any
    let rawDocumentText = ''
    let usedOcrFallback = false

    if (isPdf) {
      const pdfBytes = Buffer.from(buffer)
      if (pdfBytes.byteLength === 0) {
        throw new Error('Document PDF is empty')
      }

      try {
        const nativePdfBytes = Uint8Array.from(pdfBytes)
        const { text: textArray } = await extractText(nativePdfBytes)
        rawDocumentText = Array.isArray(textArray) ? textArray.join('\n') : String(textArray)
      } catch (error) {
        console.warn('[v0] Native PDF text extraction failed, using OCR fallback', error)
      }

      if (rawDocumentText.trim().length >= 10) {
        aiExtraction = await extractDocumentFromText(rawDocumentText, doc.document_type || 'documento')
      } else {
        usedOcrFallback = true
        const ocrPdfBytes = Uint8Array.from(pdfBytes)
        aiExtraction = await extractDocumentFromPdfBuffer(ocrPdfBytes, doc.document_type || 'documento')
        rawDocumentText = aiExtraction.extractedText || ''
      }
    } else {
      const base64 = Buffer.from(buffer).toString('base64')
      let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
      if (fileUrl.includes('.png')) mimeType = 'image/png'
      else if (fileUrl.includes('.gif')) mimeType = 'image/gif'
      else if (fileUrl.includes('.webp')) mimeType = 'image/webp'
      aiExtraction = await extractDocumentMetadata(base64, mimeType)
    }

    const f30Result = docTable === 'subcontractor_documents' && rawDocumentText
      ? parseF30Document({
          rawText: rawDocumentText,
          summaryText: aiExtraction.extractedText,
          expectedRut: doc.subcontractor_rut,
          documentNumber: aiExtraction.documentNumber,
          issuanceDate: aiExtraction.issuanceDate,
          confidence: aiExtraction.confidence,
          warnings: aiExtraction.warnings,
        })
      : null

    const updateData: Record<string, unknown> = {
      ai_document_type: aiExtraction.documentType,
      ai_expiration_date: aiExtraction.expirationDate || null,
      ai_issuance_date: aiExtraction.issuanceDate || null,
      ai_document_number: aiExtraction.documentNumber || null,
      ai_extracted_text: aiExtraction.extractedText || null,
      ai_confidence: aiExtraction.confidence || null,
      ai_warnings: aiExtraction.warnings || [],
      ai_analyzed_at: analyzedAt,
    }

    if (f30Result) {
      updateData.f30_status = f30Result.status
      updateData.f30_details = { ...f30Result.details, usedOcrFallback }
      updateData.f30_validated_at = analyzedAt

      if (f30Result.details.periodMonth && f30Result.details.periodYear) {
        updateData.document_period_month = f30Result.details.periodMonth
        updateData.document_period_year = f30Result.details.periodYear
        updateData.document_period_start = `${f30Result.details.periodYear}-${String(f30Result.details.periodMonth).padStart(2, '0')}-01`
        updateData.document_period_source = 'metadata'
      }
    } else if (isF30Backfill && docTable === 'subcontractor_documents') {
      updateData.f30_status = 'analysis_failed'
      updateData.f30_details = {
        detected: false,
        warnings: ['f30_not_detected'],
        error: 'F30 candidate was analyzed but the document content was not confirmed as F30',
        usedOcrFallback,
      }
      updateData.f30_validated_at = analyzedAt
    }

    let { error: updateError } = await adminClient
      .from(docTable)
      .update(updateData)
      .eq('id', documentId)

    let periodConflict = false
    if (updateError?.code === '23505' && f30Result && docTable === 'subcontractor_documents') {
      periodConflict = true
      const fallbackData = { ...updateData }
      delete fallbackData.document_period_month
      delete fallbackData.document_period_year
      delete fallbackData.document_period_start
      delete fallbackData.document_period_source
      fallbackData.f30_status = 'warning'
      fallbackData.f30_details = {
        ...f30Result.details,
        usedOcrFallback,
        warnings: [...f30Result.details.warnings, 'period_already_registered'],
        periodConflict: true,
      }
      const retry = await adminClient.from(docTable).update(fallbackData).eq('id', documentId)
      updateError = retry.error
    }

    const transportistaId = doc.transportista_id || doc.subcontractor_id || null
    const conductorId = doc.conductor_id || doc.driver_id || null
    const fileName = doc.file_name || doc.filename || 'documento'

    await generateAIAnalysisAlerts({
      documentId,
      documentTable: docTable as 'subcontractor_documents' | 'uploaded_documents',
      transportistaId,
      conductorId,
      documentType: aiExtraction.documentType || doc.document_type || 'Documento',
      aiExpirationDate: aiExtraction.expirationDate,
      aiConfidence: aiExtraction.confidence || 0.5,
      fileName,
    })

    return NextResponse.json({
      success: true,
      saved: !updateError,
      periodConflict,
      usedOcrFallback,
      documentId,
      documentTable: docTable,
      analysis: aiExtraction,
      f30: f30Result,
      f30Terminalized: Boolean(isF30Backfill && docTable === 'subcontractor_documents' && !f30Result),
      alertsGenerated: !!aiExtraction.expirationDate,
      message: updateError
        ? 'Analisis completado (no guardado)'
        : periodConflict
          ? 'Analisis guardado con conflicto de periodo'
          : 'Analisis completado y guardado',
    })
  } catch (error) {
    const availability = classifyAnalysisAvailabilityError(error)
    if (availability.unavailable) {
      console.warn('[v0] Reprocess degraded: analysis unavailable', {
        documentId: params.id,
        reason: availability.reason,
      })
      return NextResponse.json(
        {
          success: false,
          analysisUnavailable: true,
          reason: availability.reason,
          retryable: availability.retryable,
          documentId: params.id,
          documentStatusChanged: false,
          error: 'El análisis automático no está disponible temporalmente. El estado documental no fue modificado.',
        },
        { status: 503 },
      )
    }

    console.error('[v0] Reprocess error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 },
    )
  }
}
