import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

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

export const CANONICAL_SUPER_ADMIN_EMAIL = 'kcanales@labbe.cl'

export function isCanonicalSuperAdminEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === CANONICAL_SUPER_ADMIN_EMAIL
}

/**
 * Super-admin privileges must be explicit in the persisted role. Membership
 * in the Labbe email domain is never sufficient to elevate a user.
 */
export function isSuperAdmin(_email?: string | null, role?: UserRole | string | null): boolean {
  return role === 'super_admin'
}

// Middleware para verificar autenticacion
export async function verifyAuth(request: NextRequest): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    console.log('[v0] verifyAuth: START - Attempting to verify authentication')

    const userEmail = request.cookies.get('user_email')?.value
    const userRole = request.cookies.get('user_role')?.value
    const userOrgId = request.cookies.get('user_organization_id')?.value

    console.log('[v0] verifyAuth: Cookie check:', {
      hasEmail: !!userEmail,
      hasRole: !!userRole,
      hasOrgId: !!userOrgId,
      email: userEmail,
    })

    if (userEmail && userRole) {
      console.log('[v0] verifyAuth: Found simple login cookies for:', userEmail)

      // The database profile is authoritative for permissions. This makes role
      // changes effective even when a browser still carries an old role cookie.
      const adminClient = createAdminClient()
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id,email,role,is_active')
        .ilike('email', userEmail)
        .limit(1)
        .maybeSingle()

      if (profileError) {
        console.error('[v0] verifyAuth: Profile lookup failed:', profileError.message)
        return { user: null, error: 'No se pudo verificar el rol del usuario' }
      }

      if (profile?.is_active === false) {
        return { user: null, error: 'Usuario desactivado' }
      }

      // Preserve legacy cookie-only users for non-privileged roles, but never
      // grant super_admin from a cookie without a persisted profile.
      if (!profile && userRole === 'super_admin') {
        return { user: null, error: 'Perfil requerido para privilegios administrativos' }
      }

      const effectiveRole = (profile?.role || userRole) as UserRole
      const authUser: AuthUser = {
        id: profile?.id || userEmail,
        email: userEmail,
        role: effectiveRole,
        organization_id: userOrgId,
      }

      console.log('[v0] verifyAuth: SUCCESS - Simple login user authenticated:', {
        id: authUser.id,
        email: authUser.email,
        role: authUser.role,
        is_super_admin: isSuperAdmin(authUser.email, authUser.role),
        role_source: profile ? 'profiles' : 'cookie_fallback',
        org_id: authUser.organization_id,
      })

      return { user: authUser }
    }

    console.log('[v0] verifyAuth: FAIL - No authentication cookies found')
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
