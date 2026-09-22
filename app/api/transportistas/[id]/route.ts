import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('transportistas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let ejecutivo_nombre = data.ejecutivo_nombre || 'Sin asignar'
    if (data.assigned_executive_id) {
      const { data: exec } = await supabase
        .from('executive_staff')
        .select('full_name')
        .eq('id', data.assigned_executive_id)
        .single()
      if (exec) ejecutivo_nombre = exec.full_name
    }

    return NextResponse.json({ success: true, transportista: { ...data, ejecutivo_nombre } })
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching transportista' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Assignment ownership is security-critical because it gates document approvals.
    // Only the explicitly persisted super_admin may change or clear it.
    if (body.assigned_executive_id !== undefined && !isSuperAdmin(user.email, user.role)) {
      return NextResponse.json(
        { error: 'Only super_admin can change executive assignments' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.razon_social !== undefined) updateData.razon_social = body.razon_social
    if (body.nombre !== undefined) updateData.nombre = body.nombre || null
    if (body.rut !== undefined) updateData.rut = body.rut
    if (body.region !== undefined) updateData.region = body.region || null
    if (body.comuna !== undefined) updateData.comuna = body.comuna || null
    if (body.telefono !== undefined) updateData.telefono = body.telefono || null
    if (body.email !== undefined) updateData.email = body.email || null
    if (body.nombre_contacto !== undefined) updateData.representante_legal = body.nombre_contacto || null
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.assigned_executive_id !== undefined) {
      const nextExecutiveId = body.assigned_executive_id || null
      updateData.assigned_executive_id = nextExecutiveId
      updateData.ejecutivo_asignado = null

      if (nextExecutiveId) {
        const { data: executive, error: executiveError } = await supabase
          .from('executive_staff')
          .select('id, full_name')
          .eq('id', nextExecutiveId)
          .eq('is_active', true)
          .single()

        if (executiveError || !executive) {
          return NextResponse.json({ error: 'Executive not found' }, { status: 404 })
        }

        updateData.ejecutivo_nombre = executive.full_name.split(' ')[0]
      } else {
        updateData.ejecutivo_nombre = null
      }
    }

    if (!updateData.razon_social) {
      return NextResponse.json({ error: 'razon_social is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('transportistas')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      console.error('[v0] PATCH transportistas - Supabase Error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw new Error(`Database error: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      transportista: data?.[0],
      message: 'Subcontratista actualizado exitosamente',
    }, { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[v0] PATCH transportistas - Exception:', errorMsg, error)
    return NextResponse.json({ error: errorMsg, success: false }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperAdmin(user.email, user.role)) {
      return NextResponse.json({ error: 'Only super_admin can delete transportistas' }, { status: 403 })
    }

    const { id } = params
    const supabase = createAdminClient()

    const { data: conductores } = await supabase
      .from('conductores')
      .select('id', { count: 'exact' })
      .eq('rut_proveedor', id)

    if (conductores && conductores.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un subcontratista que tiene conductores asociados' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('transportistas')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Subcontratista eliminado exitosamente',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error deleting transportista' },
      { status: 500 }
    )
  }
}
