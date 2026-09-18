import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { signSubcontractorSession } from '@/lib/subcontractor-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rut = body.rut?.trim()
    const password = body.password?.trim()

    if (!rut || !password) {
      return NextResponse.json(
        { error: 'RUT y contraseña son requeridos' },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()

    const { data: authRecord, error: findError } = await supabase
      .from('transportista_auth')
      .select('id, rut, password_hash, is_active, transportista_id')
      .eq('rut', rut)
      .maybeSingle()

    if (findError) {
      console.error('[subcontractor-login] Database lookup failed', findError)
      return NextResponse.json(
        { error: 'Error en la búsqueda' },
        { status: 500 },
      )
    }

    if (!authRecord) {
      return NextResponse.json(
        { error: 'RUT o contraseña incorrectos' },
        { status: 401 },
      )
    }

    if (!authRecord.is_active) {
      return NextResponse.json(
        { error: 'Esta cuenta está inactiva' },
        { status: 403 },
      )
    }

    const passwordMatches = await bcrypt.compare(password, authRecord.password_hash)
    if (!passwordMatches) {
      return NextResponse.json(
        { error: 'RUT o contraseña incorrectos' },
        { status: 401 },
      )
    }

    const { data: transportista, error: transpError } = await supabase
      .from('transportistas')
      .select('id, rut, razon_social, nombre_fantasia, is_active')
      .eq('id', authRecord.transportista_id)
      .maybeSingle()

    if (transpError || !transportista) {
      console.error('[subcontractor-login] Canonical transportista mapping unavailable', transpError)
      return NextResponse.json(
        { error: 'Error al cargar datos de la empresa' },
        { status: 500 },
      )
    }

    if (transportista.is_active === false) {
      return NextResponse.json(
        { error: 'Esta empresa está inactiva' },
        { status: 403 },
      )
    }

    let token: string
    try {
      token = signSubcontractorSession({
        // transportista_auth is the credential authority. The active mapping to
        // transportista_id is revalidated on every authenticated request.
        rut: authRecord.rut,
        transportistaId: transportista.id,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'SUBCONTRACTOR_JWT_SECRET_NOT_CONFIGURED') {
        console.error('[subcontractor-login] JWT secret is not safely configured')
        return NextResponse.json(
          { error: 'Servicio de autenticación temporalmente no disponible' },
          { status: 503 },
        )
      }
      throw error
    }

    // Preserve the existing successful-login telemetry only after the session can
    // actually be issued. A configuration failure must not mutate last_login.
    await supabase
      .from('transportista_auth')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authRecord.id)

    const response = NextResponse.json({
      success: true,
      message: 'Login exitoso',
      transportista: {
        id: transportista.id,
        rut: transportista.rut,
        nombre: transportista.razon_social || transportista.nombre_fantasia,
      },
    })

    response.cookies.set({
      name: 'transportista_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[subcontractor-login] Login endpoint failed', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Error al procesar el login' },
      { status: 500 },
    )
  }
}
