import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'transportista-secret-key'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawRut = body.rut?.trim()
    const password = body.password?.trim()

    const normalizeRut = (value?: string) => {
      if (!value) return ''
      const compact = value.replace(/\./g, '').replace(/\s+/g, '').toUpperCase()
      if (compact.includes('-')) return compact
      if (compact.length < 2) return compact
      return `${compact.slice(0, -1)}-${compact.slice(-1)}`
    }

    const rut = normalizeRut(rawRut)

    console.log('[v0] Login attempt - RUT:', rut, 'Password length:', password?.length)

    if (!rut || !password) {
      return NextResponse.json(
        { error: 'RUT y contraseña son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Search using canonical Chilean RUT formatting while preserving stored credentials.
    console.log('[v0] Searching for RUT:', rut)
    const { data: authRecord, error: findError } = await supabase
      .from('transportista_auth')
      .select('id, rut, password_hash, is_active, transportista_id')
      .ilike('rut', rut)
      .maybeSingle() // Returns null instead of error if not found

    if (findError) {
      console.error('[v0] Database error:', findError)
      return NextResponse.json(
        { error: 'Error en la búsqueda' },
        { status: 500 }
      )
    }

    if (!authRecord) {
      console.warn('[v0] RUT not found:', rut)
      return NextResponse.json(
        { error: 'RUT o contraseña incorrectos' },
        { status: 401 }
      )
    }

    console.log('[v0] Found auth record for RUT:', authRecord.rut)
    console.log('[v0] Account is_active:', authRecord.is_active)
    console.log('[v0] Password hash length:', authRecord.password_hash?.length)

    // Check if account is active
    if (!authRecord.is_active) {
      return NextResponse.json(
        { error: 'Esta cuenta está inactiva' },
        { status: 403 }
      )
    }

    // Verify password
    console.log('[v0] Comparing password with hash...')
    const passwordMatches = await bcrypt.compare(password, authRecord.password_hash)
    console.log('[v0] Password match result:', passwordMatches)

    if (!passwordMatches) {
      console.warn('[v0] Password mismatch for RUT:', rut)
      return NextResponse.json(
        { error: 'RUT o contraseña incorrectos' },
        { status: 401 }
      )
    }

    // Get transportista details
    const { data: transportista, error: transpError } = await supabase
      .from('transportistas')
      .select('id, rut, razon_social, nombre_fantasia')
      .eq('id', authRecord.transportista_id)
      .maybeSingle()

    if (transpError) {
      console.error('[v0] Error fetching transportista:', transpError)
      return NextResponse.json(
        { error: 'Error al cargar datos de la empresa' },
        { status: 500 }
      )
    }

    // Create JWT token
    const token = jwt.sign(
      {
        rut: authRecord.rut,
        transportista_id: transportista?.id,
        tipo: 'subcontratista',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Update last_login
    await supabase
      .from('transportista_auth')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authRecord.id)
      .then(() => console.log('[v0] Updated last_login'))

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Login exitoso',
      transportista: {
        id: transportista?.id,
        rut: transportista?.rut,
        nombre: transportista?.razon_social || transportista?.nombre_fantasia,
      },
    })

    // Set HTTP-only cookie
    response.cookies.set({
      name: 'transportista_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    })

    console.log('[v0] Login successful for:', rut)
    return response

  } catch (error) {
    console.error('[v0] Login endpoint error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Error al procesar el login', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
