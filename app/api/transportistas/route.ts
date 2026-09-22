import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDefaultPassword } from '@/lib/password-utils'
import bcrypt from 'bcryptjs'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'

const READ_ROLES = new Set<UserRole>(['super_admin', 'admin', 'administrador', 'ejecutiva', 'prevencionista'])
const WRITE_ROLES = new Set<UserRole>(['super_admin', 'admin', 'administrador', 'ejecutiva'])

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!READ_ROLES.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createAdminClient()

    // Get all transportistas with their assigned executives
    const { data: transportistas, error } = await supabase
      .from('transportistas')
      .select(`
        id,
        rut,
        razon_social,
        region,
        comuna,
        telefono,
        email,
        representante_legal,
        assigned_executive_id,
        is_active,
        created_at
      `)
      .order('razon_social')

    if (error) {
      throw error
    }

    // Get all executives for mapping
    const { data: executives } = await supabase
      .from('executive_staff')
      .select('id, full_name, email')

    // Map executives for easy lookup
    const executiveMap = new Map()
    if (executives) {
      executives.forEach(exec => {
        executiveMap.set(exec.id, { nombre: exec.full_name, email: exec.email })
      })
    }

    // Enrich transportistas with executive info
    const enrichedTransportistas = transportistas?.map(t => ({
      ...t,
      ejecutivo: t.assigned_executive_id ? executiveMap.get(t.assigned_executive_id)?.nombre : null,
      ejecutivo_email: t.assigned_executive_id ? executiveMap.get(t.assigned_executive_id)?.email : null,
    })) || []

    return NextResponse.json({
      success: true,
      count: enrichedTransportistas.length,
      transportistas: enrichedTransportistas,
    })
  } catch (error) {
    console.error('[v0] Error fetching transportistas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching transportistas' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!WRITE_ROLES.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { razon_social, rut, region, comuna, telefono, email, nombre_contacto, is_active } = body

    // Validate required fields
    if (!razon_social || !rut) {
      return NextResponse.json(
        { error: 'razon_social y rut son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check if RUT already exists
    const { data: existing, error: checkError } = await supabase
      .from('transportistas')
      .select('id')
      .eq('rut', rut)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un subcontratista con este RUT' },
        { status: 400 }
      )
    }

    // Get all active executives with their current company counts (balance load)
    const { data: executives, error: execError } = await supabase
      .from('executive_staff')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name')

    if (execError || !executives || executives.length === 0) {
      console.error('[v0] No active executives found:', execError)
      return NextResponse.json(
        { error: 'No hay ejecutivas activas disponibles para asignación' },
        { status: 500 }
      )
    }

    // Count how many companies each executive already has (load balancing)
    const executiveLoadMap = new Map<string, number>()
    executives.forEach(exec => executiveLoadMap.set(exec.id, 0))

    const { data: allTransportistas } = await supabase
      .from('transportistas')
      .select('assigned_executive_id')
      .not('assigned_executive_id', 'is', null)

    if (allTransportistas) {
      allTransportistas.forEach((t: any) => {
        if (t.assigned_executive_id) {
          const count = executiveLoadMap.get(t.assigned_executive_id) || 0
          executiveLoadMap.set(t.assigned_executive_id, count + 1)
        }
      })
    }

    // Find executive with least companies (round-robin load balancing)
    let selectedExecutive = executives[0]
    let minLoad = executiveLoadMap.get(selectedExecutive.id) || 0

    for (const exec of executives) {
      const load = executiveLoadMap.get(exec.id) || 0
      if (load < minLoad) {
        selectedExecutive = exec
        minLoad = load
      }
    }

    console.log(`[v0] Creating transportista with auto-assigned executive: ${selectedExecutive.full_name} (load: ${minLoad})`)

    // Create new transportista with auto-assigned executive
    const { data, error } = await supabase
      .from('transportistas')
      .insert({
        razon_social,
        rut,
        region: region || null,
        comuna: comuna || null,
        telefono: telefono || null,
        email: email || null,
        representante_legal: nombre_contacto || null,
        is_active: is_active !== false,
        assigned_executive_id: selectedExecutive.id, // AUTO-ASSIGN
      })
      .select()

    if (error) {
      throw error
    }

    // Calculate password using standard formula
    const password = generateDefaultPassword(rut)

    // CRITICAL: Create auth record automatically for new transportista
    // Without this, the new user cannot login
    const newTransportista = data?.[0]
    if (newTransportista) {
      const passwordHash = await bcrypt.hash(password, 10)

      const { error: authError } = await supabase
        .from('transportista_auth')
        .insert({
          transportista_id: newTransportista.id,
          rut: rut,
          password_hash: passwordHash,
          is_active: true,
          created_at: new Date().toISOString(),
        })

      if (authError) {
        console.error('[v0] Warning: Auth record creation failed:', authError)
        // Don't fail the entire operation, but log the warning
        return NextResponse.json({
          success: true,
          transportista: newTransportista,
          assigned_executive: selectedExecutive,
          auth_warning: 'Subcontratista creado pero la cuenta de acceso falló. Intente de nuevo.',
          message: `Subcontratista creado y asignado a ${selectedExecutive.full_name}`
        })
      }

      console.log(`[v0] Auth record created for RUT ${rut}`)
    }

    return NextResponse.json({
      success: true,
      transportista: newTransportista,
      assigned_executive: selectedExecutive,
      message: `Subcontratista creado y asignado a ${selectedExecutive.full_name}. Puede hacer login inmediatamente.`
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating transportista' },
      { status: 500 }
    )
  }
}
