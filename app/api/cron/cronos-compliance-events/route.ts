import { NextRequest } from 'next/server'
import { GET as runComplianceEvents } from '@/app/api/cron/compliance-events/route'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const JOB_NAME = 'compliance_events'

export async function GET(request: NextRequest) {
  const jobRun = await startSystemJobRun(JOB_NAME)

  try {
    const response = await runComplianceEvents(request)
    const payload = await response.clone().json().catch(() => ({})) as Record<string, unknown>
    const claimed = Number(payload.claimed ?? payload.processed ?? 0)
    const processed = Number(payload.processed ?? 0)
    const ignored = Number(payload.ignored ?? 0)
    const failed = Number(payload.failed ?? (response.ok ? 0 : Math.max(1, claimed)))
    const succeeded = processed + ignored
    const status = !response.ok
      ? 'failed'
      : failed > 0 && succeeded > 0
        ? 'partial'
        : failed > 0
          ? 'failed'
          : 'completed'

    await finishSystemJobRun(jobRun, {
      status,
      processedCount: claimed,
      succeededCount: succeeded,
      failedCount: failed,
      result: {
        processed,
        failed,
        ignored,
        recalculatedPeriods: payload.recalculatedPeriods ?? 0,
        reason: payload.reason ?? null,
        failures: payload.failures ?? [],
      },
      errorMessage: failed > 0
        ? String(payload.error ?? `${failed} compliance event(s) failed`)
        : null,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown compliance events error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      errorMessage: message,
      result: { stage: 'wrapper' },
    })
    throw error
  }
}
