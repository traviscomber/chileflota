import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth, checkRolePermission } from '@/lib/auth-middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveExecutiveCompanyIds } from '@/lib/executive-scope'

export const dynamic = 'force-dynamic'

const ALERT_ACTION_ROLES = [
  'super_admin',
  'admin',
  'administrador',
  'ejecutiva',
  'mandante',
  'prevencionista',
] as const

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkRolePermission(user.role, [...ALERT_ACTION_ROLES])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const normalizedId = params.id?.trim()
    if (!normalizedId) {
      return NextResponse.json({ error: 'Missing alert id' }, { status: 400 })
    }

    const body = await request.json()
    const action = body?.action
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) : ''

    if (!['resolve', 'request_info'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 })
    }

    const isLogAlert = normalizedId.startsWith('log_')
    const alertId = isLogAlert ? normalizedId.slice(4) : normalizedId
    if (!alertId) {
      return NextResponse.json({ error: 'Invalid alert id' }, { status: 400 })
    }

    const table = isLogAlert ? 'alerts_log' : 'alerts'
    const supabase = createAdminClient()

    const { data: existingAlert, error: fetchError } = await supabase
      .from(table)
      .select(isLogAlert ? 'id,status,is_resolved,transportista_id' : 'id,status,is_resolved,metadata')
      .eq('id', alertId)
      .maybeSingle()

    if (fetchError) {
      console.error('[alerts/action] Alert lookup failed:', fetchError.message)
      return NextResponse.json({ error: 'Failed to read alert' }, { status: 500 })
    }

    if (!existingAlert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const existingAlertRow = existingAlert as any

    if (user.role === 'ejecutiva') {
      const executiveCompanyIds = await resolveExecutiveCompanyIds(supabase, user.email, user.id)
      if (executiveCompanyIds === null) {
        return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
      }

      const transportistaId = isLogAlert
        ? existingAlertRow.transportista_id
        : existingAlertRow.metadata?.transportista_id || existingAlertRow.metadata?.subcontractor_id

      if (!transportistaId || !executiveCompanyIds.includes(transportistaId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const resolved = action === 'resolve'
    const updatePayload = {
      status: resolved ? 'resuelto' : 'pendiente',
      action_notes: notes,
      actioned_by: user.email,
      actioned_at: new Date().toISOString(),
      is_resolved: resolved,
      is_read: true,
    }

    const { data: updatedAlert, error: updateError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', alertId)
      .select()
      .single()

    if (updateError) {
      console.error('[alerts/action] Alert update failed:', updateError.message)
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
      documentStateChanged: false,
      message: resolved ? 'Alerta resuelta' : 'Seguimiento registrado',
    })
  } catch (error) {
    console.error('[alerts/action] Error:', error)
    return NextResponse.json({ error: 'Failed to process alert action' }, { status: 500 })
  }
}
