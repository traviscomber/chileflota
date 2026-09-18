import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_ROLES = new Set<UserRole>([
  'super_admin',
  'admin',
  'administrador',
  'ejecutiva',
  'prevencionista',
])

type SearchContext = 'approved' | 'pending' | 'rejected'

type SearchSuggestion = {
  id: string
  type: 'company' | 'driver' | 'document'
  label: string
  secondary: string | null
  value: string
  href: string
}

type CompanyRow = {
  id: string
  rut: string | null
  razon_social: string | null
  nombre_fantasia: string | null
}

type DriverRow = {
  id: string
  rut: string | null
  nombres: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
  rut_proveedor?: string | null
}

type ExecutiveScope = {
  executiveStaffId: string
  companyIds: string[]
  companyRuts: string[]
  conductorIds: string[]
}

function sanitize(raw: string) {
  return raw.trim().replace(/[%_]/g, '').replace(/\s+/g, ' ').slice(0, 80)
}

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeRut(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^0-9k]/g, '')
}

function matchesText(value: string | null | undefined, query: string) {
  return normalizeText(value).includes(normalizeText(query))
}

function matchesRut(value: string | null | undefined, query: string) {
  const normalizedQuery = normalizeRut(query)
  return normalizedQuery.length >= 3 && normalizeRut(value).includes(normalizedQuery)
}

function companyRank(company: CompanyRow, query: string) {
  const normalizedQuery = normalizeText(query)
  const normalizedQueryRut = normalizeRut(query)
  const rut = normalizeRut(company.rut)
  const legalName = normalizeText(company.razon_social)
  const fantasyName = normalizeText(company.nombre_fantasia)

  if (normalizedQueryRut.length >= 7 && rut && rut === normalizedQueryRut) return 0
  if (legalName && legalName === normalizedQuery) return 1
  if (fantasyName && fantasyName === normalizedQuery) return 1
  if (normalizedQueryRut && rut.startsWith(normalizedQueryRut)) return 2
  if (legalName.startsWith(normalizedQuery) || fantasyName.startsWith(normalizedQuery)) return 2
  return 3
}

function driverLabel(driver: DriverRow) {
  return [driver.nombres, driver.apellido_paterno, driver.apellido_materno].filter(Boolean).join(' ').trim() || driver.rut || 'Conductor'
}

function driverRank(driver: DriverRow, query: string) {
  const normalizedQuery = normalizeText(query)
  const normalizedQueryRut = normalizeRut(query)
  const rut = normalizeRut(driver.rut)
  const name = normalizeText(driverLabel(driver))

  if (normalizedQueryRut.length >= 7 && rut && rut === normalizedQueryRut) return 0
  if (name && name === normalizedQuery) return 1
  if (normalizedQueryRut && rut.startsWith(normalizedQueryRut)) return 2
  if (name.startsWith(normalizedQuery)) return 2
  return 3
}

function contextPath(context: SearchContext) {
  if (context === 'pending') return '/dashboard/company/documentos/pendientes'
  if (context === 'rejected') return '/dashboard/company/documentos/rechazados'
  return '/dashboard/company/documentos/aprobados'
}

function toHref(value: string, context: SearchContext) {
  return `${contextPath(context)}?search=${encodeURIComponent(value)}`
}

function toDriverHref(driver: DriverRow) {
  return driver.rut
    ? `/dashboard/company/conductores?rut=${encodeURIComponent(driver.rut)}`
    : '/dashboard/company/conductores'
}

