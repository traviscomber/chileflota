import { requiresSignedSession } from '@/lib/auth-middleware'

describe('privileged auth session policy', () => {
  it('requires signed sessions for privileged operational roles', () => {
    expect(requiresSignedSession('super_admin')).toBe(true)
    expect(requiresSignedSession('admin')).toBe(true)
    expect(requiresSignedSession('administrador')).toBe(true)
    expect(requiresSignedSession('ejecutiva')).toBe(true)
    expect(requiresSignedSession('prevencionista')).toBe(true)
  })

  it('preserves legacy fallback only for non-privileged roles', () => {
    expect(requiresSignedSession('driver')).toBe(false)
    expect(requiresSignedSession('conductor')).toBe(false)
    expect(requiresSignedSession('transportista')).toBe(false)
    expect(requiresSignedSession('mandante')).toBe(false)
    expect(requiresSignedSession(undefined)).toBe(false)
  })
})
