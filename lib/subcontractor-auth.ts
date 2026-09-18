import jwt, { type JwtPayload } from 'jsonwebtoken'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LEGACY_INSECURE_SECRET = 'transportista-secret-key'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface SubcontractorSessionClaims {
  rut: string
  transportista_id: string
  tipo: 'subcontratista'
}

export interface AuthenticatedSubcontractor {
  transportistaId: string
  rut: string
}

export type SubcontractorAuthResult =
  | { ok: true; identity: AuthenticatedSubcontractor }
  | { ok: false; status: 401 | 403 | 503; error: string }

export function normalizeSubcontractorRut(value?: string | null): string {
  return (value || '')
    .trim()
    .replace(/[^0-9kK]/g, '')
    .toUpperCase()
}

export function getSubcontractorJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret === LEGACY_INSECURE_SECRET) {
    throw new Error('SUBCONTRACTOR_JWT_SECRET_NOT_CONFIGURED')
  }
  return secret
}

function parseClaims(payload: string | JwtPayload): SubcontractorSessionClaims {
  if (typeof payload === 'string') throw new Error('INVALID_SUBCONTRACTOR_SESSION')

  const rut = normalizeSubcontractorRut(typeof payload.rut === 'string' ? payload.rut : '')
  const transportistaId = typeof payload.transportista_id === 'string'
    ? payload.transportista_id.trim()
    : ''

  if (
    payload.tipo !== 'subcontratista' ||
    !rut ||
    !UUID_RE.test(transportistaId)
  ) {
    throw new Error('INVALID_SUBCONTRACTOR_SESSION')
  }

  return {
    rut,
    transportista_id: transportistaId,
    tipo: 'subcontratista',
  }
}

export function signSubcontractorSession(input: {
  rut: string
  transportistaId: string
}): string {
  const rut = normalizeSubcontractorRut(input.rut)
  if (!rut || !UUID_RE.test(input.transportistaId)) {
    throw new Error('INVALID_SUBCONTRACTOR_IDENTITY')
  }

  return jwt.sign(
    {
      rut,
      transportista_id: input.transportistaId,
      tipo: 'subcontratista',
    },
    getSubcontractorJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: '24h',
    },
  )
}

export function verifySubcontractorSessionToken(token: string): SubcontractorSessionClaims {
  const payload = jwt.verify(token, getSubcontractorJwtSecret(), {
    algorithms: ['HS256'],
  })
  return parseClaims(payload)
}

export async function authenticateSubcontractorRequest(
  request: NextRequest,
  expectedTransportistaId?: string,
): Promise<SubcontractorAuthResult> {
  const token = request.cookies.get('transportista_token')?.value
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  let claims: SubcontractorSessionClaims
  try {
    claims = verifySubcontractorSessionToken(token)
  } catch (error) {
    if (error instanceof Error && error.message === 'SUBCONTRACTOR_JWT_SECRET_NOT_CONFIGURED') {
      console.error('[subcontractor-auth] JWT secret is not safely configured')
      return { ok: false, status: 503, error: 'Authentication service unavailable' }
    }
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  if (expectedTransportistaId && claims.transportista_id !== expectedTransportistaId) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  const supabase = createAdminClient()
  const [{ data: authRows, error: authError }, { data: transportista, error: transportistaError }] = await Promise.all([
    supabase
      .from('transportista_auth')
      .select('id,rut,transportista_id,is_active')
      .eq('transportista_id', claims.transportista_id)
      .eq('is_active', true)
      .limit(20),
    supabase
      .from('transportistas')
      .select('id,rut,is_active')
      .eq('id', claims.transportista_id)
      .maybeSingle(),
  ])

  if (authError || transportistaError || !transportista || transportista.is_active === false) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  // transportista_auth is the credential-to-organization authority. Some legacy
  // rows have a RUT representation that differs from transportistas, so ownership
  // is proven by the active transportista_id mapping plus the signed auth RUT.
  const hasActiveMapping = (authRows || []).some((row: any) =>
    row.transportista_id === claims.transportista_id &&
    normalizeSubcontractorRut(row.rut) === claims.rut,
  )

  if (!hasActiveMapping || !normalizeSubcontractorRut(transportista.rut)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return {
    ok: true,
    identity: {
      transportistaId: transportista.id,
      // Downstream canonical document state keeps using transportistas.rut.
      rut: transportista.rut,
    },
  }
}