async function resolveExecutiveScope(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  authUserId: string,
): Promise<ExecutiveScope | null> {
  const { data: exact } = await supabase
    .from('executive_staff')
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  let executiveStaffId = exact?.id as string | undefined

  if (!executiveStaffId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', authUserId)
      .maybeSingle()

    if (profile?.full_name) {
      const { data: matches } = await supabase
        .from('executive_staff')
        .select('id')
        .ilike('full_name', profile.full_name)
        .eq('is_active', true)
        .limit(2)

      if (matches?.length === 1) executiveStaffId = matches[0].id as string
    }
  }

  if (!executiveStaffId) return null

  const { data: companies, error: companiesError } = await supabase
    .from('transportistas')
    .select('id,rut')
    .eq('assigned_executive_id', executiveStaffId)
    .eq('is_active', true)

  if (companiesError) throw companiesError

  const companyIds = (companies || []).map((row) => row.id).filter(Boolean)
  const companyRuts = (companies || []).map((row) => row.rut).filter(Boolean) as string[]

  let conductorIds: string[] = []
  if (companyRuts.length > 0) {
    const { data: conductores, error: conductoresError } = await supabase
      .from('conductores')
      .select('id')
      .in('rut_proveedor', companyRuts)

    if (conductoresError) throw conductoresError
    conductorIds = (conductores || []).map((row) => row.id).filter(Boolean)
  }

  return { executiveStaffId, companyIds, companyRuts, conductorIds }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user) {
      return NextResponse.json({ error: auth.error || 'No autenticado' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.has(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const url = new URL(request.url)
    const query = sanitize(url.searchParams.get('q') || '')
    const contextParam = url.searchParams.get('context')
    const context: SearchContext = contextParam === 'pending' || contextParam === 'rejected' ? contextParam : 'approved'

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const supabase = createAdminClient()
    const executiveScope = auth.user.role === 'ejecutiva'
      ? await resolveExecutiveScope(supabase, auth.user.email, auth.user.id)
      : null

    if (auth.user.role === 'ejecutiva' && !executiveScope) {
      return NextResponse.json({ error: 'No se pudo resolver la ejecutiva activa' }, { status: 403 })
    }

    let companies: CompanyRow[] = []
    let drivers: DriverRow[] = []

    if (executiveScope) {
      const [companiesResult, driversResult] = await Promise.all([
        executiveScope.companyIds.length > 0
          ? supabase
              .from('transportistas')
              .select('id,rut,razon_social,nombre_fantasia')
              .in('id', executiveScope.companyIds)
              .eq('is_active', true)
          : Promise.resolve({ data: [], error: null }),
        executiveScope.companyRuts.length > 0
          ? supabase
              .from('conductores')
              .select('id,rut,nombres,apellido_paterno,apellido_materno,rut_proveedor')
              .in('rut_proveedor', executiveScope.companyRuts)
              .limit(5000)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (companiesResult.error) throw companiesResult.error
      if (driversResult.error) throw driversResult.error

      companies = ((companiesResult.data || []) as CompanyRow[]).filter((company) =>
        matchesText(company.razon_social, query) ||
        matchesText(company.nombre_fantasia, query) ||
        matchesRut(company.rut, query),
      )

      const tokens = normalizeText(query).split(' ').filter((token) => token.length >= 2)
      drivers = ((driversResult.data || []) as DriverRow[]).filter((driver) => {
        if (matchesRut(driver.rut, query)) return true
        const haystack = normalizeText(`${driverLabel(driver)} ${driver.rut || ''}`)
        return tokens.length > 0 && tokens.every((token) => haystack.includes(token))
      })
    } else {
      const pattern = `%${query}%`
      const normalizedQuery = normalizeText(query)
      const driverTokens = normalizedQuery.split(' ').filter((token) => token.length >= 2)
      const driverSeed = driverTokens[0] || normalizedQuery
      const driverPattern = `%${driverSeed}%`

      const [companyByName, companyByRut, companyByFantasy, driverByRut, driverByNames, driverByPaternal, driverByMaternal] = await Promise.all([
        supabase.from('transportistas').select('id,rut,razon_social,nombre_fantasia').ilike('razon_social', pattern).limit(8),
        supabase.from('transportistas').select('id,rut,razon_social,nombre_fantasia').ilike('rut', pattern).limit(8),
        supabase.from('transportistas').select('id,rut,razon_social,nombre_fantasia').ilike('nombre_fantasia', pattern).limit(8),
        supabase.from('conductores').select('id,rut,nombres,apellido_paterno,apellido_materno').ilike('rut', pattern).limit(8),
        supabase.from('conductores').select('id,rut,nombres,apellido_paterno,apellido_materno').ilike('nombres', driverPattern).limit(8),
        supabase.from('conductores').select('id,rut,nombres,apellido_paterno,apellido_materno').ilike('apellido_paterno', driverPattern).limit(8),
        supabase.from('conductores').select('id,rut,nombres,apellido_paterno,apellido_materno').ilike('apellido_materno', driverPattern).limit(8),
      ])

      for (const result of [companyByName, companyByRut, companyByFantasy, driverByRut, driverByNames, driverByPaternal, driverByMaternal]) {
        if (result.error) throw result.error
      }

      companies = [
        ...((companyByName.data || []) as CompanyRow[]),
        ...((companyByRut.data || []) as CompanyRow[]),
        ...((companyByFantasy.data || []) as CompanyRow[]),
      ]

      drivers = [
        ...((driverByRut.data || []) as DriverRow[]),
        ...((driverByNames.data || []) as DriverRow[]),
        ...((driverByPaternal.data || []) as DriverRow[]),
        ...((driverByMaternal.data || []) as DriverRow[]),
      ]
    }

    companies = companies
      .filter((company, index, rows) => rows.findIndex((row) => row.id === company.id) === index)
      .sort((a, b) => {
        const rankDiff = companyRank(a, query) - companyRank(b, query)
        if (rankDiff !== 0) return rankDiff
        return (a.razon_social || a.nombre_fantasia || a.rut || '').localeCompare(
          b.razon_social || b.nombre_fantasia || b.rut || '',
          'es',
        )
      })

    drivers = drivers
      .filter((driver, index, rows) => rows.findIndex((row) => row.id === driver.id) === index)
      .sort((a, b) => {
        const rankDiff = driverRank(a, query) - driverRank(b, query)
        if (rankDiff !== 0) return rankDiff
        return driverLabel(a).localeCompare(driverLabel(b), 'es')
      })

    const suggestions: SearchSuggestion[] = []
    const seen = new Set<string>()
    const normalizedQueryRut = normalizeRut(query)

    for (const company of companies.slice(0, 5)) {
      const label = company.razon_social || company.nombre_fantasia || company.rut || 'Empresa'
      const exactRut = normalizedQueryRut.length >= 7 && normalizeRut(company.rut) === normalizedQueryRut
      const value = exactRut ? company.rut || query : company.razon_social || company.nombre_fantasia || company.rut || query
      suggestions.push({
        id: `company:${company.id}`,
        type: 'company',
        label,
        secondary: company.rut || null,
        value,
        href: toHref(value, context),
      })
      seen.add(`company:${company.id}`)
    }

    for (const driver of drivers) {
      if (suggestions.length >= 8) break
      const label = driverLabel(driver)
      const exactRut = normalizedQueryRut.length >= 7 && normalizeRut(driver.rut) === normalizedQueryRut
      suggestions.push({
        id: `driver:${driver.id}`,
        type: 'driver',
        label,
        secondary: driver.rut || 'Conductor',
        value: exactRut ? driver.rut || query : label,
        href: toDriverHref(driver),
      })
    }

    if (suggestions.length < 8) {
      const pattern = `%${query}%`
      let subcontractorDocsQuery: any = supabase
        .from('subcontractor_documents')
        .select('id,file_name,subcontractor_rut,subcontractor_id')
        .eq('is_current', true)
        .eq('status', context)
        .or(`file_name.ilike.${pattern},subcontractor_rut.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(8)

      if (executiveScope) {
        subcontractorDocsQuery = executiveScope.companyIds.length > 0
          ? subcontractorDocsQuery.in('subcontractor_id', executiveScope.companyIds)
          : null
      }

      let driverDocsQuery: any = supabase
        .from('uploaded_documents')
        .select('id,original_filename,conductor_id')
        .eq('is_current', true)
        .ilike('original_filename', pattern)
        .order('updated_at', { ascending: false })
        .limit(8)

      if (context === 'pending') {
        driverDocsQuery = driverDocsQuery.or('validation_status.eq.pending,validation_status.is.null')
      } else {
        driverDocsQuery = driverDocsQuery.eq('validation_status', context)
      }

      if (executiveScope) {
        driverDocsQuery = executiveScope.conductorIds.length > 0
          ? driverDocsQuery.in('conductor_id', executiveScope.conductorIds)
          : null
      }

      const [subDocsResult, driverDocsResult] = await Promise.all([
        subcontractorDocsQuery || Promise.resolve({ data: [], error: null }),
        driverDocsQuery || Promise.resolve({ data: [], error: null }),
      ])

      if (subDocsResult.error) throw subDocsResult.error
      if (driverDocsResult.error) throw driverDocsResult.error

      for (const doc of subDocsResult.data || []) {
        if (suggestions.length >= 8 || !doc.file_name || seen.has(`document:${doc.id}`)) continue
        seen.add(`document:${doc.id}`)
        suggestions.push({
          id: `document:${doc.id}`,
          type: 'document',
          label: doc.file_name,
          secondary: doc.subcontractor_rut || 'Documento de subcontratista',
          value: doc.file_name,
          href: toHref(doc.file_name, context),
        })
      }

      for (const doc of driverDocsResult.data || []) {
        if (suggestions.length >= 8 || !doc.original_filename || seen.has(`driver-document:${doc.id}`)) continue
        seen.add(`driver-document:${doc.id}`)
        suggestions.push({
          id: `driver-document:${doc.id}`,
          type: 'document',
          label: doc.original_filename,
          secondary: 'Documento de conductor',
          value: doc.original_filename,
          href: toHref(doc.original_filename, context),
        })
      }
    }

    const response = NextResponse.json({ suggestions, context, scope: executiveScope ? 'assigned_executive' : 'role_default' })
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch (error) {
    console.error('[ChileFlota search suggestions] failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'No se pudieron cargar coincidencias' }, { status: 500 })
  }
}
