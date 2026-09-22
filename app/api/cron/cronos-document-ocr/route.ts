import { NextRequest, NextResponse } from 'next/server'
import { GET as runDocumentOcr } from '@/app/api/cron/document-ocr/route'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { shouldRunBackgroundWork } from '@/lib/runtime-circuit-breaker'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300
export const runtime = 'nodejs'

const JOB_NAME = 'document_ocr'

export async function GET(request: NextRequest) {
  const safety = await shouldRunBackgroundWork()
  if (!safety.allowed) {
    return NextResponse.json({ status: 'skipped', reason: 'health_circuit_breaker', detail: safety.reason })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)

  try {
    const response = await runDocumentOcr(request)
    const payload = await response.clone().json().catch(() => ({})) as Record<string, unknown>
    const processed = Number(payload.processed ?? 0)
    const extracted = Number(payload.extracted ?? 0)
    const failed = Math.max(0, processed - extracted)

    await finishSystemJobRun(jobRun, {
      status: response.ok ? (failed > 0 ? 'partial' : 'completed') : 'failed',
      processedCount: processed,
      succeededCount: extracted,
      failedCount: failed,
      result: {
        batchId: payload.batchId ?? null,
        batchStatus: payload.batchStatus ?? null,
        engine: payload.engine ?? null,
      },
      errorMessage: response.ok ? null : String(payload.error ?? payload.stage ?? `HTTP ${response.status}`),
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown document OCR cron error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      errorMessage: message,
      result: { stage: 'wrapper' },
    })
    throw error
  }
}
