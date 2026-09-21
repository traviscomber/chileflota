import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function disabled() {
  return NextResponse.json(
    {
      error: 'Endpoint disabled',
      message: 'Legacy conductor profile bootstrap over HTTP is disabled in production-safe builds.',
    },
    { status: 410 },
  )
}

export async function GET() {
  return disabled()
}

export async function POST() {
  return disabled()
}
