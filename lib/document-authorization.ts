import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin, type UserRole as AuthUserRole } from '@/lib/auth-middleware'

export type CanChangeDocumentStatusResult = {
  allowed: boolean
  reason?: string
  coverageReview?: boolean
  assignedExecutiveId?: string | null
  assignedExecutiveName?: string | null
}

const REVIEWER_ROLES = new Set(['admin', 'administrador', 'ejecutiva', 'mandante'])

function normalizePersonName(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

/**
 * Transportista assignments may contain a short executive name (for example
 * "Olga", "Daniela" or "Cecilia"). Profiles store the person's full name.
 * Match on the first normalized token so accents/case do not create false denies.
 */
export function reviewerMatchesAssignment(fullName?: string | null, assignedName?: string | null): boolean {
  const reviewer = normalizePersonName(fullName)
  const assigned = normalizePersonName(assignedName)
  if (!assigned) return true
  if (!reviewer) return false
  return reviewer === assigned || reviewer.startsWith(`${assigned} `)
}

/**
 * Check if a user can change document status.
 *
 * Subcontractor documents are payment-critical. Their mutation boundary is
 * deliberately stricter than read access:
 * - only an explicitly stored `super_admin` profile can bypass assignment;
 * - normal Labbe reviewers may mutate only transportistas assigned to them;
 * - canonical assignment IDs take precedence over display names;
 * - a @labbe.cl email by itself is NOT an approval bypass.
 *
 * Conductor-document behaviour is preserved for compatibility.
 */
export async function canChangeDocumentStatus(
  userId: string,
  documentId: string,
  userRole: AuthUserRole,
  userCompanyId?: string,
  userEmail?: string,
  documentType: 'conductor' | 'subcontractor' = 'conductor'
): Promise<CanChangeDocumentStatusResult> {
  try {
    const adminClient = createAdminClient()

    if (documentType === 'subcontractor') {
      if (!userEmail) {
        return { allowed: false, reason: 'No se pudo verificar la identidad del revisor' }
      }

      const { data: actorProfile, error: actorError } = await adminClient
        .from('profiles')
        .select('id,email,full_name,role,is_active')
        .ilike('email', userEmail)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (actorError || !actorProfile) {
        return { allowed: false, reason: 'Perfil activo del revisor no encontrado' }
      }

      // Only an explicit database role is privileged. Domain membership is not
      // sufficient for a payment-relevant document mutation.
      if (actorProfile.role === 'super_admin') {
        return { allowed: true }
      }

      if (!REVIEWER_ROLES.has(String(actorProfile.role || '').toLowerCase())) {
        return {
          allowed: false,
          reason: `Tu rol (${actorProfile.role || 'sin rol'}) no puede cambiar estados documentales`,
        }
      }

      const { data: document, error: documentError } = await adminClient
        .from('subcontractor_documents')
        .select('id,subcontractor_id')
        .eq('id', documentId)
        .single()

      if (documentError || !document?.subcontractor_id) {
        return { allowed: false, reason: 'Documento no encontrado o sin transportista asociado' }
      }

      const { data: transportista, error: transportistaError } = await adminClient
        .from('transportistas')
        .select('id,ejecutivo_nombre,assigned_executive_id,ejecutivo_asignado')
        .eq('id', document.subcontractor_id)
        .single()

      if (transportistaError || !transportista) {
        return { allowed: false, reason: 'No se pudo verificar la asignación del transportista' }
      }

      const assignedExecutiveId = transportista.assigned_executive_id || transportista.ejecutivo_asignado

      // Canonical ID assignment wins over the optional display-name field.
      // This closes the case where ejecutivo_nombre is null but the transportista
      // is still assigned to a specific executive_staff row.
      if (assignedExecutiveId) {
        const { data: assignedExecutive, error: assignedError } = await adminClient
          .from('executive_staff')
          .select('id,email,full_name,is_active')
          .eq('id', assignedExecutiveId)
          .maybeSingle()

        if (assignedError || !assignedExecutive || assignedExecutive.is_active === false) {
          return { allowed: false, reason: 'No se pudo validar la ejecutiva asignada al transportista' }
        }

        const actorEmail = normalizeEmail(actorProfile.email || userEmail)
        const assignedEmail = normalizeEmail(assignedExecutive.email)
        const sameExecutive =
          (actorEmail && assignedEmail && actorEmail === assignedEmail) ||
          reviewerMatchesAssignment(actorProfile.full_name, assignedExecutive.full_name)

        if (!sameExecutive) {
          if (actorProfile.role === 'ejecutiva') {
            return {
              allowed: true,
              coverageReview: true,
              assignedExecutiveId: assignedExecutive.id,
              assignedExecutiveName: assignedExecutive.full_name || assignedExecutive.email || null,
              reason: 'Cobertura temporal de otra cartera',
            }
          }

          return {
            allowed: false,
            reason: `Documento asignado a ${assignedExecutive.full_name || assignedExecutive.email}; solo una ejecutiva activa puede revisarlo en modo cobertura`,
          }
        }

        return {
          allowed: true,
          coverageReview: false,
          assignedExecutiveId: assignedExecutive.id,
          assignedExecutiveName: assignedExecutive.full_name || assignedExecutive.email || null,
        }
      }

      // Legacy fallback for rows that genuinely have only the short display name.
      if (
        transportista.ejecutivo_nombre &&
        !reviewerMatchesAssignment(actorProfile.full_name, transportista.ejecutivo_nombre)
      ) {
        if (actorProfile.role === 'ejecutiva') {
          return {
            allowed: true,
            coverageReview: true,
            assignedExecutiveName: transportista.ejecutivo_nombre,
            reason: 'Cobertura temporal de otra cartera',
          }
        }

        return {
          allowed: false,
          reason: `Documento asignado a ${transportista.ejecutivo_nombre}; solo una ejecutiva activa puede revisarlo en modo cobertura`,
        }
      }

      return { allowed: true, coverageReview: false, assignedExecutiveName: transportista.ejecutivo_nombre || null }
    }

    if (isSuperAdmin(userEmail, userRole)) {
      return { allowed: true }
    }

    const allowedRoles = ['admin', 'ejecutiva']
    if (!allowedRoles.includes(userRole as string)) {
      return {
        allowed: false,
        reason: `Solo administradores y ejecutivas pueden cambiar el estado de documentos. Tu rol es: ${userRole}`,
      }
    }

    const { data: document, error: docError } = await adminClient
      .from('uploaded_documents')
      .select('conductor_id,transportista_id')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return { allowed: false, reason: 'Documento no encontrado' }
    }

    if (userRole === 'ejecutiva') {
      if (!userEmail) {
        return { allowed: false, reason: 'No se pudo verificar la identidad de la ejecutiva' }
      }

      const { data: actorProfile, error: actorError } = await adminClient
        .from('profiles')
        .select('email,full_name,role,is_active')
        .ilike('email', userEmail)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (actorError || !actorProfile || actorProfile.role !== 'ejecutiva') {
        return { allowed: false, reason: 'Perfil activo de ejecutiva no encontrado' }
      }

      let companyId = (document as any).transportista_id as string | null
      let providerRut: string | null = null

      if (!companyId && (document as any).conductor_id) {
        const { data: conductor } = await adminClient
          .from('conductores')
          .select('transportista_id,rut_proveedor')
          .eq('id', (document as any).conductor_id)
          .maybeSingle()

        companyId = conductor?.transportista_id || null
        providerRut = conductor?.rut_proveedor || null
      }

      let transportista: any = null
      if (companyId) {
        const { data } = await adminClient
          .from('transportistas')
          .select('id,rut,assigned_executive_id,ejecutivo_asignado,ejecutivo_nombre,is_active')
          .eq('id', companyId)
          .maybeSingle()
        transportista = data
      } else if (providerRut) {
        const { data } = await adminClient
          .from('transportistas')
          .select('id,rut,assigned_executive_id,ejecutivo_asignado,ejecutivo_nombre,is_active')
          .eq('rut', providerRut)
          .maybeSingle()
        transportista = data
      }

      if (!transportista || transportista.is_active === false) {
        return { allowed: false, reason: 'No se pudo resolver una empresa activa para el documento del conductor' }
      }

      const assignedExecutiveId = transportista.assigned_executive_id || transportista.ejecutivo_asignado
      if (!assignedExecutiveId) {
        return { allowed: false, reason: 'La empresa no tiene ejecutiva asignada' }
      }

      const { data: assignedExecutive, error: assignedError } = await adminClient
        .from('executive_staff')
        .select('id,email,full_name,is_active')
        .eq('id', assignedExecutiveId)
        .maybeSingle()

      if (assignedError || !assignedExecutive || assignedExecutive.is_active === false) {
        return { allowed: false, reason: 'No se pudo validar la ejecutiva asignada a la empresa' }
      }

      const actorEmail = normalizeEmail(actorProfile.email || userEmail)
      const assignedEmail = normalizeEmail(assignedExecutive.email)
      const sameExecutive =
        (actorEmail && assignedEmail && actorEmail === assignedEmail) ||
        reviewerMatchesAssignment(actorProfile.full_name, assignedExecutive.full_name)

      return {
        allowed: true,
        coverageReview: !sameExecutive,
        assignedExecutiveId: assignedExecutive.id,
        assignedExecutiveName: assignedExecutive.full_name || assignedExecutive.email || null,
        reason: sameExecutive ? undefined : 'Cobertura temporal de otra cartera',
      }
    }

    const { data: userProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    if (profileError && !userCompanyId) {
      return { allowed: false, reason: 'Perfil de usuario no encontrado' }
    }

    const userTransportista = userProfile?.organization_id || userCompanyId
    const documentTransportista = (document as { transportista_id?: string | null }).transportista_id

    if (!userTransportista) {
      return { allowed: false, reason: 'No se encontró la empresa del usuario' }
    }

    if (documentTransportista && userTransportista !== documentTransportista) {
      return { allowed: false, reason: 'No tienes permiso para cambiar documentos de otra empresa' }
    }

    return { allowed: true }
  } catch (error) {
    console.error('[document-authorization] Authorization check failed:', error)
    return {
      allowed: false,
      reason: 'Error al verificar permisos: ' + (error instanceof Error ? error.message : 'Unknown error'),
    }
  }
}

export async function getCompanyExecutives(
  companyId: string
): Promise<Array<{ id: string; email: string; role: AuthUserRole }>> {
  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, email, role')
      .eq('organization_id', companyId)
      .eq('role', 'admin')

    if (error || !data) return []
    return data.map(profile => ({ id: profile.id, email: profile.email, role: profile.role as AuthUserRole }))
  } catch (error) {
    console.error('[document-authorization] getCompanyExecutives error:', error)
    return []
  }
}

export function isExecutive(userRole: AuthUserRole): boolean {
  return userRole === 'admin'
}
