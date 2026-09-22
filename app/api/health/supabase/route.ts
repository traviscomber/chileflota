export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      return NextResponse.json(
        { status: 'error', error: 'Missing Supabase environment variables' },
        { status: 500 }
      )
    }

    const client = createClient(url, anonKey)
    const { error } = await client.auth.getSession()

    if (error) {
      return NextResponse.json(
        { status: 'error', error: 'Supabase auth health check failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      sessionCheck: 'successful',
    })
  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Supabase health check failed' },
      { status: 500 }
    )
  }
}
