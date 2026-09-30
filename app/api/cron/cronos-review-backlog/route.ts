import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'
import { buildReviewBacklogSnapshot } from '@/lib/review-backlog-sentinel'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60
export const runtime = 'nodejs'

const JOB_NAME = 'review_backlog_sentinel'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)
  const supabase = createAdminClient()

  try {
    const [documentsResult, companiesResult, executivesResult] = await Promise.all([
      supabase
        .from('subcontractor_documents')
        .select('id,subcontractor_id,uploaded_at,created_at')
        .eq('status', 'pending')
        .limit(5000),
      supabase
        .from('transportistas')
        .select('id,razon_social,rut,assigned_executive_id,is_active')
        .limit(5000),
      supabase
        .from('executive_staff')
        .select('id,full_name,email,is_active')
        .limit(500),
    ])

    const errors = [documentsResult.error, companiesResult.error, executivesResult.error].filter(Boolean)
    if (errors.length > 0) {
      throw new Error(errors.map((error) => error?.message).join('; '))
    }

    const snapshot = buildReviewBacklogSnapshot(
      (documentsResult.data ?? []).map((row) => ({
        id: String(row.id),
        subcontractorId: row.subcontractor_id ? String(row.subcontractor_id) : null,
        pendingSince: String(row.uploaded_at ?? row.created_at),
      })),
      (companiesResult.data ?? []).map((row) => ({
        id: String(row.id),
        razonSocial: row.razon_social ? String(row.razon_social) : null,
        rut: row.rut ? String(row.rut) : null,
        assignedExecutiveId: row.assigned_executive_id ? String(row.assigned_executive_id) : null,
        isActive: row.is_active,
      })),
      (executivesResult.data ?? []).map((row) => ({
        id: String(row.id),
        fullName: row.full_name ? String(row.full_name) : null,
        email: row.email ? String(row.email) : null,
        isActive: row.is_active,
      })),
    )

    const now = new Date()
    const snapshotDate = now.toISOString().slice(0, 10)

    const { error: persistError } = await supabase
      .from('review_backlog_snapshots')
      .upsert({
        snapshot_date: snapshotDate,
        captured_at: now.toISOString(),
        total_pending: snapshot.totalPending,
        max_age_days: snapshot.maxAgeDays,
        sla_buckets: snapshot.slaBuckets,
        executive_summary: snapshot.executiveSummary,
        ownership_anomalies: snapshot.ownershipAnomalies,
        backlog_anomalies: snapshot.backlogAnomalies,
      }, { onConflict: 'snapshot_date' })

    if (persistError) {
      throw new Error(`Could not persist review backlog snapshot: ${persistError.message}`)
    }

    await finishSystemJobRun(jobRun, {
      status: 'completed',
      processedCount: snapshot.totalPending,
      succeededCount: snapshot.totalPending,
      failedCount: 0,
      result: {
        snapshotDate,
        totalPending: snapshot.totalPending,
        maxAgeDays: snapshot.maxAgeDays,
        slaBuckets: snapshot.slaBuckets,
        ownershipAnomalyCount: snapshot.ownershipAnomalies.length,
        backlogAnomalyCount: snapshot.backlogAnomalies.length,
        executiveSummary: snapshot.executiveSummary,
      },
      errorMessage: null,
    })

    return NextResponse.json({
      status: 'completed',
      snapshotDate,
      ...snapshot,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review backlog sentinel error'

    await finishSystemJobRun(jobRun, {
      status: 'failed',
      failedCount: 1,
      errorMessage: message,
      result: { stage: 'review_backlog_sentinel' },
    })

    return NextResponse.json({ status: 'failed', error: message }, { status: 500 })
  }
}
