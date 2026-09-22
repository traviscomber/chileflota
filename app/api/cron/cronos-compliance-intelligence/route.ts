import { NextRequest, NextResponse } from 'next/server'
import { GET as runComplianceIntelligence } from '@/app/api/cron/compliance-intelligence/route'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { shouldRunBackgroundWork } from '@/lib/runtime-circuit-breaker'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120
export const runtime = 'nodejs'

const JOB_NAME = 'compliance_intelligence'

export async function GET(request: NextRequest) {
  const safety = await shouldRunBackgroundWork()
  if (!safety.allowed) {
    return NextResponse.json({ status: 'skipped', reason: 'health_circuit_breaker', detail: safety.reason })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)

  try {
    const response = await runComplianceIntelligence(request)
    const payload = await response.clone().json().catch(() => ({})) as Record<string, any>

    await finishSystemJobRun(jobRun, {
      status: response.ok ? 'completed' : 'failed',
      processedCount: 1,
      succeededCount: response.ok ? 1 : 0,
      failedCount: response.ok ? 0 : 1,
      result: {
        stage: payload.stage ?? null,
        durationMs: payload.durationMs ?? null,
        documentFacts: payload.documentFacts ?? null,
        workerFacts: payload.workerFacts ?? null,
        intelligence: payload.intelligence ?? null,
      },
      errorMessage: response.ok ? null : String(payload.error ?? `HTTP ${response.status}`),
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown compliance intelligence cron error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      processedCount: 1,
      failedCount: 1,
      errorMessage: message,
      result: { stage: 'wrapper' },
    })
    throw error
  }
}
