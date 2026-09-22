export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = createClient()
    if (!supabase) {
      return Response.json({
        error: 'Error de conexión a base de datos',
      }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('executive_staff')
      .select('rut, full_name, email')
      .order('full_name')

    if (error) {
      return Response.json({
        error: error.message,
        code: error.code,
      })
    }

    return Response.json({
      count: data?.length || 0,
      executives: data || [],
    })
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
