import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint disabled',
      message: 'Database insert test endpoint is disabled in production-safe builds.',
    },
    { status: 410 }
  )
}
