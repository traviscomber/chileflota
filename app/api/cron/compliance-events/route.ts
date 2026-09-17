import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

type ComplianceEvent = {
  id: string
  event_type: string
  entity_type: string
  entity_ref: string
  organization_id: string | null
  source_record_id: string | null
  payload: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type CompanyPeriod = {
  companyEntityRef: string
  periodStart: string
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !secret || request.headers.get('authorization') === `Bearer ${secret}`
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function uniqueCompanyPeriods(periods: CompanyPeriod[]): CompanyPeriod[] {
  const seen = new Set<string>()
  return periods.filter((item) => {
    const key = `${item.companyEntityRef}:${item.periodStart}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function completeEvents(
  ids: string[],
  status: 'processed' | 'failed' | 'ignored',
  error?: string,
): Promise<void> {
  if (ids.length === 0) return
  const supabase = createAdminClient()
  const { error: rpcError } = await supabase.rpc('complete_compliance_events', {
    p_ids: ids,
    p_status: status,
    p_error: error ?? null,
  })
  if (rpcError) throw new Error(`Could not complete compliance events: ${rpcError.message}`)
}

async function resolveCompanyPeriods(events: ComplianceEvent[]): Promise<CompanyPeriod[]> {
  const supabase = createAdminClient()
  const periods: CompanyPeriod[] = []

  for (const event of events) {
    const periodCandidate = event.metadata?.periodStart ?? event.payload?.periodStart
    if (event.entity_type === 'company' && isIsoDate(periodCandidate)) {
      periods.push({ companyEntityRef: event.entity_ref, periodStart: periodCandidate })
    }
  }

  const documentIds = Array.from(new Set(events
    .filter((event) => event.event_type.startsWith('document.'))
    .map((event) => event.source_record_id ?? event.entity_ref)
    .filter((value): value is string => Boolean(value))))

  if (documentIds.length > 0) {
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select('id, subcontractor_id, document_period_start')
      .in('id', documentIds)
      .eq('is_current', true)

    if (error) throw new Error(`Could not resolve document periods: ${error.message}`)

    for (const document of data ?? []) {
      if (document.subcontractor_id && isIsoDate(document.document_period_start)) {
        periods.push({
          companyEntityRef: String(document.subcontractor_id),
          periodStart: document.document_period_start,
        })
      }
    }
  }

  return uniqueCompanyPeriods(periods)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const supabase = createAdminClient()
  const { data, error: claimError } = await supabase.rpc('claim_compliance_events', { p_limit: 100 })

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 })
  }

  const events = (data ?? []) as ComplianceEvent[]
  if (events.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, reason: 'no_pending_events', durationMs: Date.now() - startedAt })
  }

  const relevant = events.filter((event) =>
    event.event_type.startsWith('document.') || event.event_type === 'evidence.created',
  )
  const ignored = events.filter((event) => !relevant.some((candidate) => candidate.id === event.id))

  if (ignored.length > 0) {
    await completeEvents(ignored.map((event) => event.id), 'ignored')
  }

  if (relevant.length === 0) {
    return NextResponse.json({
      claimed: events.length,
      processed: 0,
      failed: 0,
      ignored: ignored.length,
      durationMs: Date.now() - startedAt,
    })
  }

  const hasDocumentEvents = relevant.some((event) => event.event_type.startsWith('document.'))
  let documentFacts: unknown = null
  if (hasDocumentEvents) {
    const { data: factsData, error: factsError } = await supabase.rpc('sync_subcontractor_document_facts')
    if (factsError) {
      const message = `sync_subcontractor_document_facts failed: ${factsError.message}`
      await completeEvents(relevant.map((event) => event.id), 'failed', message)
      return NextResponse.json({ error: message, claimed: events.length, failed: relevant.length }, { status: 500 })
    }
    documentFacts = factsData
  }

  const processedIds: string[] = []
  const failedItems: Array<{ eventId: string; error: string }> = []
  const decisions: unknown[] = []
  let recalculatedPeriods = 0

  // Isolate each event. A single bad company/period cannot poison the whole batch.
  // Failed items are retried by the DB with backoff and stop after five attempts.
  for (const event of relevant) {
    try {
      const companyPeriods = await resolveCompanyPeriods([event])

      for (const item of companyPeriods) {
        const { data: decision, error: decisionError } = await supabase.rpc(
          'recalculate_company_period_decision',
          {
            p_company_entity_ref: item.companyEntityRef,
            p_period_start: item.periodStart,
          },
        )
        if (decisionError) {
          throw new Error(`Granular decision failed for ${item.companyEntityRef}:${item.periodStart}: ${decisionError.message}`)
        }
        recalculatedPeriods += 1
        decisions.push(decision)
      }

      processedIds.push(event.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown compliance event processing error'
      failedItems.push({ eventId: event.id, error: message })
    }
  }

  if (processedIds.length > 0) {
    await completeEvents(processedIds, 'processed')
  }

  for (const failed of failedItems) {
    await completeEvents([failed.eventId], 'failed', failed.error)
  }

  return NextResponse.json({
    claimed: events.length,
    processed: processedIds.length,
    failed: failedItems.length,
    ignored: ignored.length,
    recalculatedPeriods,
    documentFacts,
    decisions,
    failures: failedItems,
    durationMs: Date.now() - startedAt,
  })
}
