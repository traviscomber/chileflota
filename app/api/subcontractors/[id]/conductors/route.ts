import { NextResponse, NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateSubcontractorRequest } from '@/lib/subcontractor-auth'

/**
 * GET /api/subcontractors/[id]/conductors
 * Fetch conductors associated with the authenticated subcontractor only.
 *
 * Conductors are linked to subcontractors via:
 * - rut_proveedor field in conductores table = rut field in transportistas table
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json(
        { error: 'Subcontractor ID is required' },
        { status: 400 },
      )
    }

    const auth = await authenticateSubcontractorRequest(request, id)
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      )
    }

    const supabase = createAdminClient()

    const { data: conductors, error: conductorsError } = await supabase
      .from('conductores')
      .select('id, nombre_completo, numero_licencia, rut, status, fecha_expiracion_licencia, created_at, rut_proveedor')
      .eq('rut_proveedor', auth.identity.rut)
      .order('nombre_completo', { ascending: true })

    if (conductorsError) {
      console.error('[subcontractor-conductors] Fetch failed', conductorsError)
      return NextResponse.json([])
    }

    return NextResponse.json(conductors || [])
  } catch (error) {
    console.error('[subcontractor-conductors] GET failed', error)
    return NextResponse.json([])
  }
}
