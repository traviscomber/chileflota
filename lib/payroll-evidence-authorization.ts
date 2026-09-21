import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin, type UserRole } from '@/lib/auth-middleware'
import { reviewerMatchesAssignment } from '@/lib/document-authorization'

export interface PayrollEvidenceActor {
  id: string
  email: string
  role: UserRole
  organization_id?: string
}

export interface PayrollEvidenceAuthorizationResult {
  allowed: boolean
  reason?: string
}

const INTERNAL_READ_ROLES = new Set<UserRole>([
  'admin',
  'administrador',
  'ejecutiva',
  'mandante',
])

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

export async function canReadPayrollEvidence(
  actor: PayrollEvidenceActor,
  transportistaId: string,
): Promise<PayrollEvidenceAuthorizationResult> {
  if (isSuperAdmin(actor.email, actor.role)) return { allowed: true }

  // `verifyAuth` currently carries organization_id from a cookie. Do not use
  // that client-carried value as a payroll authorization boundary. Transportista
  // self-service remains disabled until organization identity is resolved from a
  // canonical server-side relation (for example transportista_auth).
  if (actor.role === 'transportista') {
    return {
      allowed: false,
      reason: 'Payroll self-service requiere identidad organizacional server-side',
    }
  }

  if (!INTERNAL_READ_ROLES.has(actor.role)) {
    return { allowed: false, reason: `Rol ${actor.role} sin acceso a evidencia de payroll` }
  }

  const adminClient = createAdminClient()
  const [{ data: actorProfile, error: actorError }, { data: transportista, error: transportistaError }] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id,email,full_name,role,is_active')
      .ilike('email', actor.email)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('transportistas')
      .select('id,ejecutivo_nombre,assigned_executive_id,ejecutivo_asignado')
      .eq('id', transportistaId)
      .maybeSingle(),
  ])

  if (actorError || !actorProfile) {
    return { allowed: false, reason: 'Perfil activo del usuario no encontrado' }
  }

  if (transportistaError || !transportista) {
    return { allowed: false, reason: 'Transportista no encontrado' }
  }

  const assignedExecutiveId = transportista.assigned_executive_id || transportista.ejecutivo_asignado
  if (assignedExecutiveId) {
    const { data: assignedExecutive, error: assignedError } = await adminClient
      .from('executive_staff')
      .select('id,email,full_name,is_active')
      .eq('id', assignedExecutiveId)
      .maybeSingle()

    if (assignedError || !assignedExecutive || assignedExecutive.is_active === false) {
      return { allowed: false, reason: 'No se pudo verificar la ejecutiva asignada' }
    }

    const actorEmail = normalizeEmail(actorProfile.email || actor.email)
    const assignedEmail = normalizeEmail(assignedExecutive.email)
    const matchesAssignment =
      Boolean(actorEmail && assignedEmail && actorEmail === assignedEmail) ||
      reviewerMatchesAssignment(actorProfile.full_name, assignedExecutive.full_name)

    return matchesAssignment
      ? { allowed: true }
      : { allowed: false, reason: 'Transportista asignado a otra ejecutiva' }
  }

  if (transportista.ejecutivo_nombre) {
    return reviewerMatchesAssignment(actorProfile.full_name, transportista.ejecutivo_nombre)
      ? { allowed: true }
      : { allowed: false, reason: 'Transportista asignado a otra ejecutiva' }
  }

  // Fail closed when there is no canonical assignment for an internal user.
  return { allowed: false, reason: 'Transportista sin asignacion verificable' }
}
