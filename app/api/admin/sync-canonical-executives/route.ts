import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'
import {
  CANONICAL_EXECUTIVE_ASSIGNMENTS,
  CANONICAL_EXECUTIVE_SOURCE_DATE,
  type CanonicalExecutiveName,
} from '@/lib/canonical-executive-assignments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const EXECUTIVE_NAME_MATCHERS: Record<CanonicalExecutiveName, RegExp> = {
  Carolina: /^carolina\b/i,
  Javiera: /^javiera\b/i,
  Olga: /^olga\b/i,
}

const normalizeRut = (value: unknown) =>
  String(value || '').replace(/[^0-9kK]/g, '').toLowerCase()

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user) {
      return NextResponse.json({ error: auth.error || 'No autenticado' }, { status: 401 })
    }
    if (!isSuperAdmin(auth.user.email, auth.user.role)) {
      return NextResponse.json({ error: 'Solo super_admin puede sincronizar asignaciones' }, { status: 403 })
    }

    const admin = createAdminClient()
    const [{ data: staff, error: staffError }, { data: companies, error: companiesError }] = await Promise.all([
      admin.from('executive_staff').select('id, full_name, email, is_active').eq('is_active', true),
      admin.from('transportistas').select('id, rut, razon_social, assigned_executive_id, is_active'),
    ])

    if (staffError) throw staffError
    if (companiesError) throw companiesError

    const executiveIds = new Map<CanonicalExecutiveName, string>()
    for (const canonicalName of Object.keys(EXECUTIVE_NAME_MATCHERS) as CanonicalExecutiveName[]) {
      const matches = (staff || []).filter((row: any) =>
        EXECUTIVE_NAME_MATCHERS[canonicalName].test(String(row.full_name || '')),
      )
      if (matches.length !== 1) {
        return NextResponse.json({
          error: `No se pudo resolver ejecutiva canónica ${canonicalName}`,
          matches: matches.map((row: any) => ({ id: row.id, full_name: row.full_name, email: row.email })),
        }, { status: 409 })
      }
      executiveIds.set(canonicalName, matches[0].id)
    }

    const companyByRut = new Map(
      (companies || []).map((company: any) => [normalizeRut(company.rut), company] as const),
    )

    const missingRuts: string[] = []
    const updatesByExecutive = new Map<CanonicalExecutiveName, string[]>()
    const canonicalReactivationRuts = new Set(['773254141', '780991933'])
    const reactivated: string[] = []
    const unchanged: string[] = []

    for (const assignment of CANONICAL_EXECUTIVE_ASSIGNMENTS) {
      const company = companyByRut.get(normalizeRut(assignment.rut))
      if (!company) {
        missingRuts.push(assignment.rut)
        continue
      }

      const executiveId = executiveIds.get(assignment.executive)!
      const shouldReactivate =
        canonicalReactivationRuts.has(normalizeRut(assignment.rut)) && company.is_active === false

      if (company.assigned_executive_id === executiveId && !shouldReactivate) {
        unchanged.push(assignment.rut)
        continue
      }

      const ids = updatesByExecutive.get(assignment.executive) || []
      ids.push(company.id)
      updatesByExecutive.set(assignment.executive, ids)
      if (shouldReactivate) reactivated.push(assignment.rut)
    }

    const updated: Array<{ executive: CanonicalExecutiveName; count: number }> = []
    for (const [executive, companyIds] of updatesByExecutive) {
      if (companyIds.length === 0) continue
      const executiveId = executiveIds.get(executive)!
      const { error } = await admin
        .from('transportistas')
        .update({
          assigned_executive_id: executiveId,
          ejecutivo_nombre: executive,
          ejecutivo_asignado: null,
          is_active: true,
        })
        .in('id', companyIds)

      if (error) throw error
      updated.push({ executive, count: companyIds.length })
    }

    return NextResponse.json({
      success: true,
      sourceDate: CANONICAL_EXECUTIVE_SOURCE_DATE,
      canonicalRows: CANONICAL_EXECUTIVE_ASSIGNMENTS.length,
      updated,
      updatedTotal: updated.reduce((sum, item) => sum + item.count, 0),
      unchanged: unchanged.length,
      reactivated,
      reactivatedTotal: reactivated.length,
      missingRuts,
    })
  } catch (error) {
    console.error('[canonical-executives] sync failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al sincronizar asignaciones' },
      { status: 500 },
    )
  }
}
