import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  analyzeCanonicalRequirementProfile,
  type CatalogRequirementRow,
} from '@/lib/canonical-requirement-profile'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service-role access is deliberately created only after authentication.
    // This endpoint is catalog analysis only and performs no writes.
    const supabase = createAdminClient()

    const [conductorTypesResult, subcontractorTypesResult] = await Promise.all([
      supabase
        .from('document_types')
        .select('code,name,category,is_mandatory,is_active,expiration_days')
        .eq('category', 'conductor'),
      supabase
        .from('subcontractor_document_types')
        .select('code,nombre,periodicidad,es_obligatorio,is_active'),
    ])

    if (conductorTypesResult.error) throw conductorTypesResult.error
    if (subcontractorTypesResult.error) throw subcontractorTypesResult.error

    const conductorRows: CatalogRequirementRow[] = (conductorTypesResult.data || []).map((row: any) => ({
      code: row.code,
      mandatory: row.is_mandatory === true,
      active: row.is_active === true,
      cadence: row.expiration_days,
    }))

    const transportistaRows: CatalogRequirementRow[] = (subcontractorTypesResult.data || []).map((row: any) => ({
      code: row.code,
      mandatory: row.es_obligatorio === true,
      active: row.is_active === true,
      cadence: row.periodicidad,
    }))

    const conductor = analyzeCanonicalRequirementProfile('conductor', conductorRows)
    const transportista = analyzeCanonicalRequirementProfile('transportista', transportistaRows)

    return NextResponse.json({
      success: true,
      mode: 'read_only_catalog_analysis',
      generatedAt: new Date().toISOString(),
      canCertifyAnyCoverage: conductor.canCertifyCoverage || transportista.canCertifyCoverage,
      profiles: {
        conductor,
        transportista,
      },
      guardrails: {
        writesEnabled: false,
        mutatesCanonicalState: false,
        changesRequirementCatalog: false,
      },
    })
  } catch (error) {
    console.error('[canonical-requirement-profile] Failed to analyze catalog', error)
    return NextResponse.json(
      { error: 'Failed to analyze canonical requirement profile' },
      { status: 500 },
    )
  }
}
