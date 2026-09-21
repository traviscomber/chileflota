import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function normalizeRut(value: string) {
  return value.replace(/[^0-9kK]/g, '').toUpperCase()
}

function formatRut(value: string) {
  const normalized = normalizeRut(value)
  if (normalized.length < 2) return normalized
  return `${normalized.slice(0, -1)}-${normalized.slice(-1)}`
}

export async function POST(request: Request) {
  try {
    const { rut, password } = await request.json()

    if (typeof rut !== 'string' || typeof password !== 'string' || !rut.trim() || !password) {
      return NextResponse.json({ error: 'RUT y contraseña son requeridos' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[auth/company] Missing server Supabase configuration')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const normalizedRut = normalizeRut(rut)
    const formattedRut = formatRut(rut)

    const { data: authRows, error: authError } = await supabase
      .from('transportista_auth')
      .select('transportista_id, rut, password_hash, is_active')
      .or(`rut.eq.${normalizedRut},rut.eq.${formattedRut}`)
      .limit(1)

    const authRecord = authRows?.[0]

    if (authError) {
      console.error('[auth/company] Credential lookup failed:', authError.message)
      return NextResponse.json({ error: 'Error al validar credenciales' }, { status: 500 })
    }

    if (!authRecord || !authRecord.is_active || !authRecord.password_hash) {
      return NextResponse.json({ error: 'RUT o contraseña incorrectos' }, { status: 401 })
    }

    const validPassword = await bcrypt.compare(password, authRecord.password_hash)
    if (!validPassword) {
      return NextResponse.json({ error: 'RUT o contraseña incorrectos' }, { status: 401 })
    }

    const { data: transportista, error: transportistaError } = await supabase
      .from('transportistas')
      .select('id, rut, razon_social, nombre_fantasia, email, correo, is_active')
      .eq('id', authRecord.transportista_id)
      .single()

    if (transportistaError || !transportista || !transportista.is_active) {
      console.error('[auth/company] Transportista lookup failed or inactive:', transportistaError?.message)
      return NextResponse.json({ error: 'Empresa no disponible' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const secure = process.env.NODE_ENV === 'production'
    const maxAge = 60 * 60 * 12
    const email = transportista.email || transportista.correo || ''

    const cookieOptions = {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      maxAge,
      path: '/',
    }

    cookieStore.set('company_id', transportista.id, cookieOptions)
    cookieStore.set('transportista_id', transportista.id, cookieOptions)
    cookieStore.set('company_rut', transportista.rut, cookieOptions)
    cookieStore.set('user_role', 'transportista', cookieOptions)
    if (email) cookieStore.set('user_email', email, cookieOptions)

    await supabase
      .from('transportista_auth')
      .update({ last_login: new Date().toISOString() })
      .eq('transportista_id', transportista.id)

    return NextResponse.json({
      success: true,
      company: {
        id: transportista.id,
        rut: transportista.rut,
        name: transportista.nombre_fantasia || transportista.razon_social,
        email,
      },
    })
  } catch (error) {
    console.error('[auth/company] Unexpected login error:', error)
    return NextResponse.json({ error: 'Error al procesar login' }, { status: 500 })
  }
}
