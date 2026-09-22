import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function gone() {
  return NextResponse.json(
    {
      error: 'Legacy maintenance endpoint disabled',
      code: 'LEGACY_ADMIN_ENDPOINT_DISABLED',
    },
    { status: 410 },
  )
}

export async function GET() { return gone() }
export async function POST() { return gone() }
export async function PATCH() { return gone() }
export async function DELETE() { return gone() }
