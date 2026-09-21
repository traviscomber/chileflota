export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { CANONICAL_SUPER_ADMIN_EMAIL, isCanonicalSuperAdminEmail, isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
  }
}

async function requireSuperAdmin(request: NextRequest): Promise<NextResponse | null> {
  const { user, error: authError } = await verifyAuth(request)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSuperAdmin(user.email, user.role)) {
    return NextResponse.json({ error: 'Forbidden: super_admin required' }, { status: 403 })
  }
  return null
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const adminClient = createAdminClient()
    const { data: userData, error } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, user: userData })
  } catch (error) {
    console.error('[v0] Error fetching user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching user' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const body = await request.json()
    const { full_name, role, phone, is_active } = body
    const adminClient = createAdminClient()

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id,email,role,is_active')
      .eq('id', params.id)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const canonicalEmail = String(target.email || '').trim().toLowerCase()
    if (role === 'super_admin' && !isCanonicalSuperAdminEmail(canonicalEmail)) {
      return NextResponse.json(
        { error: `super_admin is reserved for ${CANONICAL_SUPER_ADMIN_EMAIL}` },
        { status: 403 }
      )
    }

    if (isCanonicalSuperAdminEmail(canonicalEmail)) {
      if (role !== undefined && role !== 'super_admin') {
        return NextResponse.json(
          { error: 'The canonical super-admin account cannot be demoted' },
          { status: 403 }
        )
      }
      if (is_active === false) {
        return NextResponse.json(
          { error: 'The canonical super-admin account cannot be deactivated' },
          { status: 403 }
        )
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (full_name !== undefined) updateData.full_name = full_name
    if (role !== undefined) updateData.role = role
    if (phone !== undefined) updateData.phone = phone
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: updatedUser, error } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('[v0] Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error updating user' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const adminClient = createAdminClient()
    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id,email')
      .eq('id', params.id)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (isCanonicalSuperAdminEmail(target.email)) {
      return NextResponse.json(
        { error: 'The canonical super-admin account cannot be deleted' },
        { status: 403 }
      )
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', params.id)

    if (profileError) throw profileError
    await adminClient.auth.admin.deleteUser(params.id)

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    console.error('[v0] Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error deleting user' },
      { status: 500 }
    )
  }
}
