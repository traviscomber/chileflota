import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { triggerSubcontractorDocumentUploadedAlert } from '@/lib/operations/alert-triggers'
import { normalizeDocumentPeriod } from '@/lib/document-period'
import {
  authorizeInternalDocumentRequest,
  createDocumentInternalAuthHeaders,
  DOCUMENT_WRITE_ROLES,
} from '@/lib/document-route-auth'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const F30_CODES = new Set(['F30', 'F30-1_DOÑA_ISIDORA', 'F30-1_CLIENTE'])

type F30AnalysisResult = {
  success: boolean
  analysis?: unknown
  error?: string
}

type RequestContextValue = {
  waitUntil?: (promise: Promise<unknown>) => void
}

type RequestContext = {
  get?: () => RequestContextValue | undefined
}

async function analyzeF30Document(origin: string, documentId: string): Promise<F30AnalysisResult> {
  try {
    const response = await fetch(`${origin}/api/company/documents/${documentId}/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createDocumentInternalAuthHeaders(documentId),
      },
      body: JSON.stringify({ documentId }),
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        success: false,
        error: typeof payload?.error === 'string' ? payload.error : `F30 analysis returned HTTP ${response.status}`,
      }
    }

    return { success: true, analysis: payload?.analysis ?? payload }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown F30 analysis error',
    }
  }
}

function registerBackgroundTask(task: Promise<unknown>): void {
  const requestContext = (globalThis as typeof globalThis & Record<symbol, RequestContext | undefined>)[
    Symbol.for('@next/request-context')
  ]
  const waitUntil = requestContext?.get?.()?.waitUntil

  if (waitUntil) {
    waitUntil(task)
    return
  }

  void task.catch((error) => {
    console.error('[documents/upload] Background task failed without waitUntil:', error)
  })
}

function queueF30Analysis(origin: string, documentId: string): void {
  registerBackgroundTask((async () => {
    const result = await analyzeF30Document(origin, documentId)
    if (result.success) return

    const adminClient = createAdminClient()
    await adminClient
      .from('subcontractor_documents')
      .update({
        ai_warnings: [`F30_AUTO_ANALYSIS_FAILED: ${result.error ?? 'unknown error'}`],
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', documentId)
  })())
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const subcontractorId = formData.get('subcontractorId') as string
    const category = formData.get('category') as string
    const periodMonth = formData.get('documentPeriodMonth') || formData.get('periodMonth')
    const periodYear = formData.get('documentPeriodYear') || formData.get('periodYear')
    const documentPeriod = normalizeDocumentPeriod(periodMonth as string | null, periodYear as string | null)

    if (!subcontractorId || !files.length || !category) {
      return NextResponse.json(
        { error: 'Subcontractor ID, document category and files are required' },
        { status: 400 },
      )
    }

    const adminClient = createAdminClient()
    const bucketName = 'subcontractor-documents'

    try {
      const { data: buckets } = await adminClient.storage.listBuckets()
      if (!buckets?.some((bucket) => bucket.name === bucketName)) {
        await adminClient.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 52_428_800,
        })
      }
    } catch (bucketError) {
      console.warn('[documents/upload] Bucket check failed:', bucketError)
    }

    const [{ data: subcontractor, error: subcontractorError }, { data: documentType, error: typeError }] = await Promise.all([
      adminClient
        .from('transportistas')
        .select('id, rut, razon_social')
        .eq('id', subcontractorId)
        .single(),
      adminClient
        .from('subcontractor_document_types')
        .select('id, code, nombre')
        .eq('id', category)
        .single(),
    ])

    if (subcontractorError || !subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }
    if (typeError || !documentType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 400 })
    }

    const shouldAnalyzeF30 = F30_CODES.has(documentType.code)
    const uploadedDocs: Array<Record<string, unknown>> = []

    for (const file of files) {
      const storageName = `${Date.now()}_${crypto.randomUUID()}_${file.name}`
      const filePath = `subcontractors/${subcontractorId}/${storageName}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await adminClient.storage
        .from(bucketName)
        .upload(filePath, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        })

      if (uploadError) {
        console.error('[documents/upload] Storage upload failed:', uploadError.message)
        continue
      }

      const { data: { publicUrl } } = adminClient.storage.from(bucketName).getPublicUrl(filePath)
      const insertPayload = {
        subcontractor_id: subcontractorId,
        subcontractor_rut: subcontractor.rut || '',
        document_type_id: category,
        file_url: publicUrl,
        file_name: file.name,
        status: 'pending',
        uploaded_at: new Date().toISOString(),
        ...(documentPeriod || {}),
      }

      const { data: document, error: documentError } = await adminClient
        .from('subcontractor_documents')
        .insert(insertPayload)
        .select()
        .single()

      if (documentError && documentPeriod && /document_period/i.test(documentError.message || '')) {
        return NextResponse.json(
          { error: 'La base de datos aun no tiene habilitado el periodo documental. Aplica la migracion 014 antes de subir documentos.' },
          { status: 503 },
        )
      }

      if (documentError || !document) {
        console.error('[documents/upload] Database insert failed:', documentError?.message)
        continue
      }

      if (shouldAnalyzeF30) {
        queueF30Analysis(request.nextUrl.origin, document.id)
      }

      try {
        await triggerSubcontractorDocumentUploadedAlert(
          subcontractorId,
          file.name,
          subcontractor.razon_social,
          category,
          document.id,
        )
      } catch (alertError) {
        console.error('[documents/upload] Alert trigger failed:', alertError)
      }

      uploadedDocs.push({
        ...document,
        document_type_code: documentType.code,
        auto_analysis: shouldAnalyzeF30 ? { status: 'queued' } : null,
      })
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedDocs.length} document(s) uploaded successfully`,
      f30AutoAnalysisEnabled: shouldAnalyzeF30,
      documents: uploadedDocs,
    })
  } catch (error) {
    console.error('[documents/upload] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error uploading documents' },
      { status: 500 },
    )
  }
}
