import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperAdmin(user.email, user.role)) {
      return NextResponse.json({ error: 'Only super_admin can change executive assignments' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { transportista_id, ejecutiva_id } = await request.json()

    if (!transportista_id || !ejecutiva_id) {
      return NextResponse.json(
        { error: 'Missing required fields: transportista_id and ejecutiva_id' },
        { status: 400 }
      )
    }

    const { data: executive, error: execError } = await supabase
      .from('executive_staff')
      .select('id, full_name')
      .eq('id', ejecutiva_id)
      .eq('is_active', true)
      .single()

    if (execError || !executive) {
      return NextResponse.json(
        { error: 'Executive not found' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from('transportistas')
      .update({
        assigned_executive_id: ejecutiva_id,
        ejecutivo_nombre: executive.full_name.split(' ')[0],
        ejecutivo_asignado: null,
      })
      .eq('id', transportista_id)
      .select()
      .single()

    if (error) {
      console.error('Error assigning executive:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to assign executive' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Executive ${executive.full_name} assigned successfully`,
      data,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error in assign-executive:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
