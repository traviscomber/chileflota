export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { CANONICAL_SUPER_ADMIN_EMAIL, isCanonicalSuperAdminEmail, isSuperAdmin, verifyAuth } from '@/lib/auth-middleware'
import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(request: NextRequest) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const adminClient = createAdminClient()
    const { data: users, error } = await adminClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, users: users || [] })
  } catch (error) {
    console.error('[v0] Error fetching users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireSuperAdmin(request)
    if (denied) return denied

    const body = await request.json()
    const { email, full_name, role, phone, is_active = true } = body

    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, full_name, role' },
        { status: 400 }
      )
    }

    // The database also enforces one canonical active super_admin identity.
    if (role === 'super_admin' && !isCanonicalSuperAdminEmail(email)) {
      return NextResponse.json(
        { error: `super_admin is reserved for ${CANONICAL_SUPER_ADMIN_EMAIL}` },
        { status: 403 }
      )
    }

    const adminClient = createAdminClient()
    const tempPassword = Math.random().toString(36).slice(-12)

    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createError || !authUser.user) {
      throw new Error(createError?.message || 'Failed to create auth user')
    }

    const { data: newProfile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        role,
        phone,
        is_active,
      })
      .select()
      .single()

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      throw profileError
    }

    return NextResponse.json({
      success: true,
      user: newProfile,
      message: 'User created successfully. A confirmation email will be sent.',
    })
  } catch (error) {
    console.error('[v0] Error creating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating user' },
      { status: 500 }
    )
  }
}
