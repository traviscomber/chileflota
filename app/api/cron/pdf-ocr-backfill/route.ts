import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { shouldRunBackgroundWork } from '@/lib/runtime-circuit-breaker'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300
export const runtime = 'nodejs'

const DOCUMENTS_PER_RUN = 3
const PDF_OCR_TIMEOUT_MS = 90_000
const DEFAULT_PUBLIC_ORIGIN = 'https://transn3uralia.vercel.app'
const JOB_NAME = 'pdf_ocr_backfill'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !secret || request.headers.get('authorization') === `Bearer ${secret}`
}

function publicOrigin(): string {
  const configured = process.env.PDF_OCR_PUBLIC_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  return (configured || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, '')
}

async function releaseClaim(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string,
  message: string,
) {
  const { error } = await supabase
    .from('document_text_extractions')
    .update({
      status: 'ocr_required',
      error_message: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('document_id', documentId)
    .eq('status', 'processing')

  if (error) throw error
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const safety = await shouldRunBackgroundWork()
  if (!safety.allowed) {
    return NextResponse.json({ status: 'skipped', reason: 'health_circuit_breaker', detail: safety.reason })
  }

  const startedAt = Date.now()
  const jobRun = await startSystemJobRun(JOB_NAME)
  const supabase = createAdminClient()

  const { data: recovered, error: recoveryError } = await supabase.rpc('recover_stale_pdf_ocr_processing', {
    p_stale_minutes: 20,
  })
  if (recoveryError) {
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      errorMessage: recoveryError.message,
      result: { stage: 'stale_recovery' },
    })
    return NextResponse.json({ stage: 'stale_recovery', error: recoveryError.message }, { status: 500 })
  }

  const { data: claimed, error: claimError } = await supabase.rpc('claim_pdf_ocr_documents', {
    p_limit: DOCUMENTS_PER_RUN,
  })
  if (claimError) {
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      errorMessage: claimError.message,
      result: { stage: 'claim', recovered: Number(recovered ?? 0) },
    })
    return NextResponse.json({ stage: 'claim', error: claimError.message }, { status: 500 })
  }

  const documents = (claimed ?? []).map((row: { document_id: string }) => row.document_id).filter(Boolean)
  if (documents.length === 0) {
    const result = {
      status: 'idle',
      recovered: Number(recovered ?? 0),
      reason: 'No eligible PDF documents found',
      durationMs: Date.now() - startedAt,
    }
    await finishSystemJobRun(jobRun, {
      status: 'completed',
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      result,
    })
    return NextResponse.json(result)
  }

  const headers: Record<string, string> = {}
  const secret = process.env.CRON_SECRET
  if (secret) headers.authorization = `Bearer ${secret}`

  const results: Array<Record<string, unknown>> = []
  const origin = publicOrigin()

  for (const documentId of documents) {
    const target = new URL('/api/pdf-ocr', origin)
    target.searchParams.set('documentId', documentId)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PDF_OCR_TIMEOUT_MS)

    try {
      const response = await fetch(target, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>

      if (!response.ok) {
        const errorMessage = typeof payload.error === 'string'
          ? payload.error
          : `PDF OCR returned HTTP ${response.status}`
        await releaseClaim(supabase, documentId, errorMessage)
      }

      results.push({
        documentId,
        ok: response.ok,
        httpStatus: response.status,
        ...payload,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF OCR request failed'
      await releaseClaim(supabase, documentId, `PDF OCR backfill subrequest failed: ${message}`)
      results.push({
        documentId,
        ok: false,
        httpStatus: 500,
        error: message,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  const succeeded = results.filter((result) => result.ok === true).length
  const failed = results.length - succeeded
  const httpStatus = failed === 0 ? 200 : succeeded > 0 ? 207 : 500
  const runStatus = failed === 0 ? 'completed' : succeeded > 0 ? 'partial' : 'failed'
  const responseBody = {
    status: runStatus,
    claimed: documents.length,
    recovered: Number(recovered ?? 0),
    succeeded,
    failed,
    results,
    durationMs: Date.now() - startedAt,
  }

  await finishSystemJobRun(jobRun, {
    status: runStatus,
    processedCount: documents.length,
    succeededCount: succeeded,
    failedCount: failed,
    result: {
      claimed: documents.length,
      recovered: Number(recovered ?? 0),
    },
    errorMessage: failed > 0 ? `${failed} PDF OCR document(s) failed` : null,
  })

  return NextResponse.json(responseBody, { status: httpStatus })
}
