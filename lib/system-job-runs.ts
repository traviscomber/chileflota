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


export type RecoverStaleSystemJobRunsResult = {
  recoveredCount: number
  recoveredIds: string[]
}

export async function recoverStaleSystemJobRuns(
  staleAfterMinutes = 30,
  excludeId?: string | null,
): Promise<RecoverStaleSystemJobRunsResult> {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString()
  const supabase = createAdminClient()

  let query = supabase
    .from('system_job_runs')
    .select('id')
    .eq('status', 'running')
    .lt('started_at', cutoff)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: staleRows, error: selectError } = await query

  if (selectError) {
    throw new Error(`Failed to inspect stale system_job_runs: ${selectError.message}`)
  }

  const recoveredIds = (staleRows ?? []).map((row) => String(row.id))
  if (recoveredIds.length === 0) {
    return { recoveredCount: 0, recoveredIds: [] }
  }

  const completedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('system_job_runs')
    .update({
      status: 'failed',
      completed_at: completedAt,
      failed_count: 1,
      error_message: `Recovered by Cronos: stale running job exceeded ${staleAfterMinutes} minute reconciliation threshold.`,
      result: {
        recovered_by: 'cronos',
        recovery_reason: 'stale_running_timeout',
        recovered_at: completedAt,
        stale_after_minutes: staleAfterMinutes,
      },
    })
    .in('id', recoveredIds)
    .eq('status', 'running')

  if (updateError) {
    throw new Error(`Failed to recover stale system_job_runs: ${updateError.message}`)
  }

  return {
    recoveredCount: recoveredIds.length,
    recoveredIds,
  }
}
