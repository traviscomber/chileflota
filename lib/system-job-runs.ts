import { createAdminClient } from '@/lib/supabase/admin'

type JobRunStatus = 'completed' | 'partial' | 'failed' | 'skipped'

type FinishJobRunInput = {
  status: JobRunStatus
  processedCount?: number | null
  succeededCount?: number | null
  failedCount?: number | null
  result?: Record<string, unknown>
  errorMessage?: string | null
}

export type SystemJobRunHandle = {
  id: string | null
  startedAtMs: number
  jobName: string
}

export type StaleSystemJobRun = {
  id: string
  job_name: string
  started_at: string | null
}

export async function startSystemJobRun(
  jobName: string,
  triggerSource = 'cron',
): Promise<SystemJobRunHandle> {
  const startedAtMs = Date.now()

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('system_job_runs')
      .insert({
        job_name: jobName,
        status: 'running',
        trigger_source: triggerSource,
        deployment_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[system-job-runs] Failed to start ${jobName}:`, error)
      return { id: null, startedAtMs, jobName }
    }

    return { id: data.id, startedAtMs, jobName }
  } catch (error) {
    console.error(`[system-job-runs] Failed to start ${jobName}:`, error)
    return { id: null, startedAtMs, jobName }
  }
}

export async function finishSystemJobRun(
  handle: SystemJobRunHandle,
  input: FinishJobRunInput,
): Promise<void> {
  if (!handle.id) return

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('system_job_runs')
      .update({
        status: input.status,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - handle.startedAtMs,
        processed_count: input.processedCount ?? null,
        succeeded_count: input.succeededCount ?? null,
        failed_count: input.failedCount ?? null,
        result: input.result ?? {},
        error_message: input.errorMessage ?? null,
      })
      .eq('id', handle.id)

    if (error) {
      console.error(`[system-job-runs] Failed to finish ${handle.jobName}:`, error)
    }
  } catch (error) {
    console.error(`[system-job-runs] Failed to finish ${handle.jobName}:`, error)
  }
}

export async function recoverStaleSystemJobRuns(
  staleRuns: StaleSystemJobRun[],
  recoveredByRunId: string | null,
): Promise<string[]> {
  if (staleRuns.length === 0) return []

  const staleIds = staleRuns.map((run) => run.id)
  const completedAt = new Date().toISOString()

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('system_job_runs')
      .update({
        status: 'failed',
        completed_at: completedAt,
        failed_count: 1,
        result: {
          recovery: 'cronos_stale_run_recovery',
          recovered_at: completedAt,
          recovered_by_run_id: recoveredByRunId,
          previous_status: 'running',
        },
        error_message: 'Cronos recovered a stale running job after the reconciliation threshold was exceeded.',
      })
      .in('id', staleIds)
      .eq('status', 'running')
      .select('id')

    if (error) throw error
    return (data ?? []).map((row) => String(row.id))
  } catch (error) {
    console.error('[system-job-runs] Failed to recover stale system job runs:', error)
    throw error
  }
}
