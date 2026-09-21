import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveF30BackfillOutcome } from '@/lib/f30-backfill-outcome'
import { finishSystemJobRun, startSystemJobRun } from '@/lib/system-job-runs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const BATCH_SIZE = 20
const CONCURRENCY = 4
const LOCK_NAME = 'f30_backfill'
const JOB_NAME = 'f30_backfill'
const LOCK_LEASE_SECONDS = 360
const F30_TYPE_CODES = ['F30', 'F30-1_CLIENTE', 'F30-1_DOÑA_ISIDORA']
const PRODUCTION_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://transn3uralia.vercel.app'

function isAuthorizedCron(request: NextRequest): boolean {
  const authorization = request.headers.get('authorization')
  const configuredSecret = process.env.CRON_SECRET
  return Boolean(configuredSecret && authorization === `Bearer ${configuredSecret}`)
}

async function getF30TypeIds(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data, error } = await supabase
    .from('subcontractor_document_types')
    .select('id, code')
    .in('code', F30_TYPE_CODES)
    .eq('is_active', true)

  if (error) throw new Error(`Unable to resolve F30 document types: ${error.message}`)
  return (data ?? []).map((row) => row.id)
}

function buildF30Filter(typeIds: string[]): string {
  const filters = ['file_name.ilike.F30%', 'file_name.ilike.F 30%']
  if (typeIds.length > 0) filters.push(`document_type_id.in.(${typeIds.join(',')})`)
  return filters.join(',')
}

async function persistTerminalOutcome(
  documentId: string,
  status: string,
  details: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const { error } = await supabase
    .from('subcontractor_documents')
    .update({
      f30_status: status,
      f30_details: details ?? { detected: false, warnings: ['backfill_terminalized'] },
      f30_validated_at: new Date().toISOString(),
    })
    .eq('id', documentId)

  if (error) throw new Error(`Unable to persist F30 terminal state: ${error.message}`)
}

async function processDocument(
  document: { id: string; file_name: string | null },
  supabase: ReturnType<typeof createAdminClient>,
  cronSecret: string,
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${PRODUCTION_ORIGIN}/api/company/documents/${document.id}/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ documentId: document.id, source: 'f30_backfill' }),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    const outcome = resolveF30BackfillOutcome({
      httpOk: response.ok,
      httpStatus: response.status,
      payload,
    })

    if (outcome.persistTerminalState) {
      await persistTerminalOutcome(document.id, outcome.status, outcome.details, supabase)
    }

    return {
      id: document.id,
      fileName: document.file_name,
      status: outcome.status,
      saved: payload?.saved ?? false,
      periodConflict: payload?.periodConflict ?? false,
      usedOcrFallback: payload?.usedOcrFallback ?? false,
      terminalizedByBackfill: outcome.persistTerminalState,
      error: outcome.details?.error,
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown backfill error'
    await persistTerminalOutcome(
      document.id,
      'analysis_failed',
      { detected: false, warnings: ['backfill_failed'], error: message },
      supabase,
    )

    return { id: document.id, fileName: document.file_name, status: 'analysis_failed', error: message }
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()

  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is required for F30 backfill' }, { status: 503 })
  }

  const jobRun = await startSystemJobRun(JOB_NAME)
  const supabase = createAdminClient()
  const ownerToken = randomUUID()
  const { data: acquired, error: lockError } = await supabase.rpc('acquire_system_job_lock', {
    p_job_name: LOCK_NAME,
    p_owner_token: ownerToken,
    p_lease_seconds: LOCK_LEASE_SECONDS,
  })

  if (lockError) {
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      errorMessage: lockError.message,
      result: { stage: 'lock_acquire' },
    })
    return NextResponse.json({ error: `Unable to acquire F30 lock: ${lockError.message}` }, { status: 500 })
  }

  if (!acquired) {
    await finishSystemJobRun(jobRun, {
      status: 'skipped',
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      result: { reason: 'backfill_already_running' },
    })
    return NextResponse.json({ status: 'skipped', reason: 'backfill_already_running' })
  }

  try {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    await supabase
      .from('subcontractor_documents')
      .update({ f30_status: null, f30_validated_at: null })
      .eq('f30_status', 'processing')
      .lt('f30_validated_at', staleBefore)

    const f30TypeIds = await getF30TypeIds(supabase)
    const f30Filter = buildF30Filter(f30TypeIds)

    const { data: pending, error } = await supabase
      .from('subcontractor_documents')
      .select('id, file_name, uploaded_at')
      .is('f30_status', null)
      .or(f30Filter)
      .order('uploaded_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (error) {
      await finishSystemJobRun(jobRun, {
        status: 'failed',
        processedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        errorMessage: error.message,
        result: { stage: 'pending_query' },
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      await finishSystemJobRun(jobRun, {
        status: 'completed',
        processedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        result: { remaining: 0 },
      })
      return NextResponse.json({ status: 'complete', processed: 0, remaining: 0 })
    }

    const claimedAt = new Date().toISOString()
    const claimedIds = pending.map((document) => document.id)
    const { error: claimError } = await supabase
      .from('subcontractor_documents')
      .update({ f30_status: 'processing', f30_validated_at: claimedAt })
      .in('id', claimedIds)
      .is('f30_status', null)

    if (claimError) {
      await finishSystemJobRun(jobRun, {
        status: 'failed',
        processedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        errorMessage: claimError.message,
        result: { stage: 'claim' },
      })
      return NextResponse.json({ error: claimError.message }, { status: 500 })
    }

    const results: Array<Record<string, unknown>> = []

    for (let index = 0; index < pending.length; index += CONCURRENCY) {
      const chunk = pending.slice(index, index + CONCURRENCY)
      const chunkResults = await Promise.all(
        chunk.map((document) => processDocument(document, supabase, cronSecret)),
      )
      results.push(...chunkResults)
    }

    const { count: remaining } = await supabase
      .from('subcontractor_documents')
      .select('id', { count: 'exact', head: true })
      .is('f30_status', null)
      .or(f30Filter)

    const summary = results.reduce<Record<string, number>>((acc, result) => {
      const status = String(result.status ?? 'unknown')
      const currentCount = acc[status] ?? 0
      acc[status] = currentCount + 1
      return acc
    }, {})

    const failed = results.filter((result) => result.status === 'analysis_failed').length
    const succeeded = results.length - failed
    const runStatus = failed === 0 ? 'completed' : succeeded > 0 ? 'partial' : 'failed'

    await finishSystemJobRun(jobRun, {
      status: runStatus,
      processedCount: results.length,
      succeededCount: succeeded,
      failedCount: failed,
      result: {
        remaining: remaining ?? null,
        summary,
        detectedTypeIds: f30TypeIds.length,
      },
      errorMessage: failed > 0 ? `${failed} F30 document(s) ended in analysis_failed` : null,
    })

    return NextResponse.json({
      status: 'processed',
      batchSize: BATCH_SIZE,
      concurrency: CONCURRENCY,
      detectedTypeIds: f30TypeIds.length,
      processed: results.length,
      remaining: remaining ?? null,
      durationMs: Date.now() - startedAt,
      summary,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown F30 backfill error'
    await finishSystemJobRun(jobRun, {
      status: 'failed',
      errorMessage: message,
      result: { stage: 'unexpected' },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    const { error: releaseError } = await supabase.rpc('release_system_job_lock', {
      p_job_name: LOCK_NAME,
      p_owner_token: ownerToken,
    })
    if (releaseError) console.error('[f30-backfill] Failed to release lock', releaseError)
  }
}
