import { readFileSync } from 'node:fs'

const ROUTES = [
  'app/api/admin/clean-all-users/route.ts',
  'app/api/admin/cleanup-profiles/route.ts',
  'app/api/admin/run-migration/route.ts',
  'app/api/admin/users/bulk-import/route.ts',
  'app/api/admin/users/bulk-import-from-executives/route.ts',
  'app/api/admin/create-executives-auth/route.ts',
  'app/api/admin/setup-transportista/route.ts',
  'app/api/admin/create-conductor-profiles/route.ts',
  'app/api/admin/insert-usuarios/route.ts',
  'app/api/admin/sync-drivers/route.ts',
  'app/api/admin/migrate-document-types/route.ts',
]

describe('legacy admin maintenance routes', () => {
  it.each(ROUTES)('%s is quarantined', (route) => {
    const source = readFileSync(route, 'utf8')
    expect(source).toContain('LEGACY_ADMIN_ENDPOINT_DISABLED')
    expect(source).toContain('status: 410')
    expect(source).not.toContain('createAdminClient')
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })
})
