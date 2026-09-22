import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Auto-assign transportistas using the ORIGINAL CSV data (scripts/subcontratistas.csv).
 * This is security-sensitive because document approval is scoped by assignment.
 * Only the persisted super_admin may execute it.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperAdmin(user.email, user.role)) {
      return NextResponse.json({ error: 'Only super_admin can reassign transportistas' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'
    const supabase = createAdminClient()

    const csvPath = join(process.cwd(), 'scripts', 'subcontratistas.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())

    const csvData: { rut: string; ejecutiva: string }[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';')
      if (cols.length >= 5 && cols[0] && cols[4]) {
        csvData.push({ rut: cols[0].trim(), ejecutiva: cols[4].trim() })
      }
    }

    const NAME_MAPPING: Record<string, string> = {
      Cecilia: 'Javiera',
      Carolina: 'Carolina',
      Daniela: 'Daniela',
      Olga: 'Olga',
    }

    const { data: executives, error: execError } = await supabase
      .from('executive_staff')
      .select('id, full_name, email')
      .eq('is_active', true)

    if (execError || !executives || executives.length === 0) {
      return NextResponse.json({ error: 'No hay ejecutivas activas en la BD' }, { status: 400 })
    }

    const execByFirstName = new Map<string, { id: string; full_name: string }>()
    for (const exec of executives) {
      const firstName = exec.full_name.split(' ')[0]
      execByFirstName.set(firstName, { id: exec.id, full_name: exec.full_name })
    }

    let query = supabase
      .from('transportistas')
      .select('id, rut, razon_social, assigned_executive_id')

    if (!force) query = query.is('assigned_executive_id', null)

    const { data: allTransportistas, error: tError } = await query
    if (tError) throw tError

    const transportistaByRut = new Map<string, any>()
    allTransportistas?.forEach(t => transportistaByRut.set(t.rut, t))

    const assignments: any[] = []
    const errors: string[] = []
    const updatesByExecutive = new Map<string, { ids: string[]; firstName: string }>()

    for (const csvRow of csvData) {
      const transportista = transportistaByRut.get(csvRow.rut)
      if (!transportista) {
        errors.push(`RUT ${csvRow.rut} not found in DB`)
        continue
      }

      const mappedName = NAME_MAPPING[csvRow.ejecutiva]
      if (!mappedName) {
        errors.push(`Unknown ejecutiva name: "${csvRow.ejecutiva}" for RUT ${csvRow.rut}`)
        continue
      }

      const executive = execByFirstName.get(mappedName)
      if (!executive) {
        errors.push(`Executive "${mappedName}" (mapped from "${csvRow.ejecutiva}") not found in DB`)
        continue
      }

      if (!updatesByExecutive.has(executive.id)) {
        updatesByExecutive.set(executive.id, { ids: [], firstName: executive.full_name.split(' ')[0] })
      }
      updatesByExecutive.get(executive.id)!.ids.push(transportista.id)
      assignments.push({
        rut: csvRow.rut,
        razon_social: transportista.razon_social,
        csv_ejecutiva: csvRow.ejecutiva,
        assigned_to: executive.full_name,
      })
    }

    for (const [execId, assignment] of updatesByExecutive.entries()) {
      const { error: updateError } = await supabase
        .from('transportistas')
        .update({
          assigned_executive_id: execId,
          ejecutivo_nombre: assignment.firstName,
          ejecutivo_asignado: null,
        })
        .in('id', assignment.ids)

      if (updateError) {
        return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 })
      }
    }

    const csvRuts = new Set(csvData.map(c => c.rut))
    const notInCsv = allTransportistas?.filter(t => !csvRuts.has(t.rut)) || []

    if (notInCsv.length > 0) {
      const loadCounts = new Map<string, number>()
      executives.forEach(e => loadCounts.set(e.id, 0))
      for (const [execId, assignment] of updatesByExecutive.entries()) loadCounts.set(execId, assignment.ids.length)

      for (const t of notInCsv) {
        let minExec = executives[0]
        let minLoad = loadCounts.get(minExec.id) || 0
        for (const exec of executives) {
          const load = loadCounts.get(exec.id) || 0
          if (load < minLoad) {
            minExec = exec
            minLoad = load
          }
        }

        const { error: updateError } = await supabase
          .from('transportistas')
          .update({
            assigned_executive_id: minExec.id,
            ejecutivo_nombre: minExec.full_name.split(' ')[0],
            ejecutivo_asignado: null,
          })
          .eq('id', t.id)

        if (!updateError) {
          loadCounts.set(minExec.id, (loadCounts.get(minExec.id) || 0) + 1)
          assignments.push({
            rut: t.rut,
            razon_social: t.razon_social,
            csv_ejecutiva: '(new - not in CSV)',
            assigned_to: minExec.full_name,
          })
        }
      }
    }

    const distribution: Record<string, number> = {}
    assignments.forEach(a => {
      distribution[a.assigned_to] = (distribution[a.assigned_to] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      processed: assignments.length,
      csv_rows: csvData.length,
      not_in_csv: notInCsv.length,
      distribution,
      mode: force ? 'FORCE (overwrites all)' : 'SAFE (only unassigned)',
      errors: errors.length > 0 ? errors : undefined,
      message: force
        ? `Asignados ${assignments.length} transportistas (MODO FORZADO - sobreescribio asignaciones manuales)`
        : `Asignados ${assignments.length} transportistas sin ejecutiva asignada`,
    })
  } catch (error) {
    console.error('[v0] Error in CSV-based auto-assign:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en auto-asignacion' },
      { status: 500 }
    )
  }
}
