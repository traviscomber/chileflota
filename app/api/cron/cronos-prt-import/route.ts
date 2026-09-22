import { NextRequest, NextResponse } from 'next/server'
import { GET as runPrtImport } from '@/app/api/cron/prt-import/route'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { shouldRunBackgroundWork } from '@/lib/runtime-circuit-breaker'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300
export const runtime = 'nodejs'

const JOB_NAME = 'prt_import'

export async function GET(request: NextRequest) {
  const safety = await shouldRunBackgroundWork()
  if (!safety.allowed) {
    return NextResponse.json({ status: 'skipped', reason: 'health_circuit_breaker', detail: safety.reason })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)

  try {
    const response = await runPrtImport(request)
    const payload = await response.clone().json().catch(() => ({})) as Record<string, any>
    const imported = Number(payload.imported ?? 0)
    const rejected = Number(payload.rejected ?? 0)
    const duplicates = Number(payload.duplicates ?? 0)
    const attempted = Number(payload.rowsRead ?? 0) || (payload.batchId ? 1 : imported + rejected + duplicates)

    await finishSystemJobRun(jobRun, {
      status: response.ok ? 'completed' : 'failed',
      processedCount: attempted,
      succeededCount: response.ok ? imported : 0,
      failedCount: response.ok ? 0 : Math.max(1, attempted),
      result: {
        imported,
        rejected,
        duplicates,
        rowsRead: payload.rowsRead ?? null,
        reason: payload.reason ?? null,
        batchId: payload.batch?.id ?? payload.batchId ?? null,
        period: payload.batch?.period ?? null,
        recordType: payload.batch?.recordType ?? null,
      },
      errorMessage: response.ok ? null : String(payload.error ?? `HTTP ${response.status}`),
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PRT import cron error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      failedCount: 1,
      errorMessage: message,
      result: { stage: 'wrapper' },
    })
    throw error
  }
}
