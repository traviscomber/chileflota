import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finishSystemJobRun, recoverStaleSystemJobRuns, startSystemJobRun } from '@/lib/system-job-runs'
import { RECONCILIATION_THRESHOLDS_MINUTES, reconcileClaims, type ReconciliationClaim } from '@/lib/cronos-reconciliation'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60
export const runtime = 'nodejs'

const JOB_NAME = 'cronos_reconciliation'

export async function GET() {
  const jobRun = await startSystemJobRun(JOB_NAME)
  const supabase = createAdminClient()

  try {
    const recovery = await recoverStaleSystemJobRuns(RECONCILIATION_THRESHOLDS_MINUTES.system_job_runs, jobRun.id)

    const [jobs, prt, compliance, documents, textExtractions, ocrBatches] = await Promise.all([
      supabase.from('system_job_runs').select('id,status,started_at').eq('status', 'running').neq('id', jobRun.id ?? ''),
      supabase.from('prt_import_batches').select('id,status,updated_at').eq('status', 'importing'),
      supabase.from('compliance_events').select('id,processing_status,created_at').eq('processing_status', 'processing'),
      supabase.from('documents').select('id,processing_status,updated_at').eq('processing_status', 'processing'),
      supabase.from('document_text_extractions').select('document_id,status,updated_at').eq('status', 'processing'),
      supabase.from('ocr_processing_batches').select('id,status,updated_at').eq('status', 'processing'),
    ])

    const queryErrors = [jobs.error, prt.error, compliance.error, documents.error, textExtractions.error, ocrBatches.error].filter(Boolean)
    if (queryErrors.length > 0) throw new Error(queryErrors.map((error) => error?.message).join('; '))

    const claims: ReconciliationClaim[] = [
      ...(jobs.data ?? []).map((row) => ({ source: 'system_job_runs', id: String(row.id), state: String(row.status), claimedAt: row.started_at, staleAfterMinutes: RECONCILIATION_THRESHOLDS_MINUTES.system_job_runs })),
      ...(prt.data ?? []).map((row) => ({ source: 'prt_import_batches', id: String(row.id), state: String(row.status), claimedAt: row.updated_at, staleAfterMinutes: RECONCILIATION_THRESHOLDS_MINUTES.prt_import_batches })),
      ...(compliance.data ?? []).map((row) => ({ source: 'compliance_events', id: String(row.id), state: String(row.processing_status), claimedAt: row.created_at, staleAfterMinutes: RECONCILIATION_THRESHOLDS_MINUTES.compliance_events })),
      ...(documents.data ?? []).map((row) => ({ source: 'documents', id: String(row.id), state: String(row.processing_status), claimedAt: row.updated_at, staleAfterMinutes: RECONCILIATION_THRESHOLDS_MINUTES.documents })),
      ...(textExtractions.data ?? []).map((row) => ({ source: 'document_text_extractions', id: String(row.document_id), state: String(row.status), claimedAt: row.updated_at, staleAfterMinutes: RECONCILIATION_THRESHOLDS_MINUTES.document_text_extractions })),
      ...(ocrBatches.data ?? []).map((row) => ({ source: 'ocr_processing_batches', id: String(row.id), state: String(row.status), claimedAt: row.updated_at, staleAfterMinutes: RECONCILIATION_THRESHOLDS_MINUTES.ocr_processing_batches })),
    ]

    const summary = reconcileClaims(claims)
    const status = summary.staleCount > 0 ? 'partial' : 'completed'

    await finishSystemJobRun(jobRun, {
      status,
      processedCount: summary.activeCount,
      succeededCount: summary.healthyCount,
      failedCount: 0,
      result: {
        staleCount: summary.staleCount,
        activeCount: summary.activeCount,
        issues: summary.issues.slice(0, 25),
        recoveryMode: 'recover_stale_system_job_runs',
        recoveredSystemJobRuns: recovery.recoveredCount,
      },
      errorMessage: null,
    })

    return NextResponse.json({
      status,
      ...summary,
      recoveryMode: 'recover_stale_system_job_runs',
      recoveredSystemJobRuns: recovery.recoveredCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Cronos reconciliation error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      failedCount: 1,
      errorMessage: message,
      result: { stage: 'reconciliation' },
    })
    return NextResponse.json({ status: 'failed', error: message }, { status: 500 })
  }
}
