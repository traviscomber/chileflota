import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getEmailSessionSecret, verifyEmailSession } from '@/lib/email-session'

const uuidSegment = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

const destructiveApiPatterns = [
  /^\/api\/admin\/clean-all-users$/,
  /^\/api\/admin\/cleanup-documents$/,
  /^\/api\/admin\/cleanup-profiles$/,
  /^\/api\/admin\/delete-dandus$/,
  /^\/api\/admin\/assign-company-exec$/,
  /^\/api\/admin\/migrate-conductores$/,
  /^\/api\/admin\/migrate-transportistas$/,
  /^\/api\/admin\/remove-cert-afiliaciones$/,
  /^\/api\/admin\/sync-drivers$/,
  /^\/api\/admin\/update-document-list$/,
  new RegExp(`^/api/admin/users/${uuidSegment}$`),
  new RegExp(`^/api/alerts-log/${uuidSegment}$`),
  new RegExp(`^/api/alerts/${uuidSegment}$`),
  new RegExp(`^/api/company/documents/${uuidSegment}$`),
  new RegExp(`^/api/company/documents/${uuidSegment}/delete$`),
  /^\/api\/company\/monthly-documents$/,
  new RegExp(`^/api/company/users/${uuidSegment}$`),
  new RegExp(`^/api/conductores/${uuidSegment}$`),
  new RegExp(`^/api/conductor/documents/${uuidSegment}$`),
  new RegExp(`^/api/documents/${uuidSegment}$`),
  /^\/api\/transportistas\/update-executive$/,
  new RegExp(`^/api/transportistas/${uuidSegment}$`),
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const method = request.method.toUpperCase()

  // Authentication endpoints must stay reachable even when the browser still
  // carries an older restricted session. Otherwise a stale prevencionista
  // cookie blocks POST /api/login-email before the user can re-authenticate.
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/auth/login') ||
    path === '/login' ||
    path === '/api/login-email' ||
    path === '/api/logout'
  ) {
    return NextResponse.next()
  }

  const appSession = await verifyEmailSession(
    request.cookies.get('app_session')?.value,
    getEmailSessionSecret(),
  )
  const isPrevencionista = appSession?.role === 'prevencionista'

  if (
    isPrevencionista &&
    path !== '/api/logout' &&
    path !== '/api/auth/logout' &&
    !['GET', 'HEAD', 'OPTIONS'].includes(method)
  ) {
    return NextResponse.json(
      { error: 'El perfil prevencionista tiene acceso de solo lectura.' },
      { status: 403 }
    )
  }


  if (
    process.env.NODE_ENV === 'production' &&
    ['POST', 'DELETE'].includes(method) &&
    destructiveApiPatterns.some((pattern) => pattern.test(path))
  ) {
    return NextResponse.json(
      {
        error: 'Destructive API actions are disabled in production to protect live data.',
      },
      { status: 403 }
    )
  }

  if (path.startsWith('/conductor')) {
    const conductorId = request.cookies.get('conductor_id')?.value
    if (!conductorId) {
      return NextResponse.redirect(new URL('/auth/login-conductor', request.url))
    }
    return NextResponse.next()
  }

  if (path.startsWith('/admin')) {
    if (!appSession) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (!['ejecutiva', 'admin'].includes(appSession.role)) {
      return NextResponse.redirect(new URL('/dashboard/company', request.url))
    }

    return NextResponse.next()
  }

  if (path.startsWith('/prevencionista')) {
    if (!appSession) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard/company', request.url))
  }

  if (path.startsWith('/dashboard')) {
    if (!appSession) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (path === '/dashboard' || path === '/dashboard/') {
      return NextResponse.redirect(new URL('/dashboard/company', request.url))
    }

    return NextResponse.next()
  }

  if (path.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (path.includes('.')) {
    return NextResponse.next()
  }

  if (path.startsWith('/walmart-ocr')) {
    const newPath = path.replace('/walmart-ocr', '/ocr')
    return NextResponse.redirect(new URL(newPath, request.url), { status: 308 })
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!api/cron/sii-transportistas|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
