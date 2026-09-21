import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { createHmac, timingSafeEqual } from 'crypto'
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

export const DOCUMENT_DEBUG_ROLES = new Set(['super_admin'])

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


const INTERNAL_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

function getDocumentInternalSigningSecret(): string | undefined {
  return process.env.APP_SESSION_SECRET || process.env.CRON_SECRET
}

function signInternalDocumentRequest(documentId: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${documentId}:${timestamp}`)
    .digest('hex')
}

export function createDocumentInternalAuthHeaders(documentId: string): Record<string, string> {
  const secret = getDocumentInternalSigningSecret()
  if (!secret || !documentId) return {}

  const timestamp = String(Date.now())
  return {
    'x-document-internal-timestamp': timestamp,
    'x-document-internal-signature': signInternalDocumentRequest(documentId, timestamp, secret),
  }
}

export function hasValidDocumentInternalSignature(
  request: NextRequest,
  documentId: string,
): boolean {
  const secret = getDocumentInternalSigningSecret()
  const timestamp = request.headers.get('x-document-internal-timestamp')
  const signature = request.headers.get('x-document-internal-signature')

  if (!secret || !timestamp || !signature || !documentId) return false

  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > INTERNAL_SIGNATURE_MAX_AGE_MS) {
    return false
  }

  const expected = signInternalDocumentRequest(documentId, timestamp, secret)
  const receivedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  )
}

export async function authorizeDocumentReprocess(
  request: NextRequest,
  documentId: string,
): Promise<boolean> {
  const internalUser = await authorizeInternalDocumentRequest(request, DOCUMENT_WRITE_ROLES)
  return Boolean(internalUser || hasValidDocumentInternalSignature(request, documentId))
}
