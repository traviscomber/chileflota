import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function disabled() {
  return NextResponse.json(
    {
      error: 'Endpoint disabled',
      message: 'Legacy document-period migration helpers are disabled over HTTP.',
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
