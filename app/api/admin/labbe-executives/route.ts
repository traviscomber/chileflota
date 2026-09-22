import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, type UserRole } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const READ_ROLES = new Set<UserRole>(['super_admin', 'admin', 'administrador', 'ejecutiva', 'prevencionista'])

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!READ_ROLES.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all executives with @labbe.cl email - using select(*) to get all available columns
    const { data, error } = await supabase
      .from('executive_staff')
      .select('id, full_name, email, cargo, is_active')
      .ilike('email', '%@labbe.cl')
      .eq('is_active', true)
      .order('id', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      executives: data || [],
      count: data?.length || 0
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch executives' },
      { status: 500 }
    )
  }
}
