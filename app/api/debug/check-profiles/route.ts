import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const adminClient = createAdminClient()

    // Get organization
    const { data: org } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('name', 'Transportes Labbe')
      .single()

    // Get all profiles
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email, rut, organization_id, full_name')

    return NextResponse.json({
      organization: org,
      profiles: profiles,
      total: profiles?.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
