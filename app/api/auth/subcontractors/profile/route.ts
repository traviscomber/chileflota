import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateSubcontractorRequest } from '@/lib/subcontractor-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateSubcontractorRequest(request)
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      )
    }

    const supabase = createAdminClient()
    const { data: transportista, error } = await supabase
      .from('transportistas')
      .select('id, rut, razon_social, nombre_fantasia')
      .eq('id', auth.identity.transportistaId)
      .single()

    if (error || !transportista) {
      return NextResponse.json(
        { error: 'Transportista not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      transportista: {
        id: transportista.id,
        rut: transportista.rut,
        nombre: transportista.razon_social || transportista.nombre_fantasia,
      },
    })
  } catch (error) {
    console.error('[subcontractor-profile] Endpoint failed', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
