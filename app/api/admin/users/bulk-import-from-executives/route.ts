import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function disabled() {
  return NextResponse.json(
    {
      error: 'Endpoint disabled',
      message: 'Legacy executive-to-user bulk import is disabled because it creates admin identities with predictable credentials through a web route.',
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
