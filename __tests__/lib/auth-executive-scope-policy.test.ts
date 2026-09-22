import { readFileSync } from 'node:fs'

describe('privileged signed-session scope', () => {
  const authSource = readFileSync('lib/auth-middleware.ts', 'utf8')

  it('revalidates current executive assignment instead of trusting the signed organization snapshot forever', () => {
    expect(authSource).toContain('resolveCurrentExecutiveOrganization')
    expect(authSource).toContain("effectiveRole === 'ejecutiva'")
    expect(authSource).toContain("from('executive_staff')")
    expect(authSource).toContain('effectiveOrganizationId = currentOrganizationId')
  })

  it('keeps privileged legacy cookies fail-closed', () => {
    expect(authSource).toContain("return { user: null, error: 'Sesión firmada requerida' }")
  })
})
