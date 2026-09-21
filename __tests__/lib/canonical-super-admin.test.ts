import {
  CANONICAL_SUPER_ADMIN_EMAIL,
  isCanonicalSuperAdminEmail,
  isSuperAdmin,
} from '@/lib/auth-middleware'

describe('canonical super admin identity', () => {
  it('uses the active canonical account', () => {
    expect(CANONICAL_SUPER_ADMIN_EMAIL).toBe('kcanales@labbe.cl')
    expect(isCanonicalSuperAdminEmail('kcanales@labbe.cl')).toBe(true)
    expect(isCanonicalSuperAdminEmail('KCanales@labbe.cl')).toBe(true)
  })

  it('does not treat the retired Cecilia identity as canonical', () => {
    expect(isCanonicalSuperAdminEmail('cfarias@labbe.cl')).toBe(false)
  })

  it('still requires the persisted super_admin role', () => {
    expect(isSuperAdmin('kcanales@labbe.cl', 'super_admin')).toBe(true)
    expect(isSuperAdmin('kcanales@labbe.cl', 'administrador')).toBe(false)
  })
})
