import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth } from '@/lib/auth-middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { canReadVehicleEvidence } from '@/lib/vehicle-evidence-authorization'
import { reconcileVehicleEvidence } from '@/lib/vehicle-evidence-reconciliation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const QuerySchema = z.object({
  transportistaId: z.string().uuid(),
})

function normalizePlate(value?: string | null): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      transportistaId: url.searchParams.get('transportistaId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const authorization = await canReadVehicleEvidence(user, parsed.data.transportistaId)
    if (!authorization.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: authorization.reason },
        { status: 403 },
      )
    }

    const supabase = createAdminClient()
    const [{ data: vehicles, error: vehiclesError }, { data: facts, error: factsError }] = await Promise.all([
      supabase
        .from('vehiculos')
        .select('id,patente')
        .eq('transportista_id', parsed.data.transportistaId)
        .eq('is_active', true),
      supabase
        .from('vehicle_document_facts')
        .select('plate_normalized,prt_matched,confidence')
        .eq('transportista_id', parsed.data.transportistaId),
    ])

    if (vehiclesError) throw vehiclesError
    if (factsError) throw factsError

    const factsByPlate = new Map<string, { hasDocumentFact: boolean; hasPrtMatch: boolean; confidence: number | null }>()

    for (const fact of facts || []) {
      const plate = normalizePlate(fact.plate_normalized)
      if (!plate) continue

      const current = factsByPlate.get(plate) || {
        hasDocumentFact: false,
        hasPrtMatch: false,
        confidence: null,
      }

      current.hasDocumentFact = true
      current.hasPrtMatch = current.hasPrtMatch || fact.prt_matched === true

      const confidence = typeof fact.confidence === 'number'
        ? fact.confidence
        : fact.confidence === null || fact.confidence === undefined
          ? null
          : Number(fact.confidence)

      if (confidence !== null && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) {
        current.confidence = current.confidence === null
          ? confidence
          : Math.max(current.confidence, confidence)
      }

      factsByPlate.set(plate, current)
    }

    const reconciliation = reconcileVehicleEvidence(
      (vehicles || []).map((vehicle) => {
        const evidence = factsByPlate.get(normalizePlate(vehicle.patente))
        return {
          vehicle_id: vehicle.id,
          has_document_fact: evidence?.hasDocumentFact === true,
          has_prt_match: evidence?.hasPrtMatch === true,
          confidence: evidence?.confidence ?? null,
        }
      }),
    )

    return NextResponse.json({
      success: true,
      transportistaId: parsed.data.transportistaId,
      evidenceScope: 'active_registered_vehicles_observed_document_facts_and_prt',
      reconciliation,
      guardrails: {
        readOnly: true,
        allVehicleDocumentFamiliesCertified: false,
        operationalClearanceCertified: false,
      },
    })
  } catch (error) {
    console.error('[vehicle-evidence-reconciliation] Failed', error)
    return NextResponse.json(
      { error: 'Failed to reconcile vehicle evidence' },
      { status: 500 },
    )
  }
}
