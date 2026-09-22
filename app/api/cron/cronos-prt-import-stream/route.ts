import { NextRequest, NextResponse } from 'next/server'
import { GET as runPrtImportStream } from '@/app/api/cron/prt-import-stream/route'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { shouldRunBackgroundWork } from '@/lib/runtime-circuit-breaker'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300
export const runtime = 'nodejs'

const JOB_NAME = 'prt_import_stream'

export async function GET(request: NextRequest) {
  const safety = await shouldRunBackgroundWork()
  if (!safety.allowed) {
    return NextResponse.json({ status: 'skipped', reason: 'health_circuit_breaker', detail: safety.reason })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)

  try {
    const response = await runPrtImportStream(request)
    const payload = await response.clone().json().catch(() => ({})) as Record<string, any>
    const processed = Number(payload.processed ?? 0)
    const imported = Number(payload.imported ?? 0)
    const rejected = Number(payload.rejected ?? 0)
    const duplicates = Number(payload.duplicates ?? 0)

    await finishSystemJobRun(jobRun, {
      status: response.ok ? 'completed' : 'failed',
      processedCount: processed || (payload.batchId ? 1 : 0),
      succeededCount: response.ok ? imported : 0,
      failedCount: response.ok ? 0 : Math.max(1, processed),
      result: {
        imported,
        rejected,
        duplicates,
        cursor: payload.cursor ?? null,
        completed: payload.completed ?? null,
        reason: payload.reason ?? null,
        batchId: payload.batch?.id ?? payload.batchId ?? null,
        period: payload.batch?.period ?? null,
        recordType: payload.batch?.recordType ?? null,
      },
      errorMessage: response.ok ? null : String(payload.error ?? `HTTP ${response.status}`),
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown streaming PRT import cron error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      failedCount: 1,
      errorMessage: message,
      result: { stage: 'wrapper' },
    })
    throw error
  }
}
