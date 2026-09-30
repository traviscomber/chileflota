import { createAdminClient } from '@/lib/supabase/admin'
import { reviewerMatchesAssignment } from '@/lib/document-authorization'

export interface ClearanceActor {
  id: string
  email?: string | null
}

export interface ClearanceAuthorizationResult {
  allowed: boolean
  reason?: string
  transportistaId?: string
}

const REVIEWER_ROLES = new Set(['admin', 'administrador', 'ejecutiva', 'mandante'])

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

export async function canViewOperationalClearance(
  actor: ClearanceActor,
  entityType: 'transportista' | 'conductor',
  entityId: string,
): Promise<ClearanceAuthorizationResult> {
  if (!actor.email) {
    return { allowed: false, reason: 'No se pudo verificar la identidad del usuario' }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,full_name,role,is_active')
    .ilike('email', actor.email)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (profileError || !profile) {
    return { allowed: false, reason: 'Perfil activo no encontrado' }
  }

  if (profile.role === 'super_admin') {
    if (entityType === 'conductor') {
      const { data: conductor } = await admin
        .from('conductores')
        .select('transportista_id')
        .eq('id', entityId)
        .maybeSingle()
      return {
        allowed: Boolean(conductor),
        reason: conductor ? undefined : 'Conductor no encontrado',
        transportistaId: conductor?.transportista_id || undefined,
      }
    }
    return { allowed: true, transportistaId: entityId }
  }

  if (!REVIEWER_ROLES.has(String(profile.role || '').toLowerCase())) {
    return { allowed: false, reason: 'El rol actual no puede consultar clearance operacional' }
  }

  let transportistaId = entityId
  if (entityType === 'conductor') {
    const { data: conductor, error: conductorError } = await admin
      .from('conductores')
      .select('transportista_id')
      .eq('id', entityId)
      .maybeSingle()

    if (conductorError || !conductor?.transportista_id) {
      return { allowed: false, reason: 'Conductor no encontrado o sin transportista asociado' }
    }
    transportistaId = conductor.transportista_id
  }

  const { data: transportista, error: transportistaError } = await admin
    .from('transportistas')
    .select('id,ejecutivo_nombre,assigned_executive_id,ejecutivo_asignado')
    .eq('id', transportistaId)
    .maybeSingle()

  if (transportistaError || !transportista) {
    return { allowed: false, reason: 'Transportista no encontrado' }
  }

  const assignedExecutiveId = transportista.assigned_executive_id || transportista.ejecutivo_asignado
  if (assignedExecutiveId) {
    const { data: assignedExecutive, error: assignedError } = await admin
      .from('executive_staff')
      .select('email,full_name,is_active')
      .eq('id', assignedExecutiveId)
      .maybeSingle()

    if (assignedError || !assignedExecutive || assignedExecutive.is_active === false) {
      return { allowed: false, reason: 'No se pudo validar la ejecutiva asignada' }
    }

    const sameExecutive =
      normalizeEmail(profile.email || actor.email) === normalizeEmail(assignedExecutive.email) ||
      reviewerMatchesAssignment(profile.full_name, assignedExecutive.full_name)

    if (!sameExecutive) {
      return { allowed: false, reason: 'La entidad está asignada a otra ejecutiva' }
    }

    return { allowed: true, transportistaId }
  }

  if (
    transportista.ejecutivo_nombre &&
    !reviewerMatchesAssignment(profile.full_name, transportista.ejecutivo_nombre)
  ) {
    return { allowed: false, reason: 'La entidad está asignada a otra ejecutiva' }
  }

  return { allowed: true, transportistaId }
}
