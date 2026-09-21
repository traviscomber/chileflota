import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth } from '@/lib/auth-middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { canReadPayrollEvidence } from '@/lib/payroll-evidence-authorization'
import { reconcilePayrollEvidence } from '@/lib/payroll-evidence-reconciliation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const QuerySchema = z.object({
  transportistaId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, 'periodStart must be YYYY-MM-01'),
})

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      transportistaId: url.searchParams.get('transportistaId'),
      periodStart: url.searchParams.get('periodStart'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const authorization = await canReadPayrollEvidence(user, parsed.data.transportistaId)
    if (!authorization.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: authorization.reason },
        { status: 403 },
      )
    }

    // Privileged read client is created only after authentication, input
    // validation and transportista-level authorization have succeeded.
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('worker_reconciliation_current')
      .select('has_liquidation,has_previred,reconciliation_confidence')
      .eq('company_entity_ref', parsed.data.transportistaId)
      .eq('period_start', parsed.data.periodStart)

    if (error) throw error

    const reconciliation = reconcilePayrollEvidence(data || [])

    return NextResponse.json({
      success: true,
      transportistaId: parsed.data.transportistaId,
      periodStart: parsed.data.periodStart,
      evidenceScope: 'observed_workers_liquidation_previred_pair',
      reconciliation,
      guardrails: {
        readOnly: true,
        workforceCompletenessCertified: false,
        operationalClearanceCertified: false,
      },
    })
  } catch (error) {
    console.error('[payroll-evidence-reconciliation] Failed', error)
    return NextResponse.json(
      { error: 'Failed to reconcile payroll evidence' },
      { status: 500 },
    )
  }
}
