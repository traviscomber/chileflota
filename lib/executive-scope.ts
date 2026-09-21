import { createAdminClient } from '@/lib/supabase/admin'

export type ExecutiveScope = {
  executiveStaffId: string
  companyIds: string[]
  companyRuts: string[]
  conductorIds: string[]
}

export async function resolveExecutiveScope(
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

  const [conductorsByCompanyId, conductorsByProviderRut] = await Promise.all([
    companyIds.length > 0
      ? supabase.from('conductores').select('id').in('transportista_id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    companyRuts.length > 0
      ? supabase.from('conductores').select('id').in('rut_proveedor', companyRuts)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (conductorsByCompanyId.error) throw conductorsByCompanyId.error
  if (conductorsByProviderRut.error) throw conductorsByProviderRut.error

  const conductorIds = [...new Set([
    ...(conductorsByCompanyId.data || []).map((row) => row.id).filter(Boolean),
    ...(conductorsByProviderRut.data || []).map((row) => row.id).filter(Boolean),
  ])]

  return { executiveStaffId, companyIds, companyRuts, conductorIds }
}

export async function resolveExecutiveCompanyIds(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  authUserId: string,
) {
  const scope = await resolveExecutiveScope(supabase, email, authUserId)
  return scope ? scope.companyIds : null
}

export async function resolveExecutiveConductorIds(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  authUserId: string,
) {
  const scope = await resolveExecutiveScope(supabase, email, authUserId)
  return scope ? scope.conductorIds : null
}
