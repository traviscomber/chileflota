import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import {
  getEmailSessionSecret,
  verifyEmailSession,
  type EmailSession,
} from '@/lib/email-session'

export const DOCUMENT_READ_ROLES = new Set([
  'super_admin',
  'admin',
  'administrador',
  'ejecutiva',
  'prevencionista',
])

export const DOCUMENT_WRITE_ROLES = new Set([
  'super_admin',
  'admin',
  'administrador',
  'ejecutiva',
])

type TransportistaClaims = {
  transportista_id?: string
  tipo?: string
}

export function isAllowedDocumentRole(
  role: string | null | undefined,
  allowedRoles: Set<string>,
): boolean {
  return Boolean(role && allowedRoles.has(role))
}

export async function getSignedAppSession(request: NextRequest): Promise<EmailSession | null> {
  return verifyEmailSession(
    request.cookies.get('app_session')?.value,
    getEmailSessionSecret(),
  )
}

export async function authorizeInternalDocumentRequest(
  request: NextRequest,
  allowedRoles: Set<string>,
): Promise<EmailSession | null> {
  const session = await getSignedAppSession(request)
  if (!session || !isAllowedDocumentRole(session.role, allowedRoles)) return null
  return session
}

export function hasOwnTransportistaAccess(
  request: NextRequest,
  targetTransportistaId: string,
): boolean {
  const token = request.cookies.get('transportista_token')?.value
  const secret = process.env.JWT_SECRET

  if (!token || !secret || !targetTransportistaId) return false

  try {
    const decoded = jwt.verify(token, secret) as TransportistaClaims
    return (
      decoded.tipo === 'subcontratista' &&
      decoded.transportista_id === targetTransportistaId
    )
  } catch {
    return false
  }
}

export async function authorizeSubcontractorDocumentRead(
  request: NextRequest,
  targetTransportistaId: string,
): Promise<boolean> {
  const internal = await authorizeInternalDocumentRequest(request, DOCUMENT_READ_ROLES)
  return Boolean(internal || hasOwnTransportistaAccess(request, targetTransportistaId))
}

export async function authorizeSubcontractorDocumentWrite(
  request: NextRequest,
  targetTransportistaId: string,
): Promise<boolean> {
  const internal = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
  return Boolean(internal || hasOwnTransportistaAccess(request, targetTransportistaId))
}
