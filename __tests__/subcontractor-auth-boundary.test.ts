import fs from 'node:fs'
import path from 'node:path'
import {
  getSubcontractorJwtSecret,
  normalizeSubcontractorRut,
  signSubcontractorSession,
  verifySubcontractorSessionToken,
} from '@/lib/subcontractor-auth'

const TRANSPORTISTA_ID = '11111111-1111-4111-8111-111111111111'
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET
})

describe('subcontractor auth boundary', () => {
  it('fails closed when JWT_SECRET is absent', () => {
    delete process.env.JWT_SECRET
    expect(() => getSubcontractorJwtSecret()).toThrow('SUBCONTRACTOR_JWT_SECRET_NOT_CONFIGURED')
  })

  it('rejects the legacy known fallback secret', () => {
    process.env.JWT_SECRET = 'transportista-secret-key'
    expect(() => getSubcontractorJwtSecret()).toThrow('SUBCONTRACTOR_JWT_SECRET_NOT_CONFIGURED')
  })

  it('signs and verifies only explicit subcontractor claims with HS256', () => {
    process.env.JWT_SECRET = 'test-only-configured-secret-do-not-use'

    const token = signSubcontractorSession({
      rut: '76.123.456-7',
      transportistaId: TRANSPORTISTA_ID,
    })
    const claims = verifySubcontractorSessionToken(token)

    expect(claims).toEqual({
      rut: '761234567',
      transportista_id: TRANSPORTISTA_ID,
      tipo: 'subcontratista',
    })
  })

  it('normalizes RUT without trusting formatting differences', () => {
    expect(normalizeSubcontractorRut(' 76.123.456-k ')).toBe('76123456K')
  })

  it('removes the hardcoded JWT fallback from login and profile routes', () => {
    const login = fs.readFileSync(
      path.join(process.cwd(), 'app/api/auth/subcontractors/login/route.ts'),
      'utf8',
    )
    const profile = fs.readFileSync(
      path.join(process.cwd(), 'app/api/auth/subcontractors/profile/route.ts'),
      'utf8',
    )

    expect(login).not.toContain("process.env.JWT_SECRET || 'transportista-secret-key'")
    expect(profile).not.toContain("process.env.JWT_SECRET || 'transportista-secret-key'")
    expect(login).not.toContain("from 'jsonwebtoken'")
    expect(profile).not.toContain("from 'jsonwebtoken'")
  })

  it('authenticates document GET and POST before route-level service-role access', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'app/api/subcontractors/[id]/documents/route.ts'),
      'utf8',
    )

    const postStart = route.indexOf('export async function POST')
    const postAuth = route.indexOf('await authenticateSubcontractorRequest(request, id)', postStart)
    const postAdmin = route.indexOf('const supabase = createAdminClient()', postStart)
    const getStart = route.indexOf('export async function GET')
    const getAuth = route.indexOf('await authenticateSubcontractorRequest(request, id)', getStart)
    const getAdmin = route.indexOf('const supabase = createAdminClient()', getStart)

    expect(postAuth).toBeGreaterThan(postStart)
    expect(postAdmin).toBeGreaterThan(postAuth)
    expect(getAuth).toBeGreaterThan(getStart)
    expect(getAdmin).toBeGreaterThan(getAuth)
    expect(route).toContain('subcontractor_rut: auth.identity.rut')
    expect(route).not.toContain("const subcontractorRut = formData.get('subcontractorRut')")
  })

  it('authenticates conductor reads before route-level service-role access', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'app/api/subcontractors/[id]/conductors/route.ts'),
      'utf8',
    )

    const authIndex = route.indexOf('await authenticateSubcontractorRequest(request, id)')
    const adminIndex = route.indexOf('const supabase = createAdminClient()')

    expect(authIndex).toBeGreaterThanOrEqual(0)
    expect(adminIndex).toBeGreaterThan(authIndex)
    expect(route).toContain(".eq('rut_proveedor', auth.identity.rut)")
  })

  it('revalidates a token against active auth mapping and canonical transportista ownership', () => {
    const helper = fs.readFileSync(
      path.join(process.cwd(), 'lib/subcontractor-auth.ts'),
      'utf8',
    )

    expect(helper).toContain(".from('transportista_auth')")
    expect(helper).toContain(".eq('is_active', true)")
    expect(helper).toContain(".from('transportistas')")
    expect(helper).toContain('normalizeSubcontractorRut(row.rut) === claims.rut')
    expect(helper).toContain('claims.transportista_id !== expectedTransportistaId')
    expect(helper).not.toContain('canonicalRut !== claims.rut')
  })

  it('signs the login session from transportista_auth while returning canonical transportista data', () => {
    const login = fs.readFileSync(
      path.join(process.cwd(), 'app/api/auth/subcontractors/login/route.ts'),
      'utf8',
    )

    expect(login).toContain('rut: authRecord.rut')
    expect(login).toContain('rut: transportista.rut')
    expect(login).not.toContain('RUT mapping mismatch')
  })
})
