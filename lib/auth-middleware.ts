import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { getEmailSessionSecret, verifyEmailSession } from "@/lib/email-session"
import { resolveExecutiveAssignment } from "@/lib/executive-login-resolution"

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'administrador'
  | 'ejecutiva'
  | 'dispatcher'
  | 'despachador'
  | 'driver'
  | 'conductor'
  | 'mandante'
  | 'transportista'
  | 'prevencionista'

interface AuthUser {
  id: string
  email: string
  role: UserRole
  organization_id?: string
}

/**
 * Super-admin privileges must be explicit in the persisted role. Membership
 * in the Labbe email domain is never sufficient to elevate a user.
 */
export function isSuperAdmin(_email?: string | null, role?: UserRole | string | null): boolean {
  return role === 'super_admin'
}

const SIGNED_SESSION_REQUIRED_ROLES = new Set<UserRole>([
  'super_admin',
  'admin',
  'administrador',
  'ejecutiva',
  'prevencionista',
])

export function requiresSignedSession(role: UserRole | string | null | undefined): boolean {
  return Boolean(role && SIGNED_SESSION_REQUIRED_ROLES.has(role as UserRole))
}

async function resolvePersistedProfile(email: string) {
  const adminClient = createAdminClient()
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('id,email,full_name,role,is_active')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  return { profile, error }
}

async function resolveCurrentExecutiveOrganization(email: string, fullName: string): Promise<string | null> {
  const adminClient = createAdminClient()
  const { data: staff, error } = await adminClient
    .from('executive_staff')
    .select('email,full_name,transportista_id,is_active')
    .eq('is_active', true)

  if (error) {
    console.error('[v0] verifyAuth: Executive assignment lookup failed:', error.message)
    return null
  }

  const executive = resolveExecutiveAssignment(email, fullName, staff ?? [])
  return executive?.transportista_id ? String(executive.transportista_id) : null
}

// Middleware para verificar autenticacion
export async function verifyAuth(request: NextRequest): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const signedSession = await verifyEmailSession(
      request.cookies.get('app_session')?.value,
      getEmailSessionSecret(),
    )

    if (signedSession) {
      const { profile, error: profileError } = await resolvePersistedProfile(signedSession.email)

      if (profileError) {
        console.error('[v0] verifyAuth: Signed-session profile lookup failed:', profileError.message)
        return { user: null, error: 'No se pudo verificar el rol del usuario' }
      }

      if (profile?.is_active === false) {
        return { user: null, error: 'Usuario desactivado' }
      }

      if (requiresSignedSession(signedSession.role) && !profile) {
        return { user: null, error: 'Perfil requerido para acceso privilegiado' }
      }

      const effectiveRole = (profile?.role || signedSession.role) as UserRole
      let effectiveOrganizationId = signedSession.organizationId || undefined

      if (effectiveRole === 'ejecutiva') {
        const currentOrganizationId = await resolveCurrentExecutiveOrganization(
          signedSession.email,
          profile?.full_name || signedSession.fullName || '',
        )
        if (!currentOrganizationId) {
          return { user: null, error: 'La ejecutiva no tiene una empresa activa asignada' }
        }
        effectiveOrganizationId = currentOrganizationId
      }

      const authUser: AuthUser = {
        id: profile?.id || signedSession.email,
        email: signedSession.email,
        role: effectiveRole,
        organization_id: effectiveOrganizationId,
      }

      return { user: authUser }
    }

    const userEmail = request.cookies.get('user_email')?.value
    const userRole = request.cookies.get('user_role')?.value
    const userOrgId = request.cookies.get('user_organization_id')?.value

    if (userEmail && userRole) {
      const { profile, error: profileError } = await resolvePersistedProfile(userEmail)

      if (profileError) {
        console.error('[v0] verifyAuth: Legacy profile lookup failed:', profileError.message)
        return { user: null, error: 'No se pudo verificar el rol del usuario' }
      }

      if (profile?.is_active === false) {
        return { user: null, error: 'Usuario desactivado' }
      }

      const persistedRole = profile?.role as UserRole | undefined
      if (requiresSignedSession(userRole) || requiresSignedSession(persistedRole)) {
        return { user: null, error: 'Sesión firmada requerida' }
      }

      const effectiveRole = (persistedRole || userRole) as UserRole
      const authUser: AuthUser = {
        id: profile?.id || userEmail,
        email: userEmail,
        role: effectiveRole,
        organization_id: userOrgId,
      }

      return { user: authUser }
    }

    return { user: null, error: 'Unauthorized' }
  } catch (error) {
    console.error('[v0] verifyAuth EXCEPTION:', error instanceof Error ? error.message : String(error))
    return { user: null, error: 'Authentication failed' }
  }
}

export function checkRolePermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function checkOrganizationAccess(userOrgId: string | undefined, targetOrgId: string | undefined): boolean {
  if (!userOrgId) return true
  return userOrgId === targetOrgId
}

export async function protectedEndpoint(
  request: NextRequest,
  handler: (user: AuthUser, request: NextRequest) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
): Promise<NextResponse> {
  try {
    const { user, error: authError } = await verifyAuth(request)

    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', success: false },
        { status: 401 }
      )
    }

    if (allowedRoles && !checkRolePermission(user.role, allowedRoles)) {
      return NextResponse.json(
        { error: `Forbidden: ${user.role} role not allowed`, success: false },
        { status: 403 }
      )
    }

    return await handler(user, request)
  } catch (error) {
    console.error('Protected endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}

export async function logAudit(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  details?: Record<string, any>
) {
  try {
    const supabase = await createClient()

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource,
      resource_id: resourceId,
      details: details || {},
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Audit logging error:', error)
  }
}

export function successResponse(data: any, message?: string, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      message: message || 'Operation successful'
    },
    { status }
  )
}

export function errorResponse(error: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error
    },
    { status }
  )
}
