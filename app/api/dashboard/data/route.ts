import { NextRequest, NextResponse } from 'next/server'
import { resolveExecutiveAssignment } from '@/lib/executive-login-resolution'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const userEmail = request.cookies.get('user_email')?.value
    const userName = request.cookies.get('user_name')?.value
    const userRole = request.cookies.get('user_role')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const isAdmin = userRole === 'admin'
    const startedAt = Date.now()
    const commonHeaders = {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
      'Content-Type': 'application/json',
    }

    // Start independent reads immediately instead of waiting for transportistas first.
    const executivesPromise = fetch(
      `${supabaseUrl}/rest/v1/executive_staff?select=id,full_name,email&is_active=eq.true`,
      { headers: commonHeaders },
    )

    const conductoresPromise = fetch(
      `${supabaseUrl}/rest/v1/conductores?limit=1000`,
      { headers: { ...commonHeaders, Prefer: 'count=exact' } },
    )

    const transportistasRpcPromise = fetch(
      `${supabaseUrl}/rest/v1/rpc/get_transportistas_with_contact`,
      { headers: commonHeaders },
    )

    let transportistas: any[] = []
    const rpcResponse = await transportistasRpcPromise

    if (rpcResponse.ok) {
      transportistas = await rpcResponse.json()
    } else {
      // Fallback remains parallel and only runs when the RPC is unavailable.
      const [transportistasResp, subcontratistasResp] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/transportistas?limit=1000`, { headers: commonHeaders }),
        fetch(`${supabaseUrl}/rest/v1/subcontratistas?limit=1000`, { headers: commonHeaders }),
      ])

      const [transportistasData, subcontratistasData] = await Promise.all([
        transportistasResp.json(),
        subcontratistasResp.json(),
      ])

      const fallbackSubMap = new Map<string, any>()
      if (Array.isArray(subcontratistasData)) {
        subcontratistasData.forEach((sub: any) => fallbackSubMap.set(sub.rut, sub))
      }

      transportistas = Array.isArray(transportistasData)
        ? transportistasData.map((t: any) => {
            const sub = fallbackSubMap.get(t.rut)
            return {
              ...t,
              email: sub?.email || t.email || '',
              telefono: sub?.telefono || t.telefono || '',
              correo: sub?.email || t.correo || '',
              // Assignment ownership is canonical in assigned_executive_id. Never revive a legacy owner from subcontratistas.ejecutiva.
              ejecutivo_nombre: t.ejecutivo_nombre || 'Sin asignar',
              direccion: sub?.direccion || t.direccion || '',
              comuna: t.comuna || sub?.comuna || '',
            }
          })
        : []
    }

    const [executivesResponse, conductoresResponse] = await Promise.all([
      executivesPromise,
      conductoresPromise,
    ])

    const [executivesData, conductores] = await Promise.all([
      executivesResponse.json(),
      conductoresResponse.json(),
    ])

    const execMap = new Map<string, string>()
    if (Array.isArray(executivesData)) {
      executivesData.forEach((e: any) => execMap.set(e.id, e.full_name))
    }

    const activeExecutive = userRole === 'ejecutiva' && Array.isArray(executivesData)
      ? resolveExecutiveAssignment(userEmail, userName || '', executivesData)
      : null

    if (userRole === 'ejecutiva' && !activeExecutive?.id) {
      return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
    }

    if (Array.isArray(transportistas)) {
      transportistas = transportistas
        .filter((t: any) => userRole !== 'ejecutiva' || t.assigned_executive_id === activeExecutive.id)
        .map((t: any) => {
          if (t.assigned_executive_id && execMap.has(t.assigned_executive_id)) {
            return { ...t, ejecutivo_nombre: execMap.get(t.assigned_executive_id) }
          }
          return t
        })
    }

    const subMap = new Map<string, any>()
    if (Array.isArray(transportistas)) {
      transportistas.forEach((sub: any) => subMap.set(sub.rut, sub))
    }

    const driverCountByRut = new Map<string, number>()
    if (Array.isArray(conductores)) {
      conductores.forEach((conductor: any) => {
        if (!conductor.rut_proveedor) return
        driverCountByRut.set(
          conductor.rut_proveedor,
          (driverCountByRut.get(conductor.rut_proveedor) || 0) + 1,
        )
      })
    }

    const transportistasWithCounts = Array.isArray(transportistas)
      ? transportistas.map((sub: any) => ({
          ...sub,
          conductores_count: driverCountByRut.get(sub.rut) || 0,
        }))
      : []

    const allowedProviderRuts = new Set(
      Array.isArray(transportistas) ? transportistas.map((item: any) => item.rut).filter(Boolean) : [],
    )

    const conductoresEnriquecidos = Array.isArray(conductores)
      ? conductores
          .filter((conductor: any) => userRole !== 'ejecutiva' || allowedProviderRuts.has(conductor.rut_proveedor))
          .map((conductor: any) => {
          const subcontractor = subMap.get(conductor.rut_proveedor)
          let fullName = conductor.nombre || ''

          if (!fullName) {
            const nombres = conductor.nombres || conductor.nombre_conductor || ''
            const apellidoPaterno = conductor.apellido_paterno || ''
            const apellidoMaterno = conductor.apellido_materno || ''
            fullName = [apellidoPaterno, apellidoMaterno, nombres]
              .filter(Boolean)
              .join(' ')
              .trim() || `Conductor ${conductor.rut || 'N/A'}`
          }

          return {
            ...conductor,
            conductor_id: conductor.id,
            nombre: fullName,
            ejecutivo_nombre: subcontractor?.ejecutivo_nombre || 'Sin asignar',
            nombre_subcontratista: subcontractor?.razon_social || subcontractor?.nombre_fantasia || conductor.rut_proveedor || 'N/A',
          }
        })
      : []

    const response = NextResponse.json({
      user: {
        email: userEmail,
        full_name: userName,
        role: userRole,
        isAdmin,
      },
      dashboard: {
        transportistas: transportistasWithCounts,
        conductores: conductoresEnriquecidos,
        stats: {
          totalTransportistas: Array.isArray(transportistas) ? transportistas.length : 0,
          totalConductores: conductoresEnriquecidos.length,
        },
      },
    })

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Server-Timing', `dashboard;dur=${Date.now() - startedAt}`)
    return response
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al cargar datos del dashboard', details: error?.message },
      { status: 500 },
    )
  }
}
