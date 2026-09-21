import {
  CANONICAL_SUPER_ADMIN_EMAIL,
  isCanonicalSuperAdminEmail,
  isSuperAdmin,
} from '@/lib/auth-middleware'

describe('canonical super admin identity', () => {
  it('uses Karen/Katherinne canonical account', () => {
    expect(CANONICAL_SUPER_ADMIN_EMAIL).toBe('kcanales@labbe.cl')
    expect(isCanonicalSuperAdminEmail('kcanales@labbe.cl')).toBe(true)
    expect(isCanonicalSuperAdminEmail('KCanales@labbe.cl')).toBe(true)
  })

  it('does not treat the departed Cecilia account as canonical', () => {
    expect(isCanonicalSuperAdminEmail('cfarias@labbe.cl')).toBe(false)
  })

  it('still requires the persisted super_admin role for privilege', () => {
    expect(isSuperAdmin('kcanales@labbe.cl', 'super_admin')).toBe(true)
    expect(isSuperAdmin('kcanales@labbe.cl', 'administrador')).toBe(false)
  })
})
