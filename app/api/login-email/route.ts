import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionSecret, signEmailSession } from '@/lib/email-session'
import { resolveExecutiveAssignment } from '@/lib/executive-login-resolution'

function maskEmail(email?: string | null) {
  if (!email) return 'unknown'
  const [local, domain] = email.split('@')
  if (!domain) return 'unknown'
  return `${local.slice(0, 2)}***@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    let email = ''

    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const body = await request.json()
      email = body.email
    } else if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData()
      email = formData.get('email') as string
    }

    email = email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[v0] Missing Supabase credentials')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const headers = {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    }

    console.log('[v0] Login attempt for:', maskEmail(email))

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
      { headers, cache: 'no-store' },
    )

    const profiles = await profileResponse.json()
    let user: any = null
    let role = 'user'
    let fullName = ''
    let organizationId = ''

    if (Array.isArray(profiles) && profiles.length > 0) {
      user = profiles[0]
      fullName = user.full_name || ''
      role = user.role || 'admin'
      organizationId = user.organization_id || ''
      console.log('[v0] Found in profiles table:', { email: maskEmail(email), role, fullName })
    }

    // executive_staff is the canonical company assignment for active executives.
    // First prefer an exact email match. When profiles contains a known alias,
    // fall back to one unambiguous active staff row with the same normalized full name.
    const executiveResponse = await fetch(
      `${supabaseUrl}/rest/v1/executive_staff?select=email,full_name,transportista_id,is_active&is_active=eq.true`,
      { headers, cache: 'no-store' },
    )
    const executives = await executiveResponse.json()
    const executive = Array.isArray(executives)
      ? resolveExecutiveAssignment(email, fullName, executives)
      : null

    if (executive) {
      user = user || executive
      fullName = executive.full_name || fullName || email
      role = 'ejecutiva'
      organizationId = executive.transportista_id || organizationId
      console.log('[v0] Resolved executive_staff scope:', {
        email: maskEmail(email),
        role,
        organizationId,
        resolution: executive.email?.toLowerCase() === email ? 'email' : 'profile_alias',
      })
    }

    if (!user) {
      const conductoresResponse = await fetch(
        `${supabaseUrl}/rest/v1/conductores?email=eq.${encodeURIComponent(email)}&select=*`,
        { headers, cache: 'no-store' },
      )
      const conductores = await conductoresResponse.json()

      if (Array.isArray(conductores) && conductores.length > 0) {
        const conductor = conductores[0]
        user = conductor
        fullName = `${conductor.nombres} ${conductor.apellido_paterno} ${conductor.apellido_materno || ''}`.trim()
        role = 'driver'
        organizationId = conductor.transportista_id || ''
      }
    }

    if (!user) {
      console.error('[v0] User not found:', maskEmail(email))
      return NextResponse.json({ error: 'Usuario no encontrado. Verifica tu email.' }, { status: 401 })
    }

    if (!organizationId && role === 'prevencionista' && email.endsWith('@labbe.cl')) {
      const staff = Array.isArray(executives) ? executives : []
      const organizationIds = Array.from(new Set(
        staff.map((item: { transportista_id?: string }) => item.transportista_id).filter(Boolean),
      ))

      if (organizationIds.length === 1) organizationId = String(organizationIds[0])
    }

    if (!organizationId && ['ejecutiva', 'prevencionista'].includes(role)) {
      return NextResponse.json(
        { error: 'La cuenta no tiene una empresa asignada. Contacta al administrador.' },
        { status: 403 },
      )
    }

    const sessionSecret = getEmailSessionSecret()
    if (!sessionSecret) {
      return NextResponse.json({ error: 'Server session configuration error' }, { status: 500 })
    }

    const appSession = await signEmailSession({
      email,
      fullName: fullName || email,
      role,
      organizationId: organizationId || '',
    }, sessionSecret)

    const response = NextResponse.json({
      success: true,
      user: {
        email,
        full_name: fullName,
        role,
        organization_id: organizationId,
      },
    })

    response.cookies.set({
      name: 'app_session',
      value: appSession,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    })

    for (const [name, value] of [
      ['user_email', email],
      ['user_name', fullName || email],
      ['user_role', role],
      ['user_organization_id', organizationId || ''],
    ] as const) {
      response.cookies.set({
        name,
        value,
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    console.log('[v0] Login successful:', {
      email: maskEmail(email),
      role,
      organizationId,
    })
    return response
  } catch (error: any) {
    console.error('[v0] Login error:', error)
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 })
  }
}
