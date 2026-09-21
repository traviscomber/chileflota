import jwt from 'jsonwebtoken'
import {
  DOCUMENT_READ_ROLES,
  DOCUMENT_WRITE_ROLES,
  hasOwnTransportistaAccess,
  isAllowedDocumentRole,
} from '@/lib/document-route-auth'

function requestWithTransportistaToken(token?: string) {
  return {
    cookies: {
      get: (name: string) => (
        name === 'transportista_token' && token ? { value: token } : undefined
      ),
    },
  } as any
}

describe('document route authorization', () => {
  const originalSecret = process.env.JWT_SECRET

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret
  })

  it('keeps prevencionista read-only', () => {
    expect(isAllowedDocumentRole('prevencionista', DOCUMENT_READ_ROLES)).toBe(true)
    expect(isAllowedDocumentRole('prevencionista', DOCUMENT_WRITE_ROLES)).toBe(false)
  })

  it('allows executive document writes', () => {
    expect(isAllowedDocumentRole('ejecutiva', DOCUMENT_WRITE_ROLES)).toBe(true)
  })

  it('allows a transportista token only for its own company', () => {
    process.env.JWT_SECRET = 'document-route-test-secret'
    const token = jwt.sign(
      { tipo: 'subcontratista', transportista_id: 'company-a' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' },
    )

    const request = requestWithTransportistaToken(token)
    expect(hasOwnTransportistaAccess(request, 'company-a')).toBe(true)
    expect(hasOwnTransportistaAccess(request, 'company-b')).toBe(false)
  })

  it('fails closed when transportista JWT secret is unavailable', () => {
    delete process.env.JWT_SECRET
    expect(hasOwnTransportistaAccess(requestWithTransportistaToken('anything'), 'company-a')).toBe(false)
  })

  it('rejects invalid transportista tokens', () => {
    process.env.JWT_SECRET = 'document-route-test-secret'
    expect(hasOwnTransportistaAccess(requestWithTransportistaToken('invalid'), 'company-a')).toBe(false)
  })
})
