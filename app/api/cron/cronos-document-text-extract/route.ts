import { NextRequest, NextResponse } from 'next/server'
import { GET as runDocumentTextExtract } from '@/app/api/cron/document-text-extract/route'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { shouldRunBackgroundWork } from '@/lib/runtime-circuit-breaker'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const JOB_NAME = 'document_text_extract'

export async function GET(request: NextRequest) {
  const safety = await shouldRunBackgroundWork()
  if (!safety.allowed) {
    return NextResponse.json({ status: 'skipped', reason: 'health_circuit_breaker', detail: safety.reason })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)

  try {
    const response = await runDocumentTextExtract(request)
    const payload = await response.clone().json().catch(() => ({})) as Record<string, unknown>
    const processed = Number(payload.processed ?? 0)
    const summary = (payload.summary ?? {}) as Record<string, unknown>
    const failed = Number(summary.failed ?? 0)
    const succeeded = Math.max(0, processed - failed)
    const skipped = payload.status === 'skipped'

    await finishSystemJobRun(jobRun, {
      status: skipped ? 'skipped' : response.ok ? (failed > 0 ? 'partial' : 'completed') : 'failed',
      processedCount: processed,
      succeededCount: succeeded,
      failedCount: failed,
      result: {
        legacyImagesReclassified: payload.legacyImagesReclassified ?? 0,
        summary,
      },
      errorMessage: response.ok || skipped ? null : String(payload.error ?? `HTTP ${response.status}`),
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown document text extraction error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      errorMessage: message,
      result: { stage: 'wrapper' },
    })
    throw error
  }
}
