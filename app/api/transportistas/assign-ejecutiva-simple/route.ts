import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireSuperAdmin(request: NextRequest): Promise<NextResponse | null> {
  const { user, error: authError } = await verifyAuth(request)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSuperAdmin(user.email, user.role)) {
    return NextResponse.json({ error: 'Only super_admin can change executive assignments' }, { status: 403 })
  }
  return null
}

/**
 * POST /api/transportistas/assign-ejecutiva-simple
 * Assign an executive to a transportista (subcontractor)
 * Body: { transportista_id: string, executive_email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { transportista_id, executive_email } = await request.json()

    if (!transportista_id || !executive_email) {
      return NextResponse.json(
        { error: 'Missing required fields: transportista_id and executive_email' },
        { status: 400 }
      )
    }

    const { data: transportista, error: transportistaError } = await supabase
      .from('transportistas')
      .select('id, rut, razon_social')
      .eq('id', transportista_id)
      .single()

    if (transportistaError || !transportista) {
      return NextResponse.json({ error: 'Transportista not found' }, { status: 404 })
    }

    const { data: ejecutiva, error: ejecutivaError } = await supabase
      .from('executive_staff')
      .select('id, full_name, email')
      .ilike('email', executive_email)
      .eq('is_active', true)
      .single()

    if (ejecutivaError || !ejecutiva) {
      return NextResponse.json({ error: 'Ejecutiva not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('transportistas')
      .update({
        assigned_executive_id: ejecutiva.id,
        ejecutivo_nombre: ejecutiva.full_name.split(' ')[0],
        ejecutivo_asignado: null,
      })
      .eq('id', transportista.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to assign ejecutiva' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Ejecutiva ${ejecutiva.full_name} assigned successfully`,
      data,
    })
  } catch (error: any) {
    console.error('[v0] Error in assign-ejecutiva-simple POST:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/transportistas/assign-ejecutiva-simple
 * Assign an executive by transportista RUT (legacy endpoint)
 * Body: { rut: string, ejecutiva_email: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { rut, ejecutiva_email } = await request.json()

    if (!rut || !ejecutiva_email) {
      return NextResponse.json(
        { error: 'Missing required fields: rut and ejecutiva_email' },
        { status: 400 }
      )
    }

    const { data: transportista, error: transportistaError } = await supabase
      .from('transportistas')
      .select('id, rut, razon_social')
      .eq('rut', rut)
      .single()

    if (transportistaError || !transportista) {
      return NextResponse.json({ error: 'Transportista not found' }, { status: 404 })
    }

    const { data: ejecutiva, error: ejecutivaError } = await supabase
      .from('executive_staff')
      .select('id, full_name, email')
      .ilike('email', ejecutiva_email)
      .eq('is_active', true)
      .single()

    if (ejecutivaError || !ejecutiva) {
      return NextResponse.json({ error: 'Ejecutiva not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('transportistas')
      .update({
        assigned_executive_id: ejecutiva.id,
        ejecutivo_nombre: ejecutiva.full_name.split(' ')[0],
        ejecutivo_asignado: null,
      })
      .eq('id', transportista.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to assign ejecutiva' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Ejecutiva ${ejecutiva.full_name} assigned successfully to ${transportista.razon_social}`,
      data,
    })
  } catch (error: any) {
    console.error('[v0] Error in assign-ejecutiva-simple PUT:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
